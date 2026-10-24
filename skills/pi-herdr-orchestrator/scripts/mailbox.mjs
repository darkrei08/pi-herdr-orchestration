#!/usr/bin/env node
// Report-back mailbox and orchestration coordination.
// Shared by every linked worktree under <git-common-dir>/orchestrator/<run>/ and never tracked.
// Features borrowed and adapted from fleet architecture (pi-herdsman):
//   - Atomic lock-based file mutations (zero race conditions across panes)
//   - Semantic result & evidence storage (large logs/diffs hashed to files; context remains clean)
//   - Bi-directional ask/reply protocol (workers can query master without hanging)
//   - Status dashboard joining mailbox records with Herdr agent liveness
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { withLock } from "./lock.mjs";

export const STATES = ["ASSIGNED", "WORKING", "READY", "DEVELOPMENT", "BLOCKED", "FAILED", "CLOSED"];
const PENDING = new Set(["ASSIGNED", "WORKING"]);
const TERMINAL = new Set(["READY", "DEVELOPMENT", "BLOCKED", "FAILED", "CLOSED"]);
const SUPERVISION_ANCHORS = ["session", "tab", "workspace", "worktree", "branch", "parent"];
const CHECKS = new Set(["PASS", "FAIL", "BLOCKED", "NOT RUN"]);
const FAILURE_STATES = new Set(["BLOCKED", "FAILED"]);
const IDENTITY_FIELDS = ["session", "tab", "workspace", "worktree", "branch", "task", "parent", "phase"];
const LIFECYCLE_ANCHORS = ["directive", "execution", "result", "receipt"];

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const parseObject = (value, name) => {
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { throw new Error(`${name} must be valid JSON`); }
  }
  if (!isRecord(value)) throw new Error(`${name} must be an object`);
  return value;
};

export function validateIdentity(value) {
  const identity = parseObject(value, "identity");
  for (const field of IDENTITY_FIELDS) {
    if (typeof identity[field] !== "string" || !identity[field].trim()) {
      throw new Error(`identity.${field} is required`);
    }
  }
  const lifecycle = parseObject(identity.lifecycle ?? identity.anchors, "identity.lifecycle");
  for (const anchor of LIFECYCLE_ANCHORS) {
    if (typeof lifecycle[anchor] !== "string" || !lifecycle[anchor].trim()) {
      throw new Error(`identity.lifecycle.${anchor} is required`);
    }
  }
  return { ...identity, lifecycle: Object.fromEntries(LIFECYCLE_ANCHORS.map((anchor) => [anchor, lifecycle[anchor]])) };
}

export function validateFailure(value) {
  const failure = parseObject(value, "failure");
  for (const field of ["kind", "code", "message"]) {
    if (typeof failure[field] !== "string" || !failure[field].trim()) throw new Error(`failure.${field} is required`);
  }
  if (!/^[a-z][a-z0-9._-]*$/.test(failure.kind) || !/^[a-z][a-z0-9._-]*$/.test(failure.code)) {
    throw new Error("failure.kind and failure.code must be stable lowercase identifiers");
  }
  if (typeof failure.retryable !== "boolean") throw new Error("failure.retryable must be a boolean");
  return { kind: failure.kind, code: failure.code, message: failure.message, retryable: failure.retryable };
}

function identityInput(opts) {
  const fields = ["session", "tab", "workspace", "worktree", "lifecycle", "anchors"];
  const supplied = opts.identity !== undefined || opts.sender !== undefined || fields.some((field) => opts[field] !== undefined);
  if (!supplied) return null;
  if (opts.identity !== undefined && opts.sender !== undefined && JSON.stringify(opts.identity) !== JSON.stringify(opts.sender)) {
    throw new Error("identity and sender mismatch");
  }
  const input = opts.identity !== undefined ? parseObject(opts.identity, "identity") : opts.sender !== undefined ? parseObject(opts.sender, "sender") : {};
  for (const field of [...IDENTITY_FIELDS, "lifecycle", "anchors"]) {
    if (opts[field] !== undefined) {
      if (input[field] !== undefined && JSON.stringify(input[field]) !== JSON.stringify(opts[field])) {
        throw new Error(`identity.${field} mismatch`);
      }
      input[field] = opts[field];
    }
  }
  return validateIdentity(input);
}

function assertIdentityContinuity(previous, current, opts) {
  if (!current) {
    if (previous?.identity) throw new Error("identity is required for an existing identified report");
    return;
  }
  if (opts.task !== undefined && current.task !== opts.task) throw new Error("identity.task mismatch");
  if (opts.branch !== undefined && current.branch !== opts.branch) throw new Error("identity.branch mismatch");
  if (opts.parent !== undefined && current.parent !== opts.parent) throw new Error("identity.parent mismatch");
  if (opts.phase !== undefined && current.phase !== opts.phase) throw new Error("identity.phase mismatch");
  if (!previous?.identity) return;
  for (const field of ["session", "tab", "workspace", "worktree", "branch", "task", "parent"]) {
    if (previous.identity[field] !== current[field]) throw new Error(`identity.${field} mismatch`);
  }
  if (JSON.stringify(previous.identity.lifecycle) !== JSON.stringify(current.lifecycle)) {
    throw new Error("identity.lifecycle mismatch");
  }
}

export function classify(entry, agent, now, staleMs) {
  const live = agent?.agent_status;
  if (entry.state === "CLOSED") return "OK";
  if (entry.pending_ask) return "ASK";
  if (!agent) return "GONE";
  if (live === "blocked") return "NEEDS_HUMAN";
  if (PENDING.has(entry.state) && (live === "idle" || live === "done")) return "SILENT";
  if (PENDING.has(entry.state) && live === "working" && now - Date.parse(entry.updated_at) > staleMs) return "STALE";
  if (!PENDING.has(entry.state)) return "DECIDE";
  return "OK";
}

function supervisionDirective(report, outcome, reasonCode, requiredParentAction, reassignmentPermitted, completionPermitted) {
  return {
    outcome,
    task: report.task ?? "unknown",
    prior_owner: report.agent ?? "unknown",
    reason_code: reasonCode,
    required_parent_action: requiredParentAction,
    reassignment_permitted: reassignmentPermitted,
    completion_permitted: completionPermitted,
  };
}

function liveAnchor(agent, field) {
  const aliases = {
    session: [agent.session, agent.agent_session?.value],
    tab: [agent.tab, agent.tab_id, agent.terminal_title_stripped],
    workspace: [agent.workspace, agent.workspace_id],
    worktree: [agent.worktree, agent.cwd, agent.foreground_cwd],
    branch: [agent.branch],
    parent: [agent.parent],
  };
  return aliases[field].find((value) => typeof value === "string" && value.trim()) ?? null;
}

function compareSupervisionIdentity(report, agent) {
  if (!report.identity) return { available: false, matches: false };
  if (!agent) return { available: true, matches: false, missing: true };
  const mismatches = SUPERVISION_ANCHORS.filter((field) => liveAnchor(agent, field) !== report.identity[field]);
  return {
    available: true,
    matches: mismatches.length === 0,
    incomplete: mismatches.some((field) => liveAnchor(agent, field) === null),
    mismatches,
  };
}

export function decideSupervision(value, liveAgent, now = Date.now(), staleMs = 10 * 60_000) {
  const report = parseObject(value, "report");
  const timestamp = typeof now === "number" ? now : Date.parse(now);
  if (!Number.isFinite(timestamp)) throw new Error("now must be a valid timestamp");
  if (!Number.isFinite(staleMs) || staleMs < 0) throw new Error("staleMs must be a non-negative number");

  const identity = compareSupervisionIdentity(report, liveAgent);
  if (!identity.available) {
    return supervisionDirective(report, "IDENTITY_UNAVAILABLE", "REPORT_IDENTITY_MISSING", "VERIFY_LEGACY_REPORT", false, false);
  }
  if (identity.missing) {
    return supervisionDirective(report, "MISSING_AGENT", "AGENT_MISSING", "INSPECT_WORKTREE_AND_REASSIGN", true, false);
  }
  if (!identity.matches) {
    return supervisionDirective(
      report,
      "IDENTITY_DRIFT",
      identity.incomplete ? "LIVE_IDENTITY_INCOMPLETE" : "IDENTITY_DRIFT",
      "ESCALATE_IDENTITY",
      true,
      false,
    );
  }

  if (report.pending_ask || liveAgent.agent_status === "blocked") {
    return supervisionDirective(report, "BLOCKED_HUMAN_PROMPT", "HUMAN_PROMPT_BLOCKED", "SURFACE_PROMPT_TO_HUMAN", false, false);
  }

  if (PENDING.has(report.state) && (liveAgent.agent_status === "idle" || liveAgent.agent_status === "done")) {
    return supervisionDirective(report, "SILENT_REPORT", "REPORT_SILENT", "INSPECT_RECENT_OUTPUT", true, false);
  }

  const updatedAt = Date.parse(report.updated_at);
  if (PENDING.has(report.state) && liveAgent.agent_status === "working" && Number.isFinite(updatedAt) && timestamp - updatedAt > staleMs) {
    return supervisionDirective(report, "STALE_REPORT", "REPORT_STALE", "INSPECT_PROGRESS_OR_ESCALATE", true, false);
  }

  if (TERMINAL.has(report.state)) {
    const acknowledged = report.parent_receipt?.status === "acknowledged"
      && report.parent_receipt.parent === report.identity.parent;
    return supervisionDirective(
      report,
      "TERMINAL_REPORT",
      acknowledged ? "TERMINAL_ACKNOWLEDGED" : "PARENT_ACK_REQUIRED",
      acknowledged ? "RECORD_PARENT_DECISION" : "ACKNOWLEDGE_PARENT",
      false,
      acknowledged,
    );
  }

  return supervisionDirective(report, "EXACT_MATCH", "IDENTITY_MATCH", "NONE", false, false);
}

export function parse(argv) {
  const opts = { check: [], risk: [] };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, "");
    const value = argv[++i];
    if (value === undefined) throw new Error(`missing value for ${argv[i - 1]}`);
    if (key === "check" || key === "risk") opts[key].push(value);
    else opts[key] = value;
  }
  return opts;
}

export function runDir(opts) {
  const run = opts.run ?? process.env.ORCH_RUN;
  if (!run) throw new Error("--run (or ORCH_RUN) is required");
  if (process.env.ORCH_DIR) return resolve(process.env.ORCH_DIR, run);
  const git = spawnSync("git", ["rev-parse", "--git-common-dir"], { encoding: "utf8" });
  if (git.status !== 0) throw new Error("not inside a git repository; set ORCH_DIR");
  return join(resolve(git.stdout.trim()), "orchestrator", run);
}

export const fileFor = (task) => `${task.replace(/[^A-Za-z0-9._-]/g, "-")}.json`;

// Store large evidence payloads into deduplicated files to protect context windows
export function storeEvidence(dir, content) {
  const hash = createHash("sha256").update(content).digest("hex");
  const evidenceDir = join(dir, "evidence");
  mkdirSync(evidenceDir, { recursive: true });
  const evidenceFile = join(evidenceDir, `${hash}.txt`);
  if (!existsSync(evidenceFile)) {
    writeFileSync(evidenceFile, content);
  }
  return `ref:sha256:${hash}`;
}

export function readEvidence(dir, ref) {
  if (typeof ref !== "string" || !/^ref:sha256:[0-9a-f]{64}$/.test(ref)) {
    throw new Error(`invalid evidence reference: ${ref}`);
  }

  const hash = ref.slice("ref:sha256:".length);
  const evidenceDir = resolve(dir, "evidence");
  const evidenceFile = resolve(evidenceDir, `${hash}.txt`);
  let canonicalEvidenceDir;
  let canonicalEvidenceFile;
  try {
    canonicalEvidenceDir = realpathSync(evidenceDir);
    canonicalEvidenceFile = realpathSync(evidenceFile);
  } catch (error) {
    if (error?.code === "ENOENT") throw new Error(`evidence not found for reference: ${ref}`);
    throw error;
  }

  const relativeFile = relative(canonicalEvidenceDir, canonicalEvidenceFile);
  if (!relativeFile || relativeFile === ".." || relativeFile.startsWith(`..${sep}`) || isAbsolute(relativeFile)) {
    throw new Error(`invalid evidence reference: ${ref}`);
  }
  return readFileSync(canonicalEvidenceFile, "utf8");
}

export function report(opts) {
  const dir = runDir(opts);
  if (!opts.task) throw new Error("--task is required");
  if (!STATES.includes(opts.state)) throw new Error(`--state must be one of ${STATES.join(", ")}`);
  const checks = opts.check ?? [];
  for (const c of checks) {
    if (!CHECKS.has(c.split("=").slice(1).join("="))) throw new Error(`--check must be name=${[...CHECKS].join("|")}: ${c}`);
  }
  mkdirSync(dir, { recursive: true });
  const file = join(dir, fileFor(opts.task));

  let evidenceRef = null;
  if (opts.evidence) evidenceRef = storeEvidence(dir, opts.evidence);

  const now = new Date().toISOString();
  let entry = null;
  withLock(file, () => {
    let prev = {};
    try { prev = JSON.parse(readFileSync(file, "utf8")); } catch { /* first report */ }
    const currentIdentity = identityInput(opts);
    assertIdentityContinuity(prev, currentIdentity, opts);
    const failure = opts.failure === undefined ? (FAILURE_STATES.has(opts.state) ? prev.failure : null) : validateFailure(opts.failure);
    if (FAILURE_STATES.has(opts.state) && !failure) throw new Error(`failure is required for ${opts.state} reports`);
    if (!FAILURE_STATES.has(opts.state) && opts.failure !== undefined) throw new Error(`failure is only valid for ${[...FAILURE_STATES].join(" or ")} reports`);
    const delivered = !PENDING.has(opts.state);
    entry = {
      v: "repo-orchestrator/v1",
      kind: opts.state === "ASSIGNED" || opts.state === "WORKING" ? "progress" : "result",
      run: opts.run ?? process.env.ORCH_RUN,
      task: opts.task,
      agent: opts.agent ?? process.env.ORCH_AGENT ?? prev.agent ?? null,
      seq: (prev.seq ?? 0) + 1,
      state: opts.state,
      phase: opts.phase ?? currentIdentity?.phase ?? prev.phase ?? null,
      branch: opts.branch ?? currentIdentity?.branch ?? prev.branch ?? null,
      parent: currentIdentity?.parent ?? prev.parent ?? null,
      sender: currentIdentity ? {
        session: currentIdentity.session,
        tab: currentIdentity.tab,
        workspace: currentIdentity.workspace,
        worktree: currentIdentity.worktree,
        branch: currentIdentity.branch,
      } : (prev.sender ?? null),
      identity: currentIdentity ?? prev.identity,
      lifecycle: currentIdentity?.lifecycle ?? prev.lifecycle ?? null,
      summary: opts.summary ?? "",
      checks: checks.map((c) => ({ name: c.split("=")[0], status: c.split("=").slice(1).join("=") })),
      evidence_ref: evidenceRef ?? prev.evidence_ref ?? null,
      pending_ask: prev.pending_ask ?? null,
      failure,
      delivery: prev.delivery ?? (delivered ? { status: "delivered", delivered_at: now } : null),
      parent_receipt: prev.parent_receipt ?? null,
      risks: opts.risk,
      next: opts.next ?? null,
      created_at: prev.created_at ?? now,
      updated_at: now,
    };
    writeFileSync(`${file}.tmp`, `${JSON.stringify(entry, null, 2)}\n`);
    renameSync(`${file}.tmp`, file);
    appendFileSync(join(dir, "events.jsonl"), `${JSON.stringify({ ...entry, checks: entry.checks.length })}\n`);
  });

  const master = opts.notify ?? process.env.ORCH_MASTER;
  if (master) {
    const msg = `[REPORT ${entry.task} ${entry.state}] ${entry.summary.slice(0, 160)} (run ${entry.run}: mailbox.mjs status --run ${entry.run})`;
    const sent = spawnSync("herdr", ["agent", "prompt", master, msg], { encoding: "utf8" });
    if (sent.status !== 0) console.error(`notify to '${master}' failed; report is still in the mailbox`);
  }
  console.log(`${entry.task} ${entry.state} seq=${entry.seq} -> ${file}`);
}

export function ask(opts) {
  const dir = runDir(opts);
  if (!opts.task) throw new Error("--task is required");
  if (!opts.question) throw new Error("--question is required");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, fileFor(opts.task));
  const now = new Date().toISOString();

  withLock(file, () => {
    let prev = {};
    try { prev = JSON.parse(readFileSync(file, "utf8")); } catch { /* first write */ }
    const entry = {
      ...prev,
      v: "repo-orchestrator/v1",
      run: opts.run ?? process.env.ORCH_RUN,
      task: opts.task,
      agent: opts.agent ?? process.env.ORCH_AGENT ?? prev.agent ?? null,
      state: "BLOCKED",
      seq: (prev.seq ?? 0) + 1,
      pending_ask: { question: opts.question, asked_at: now },
      failure: { kind: "question", code: "parent_input_required", message: opts.question, retryable: true },
      summary: `[QUESTION] ${opts.question}`,
      updated_at: now,
    };
    writeFileSync(`${file}.tmp`, `${JSON.stringify(entry, null, 2)}\n`);
    renameSync(`${file}.tmp`, file);
    appendFileSync(join(dir, "events.jsonl"), `${JSON.stringify({ event: "ask", task: opts.task, question: opts.question, timestamp: now })}\n`);
  });

  const master = opts.notify ?? process.env.ORCH_MASTER;
  if (master) {
    const msg = `[ASK ${opts.task}] ${opts.question.slice(0, 160)} (run ${opts.run}: mailbox.mjs reply --task ${opts.task} --answer <msg>)`;
    spawnSync("herdr", ["agent", "prompt", master, msg], { encoding: "utf8" });
  }
  console.log(`Question recorded for ${opts.task}`);
}

export function reply(opts) {
  const dir = runDir(opts);
  if (!opts.task) throw new Error("--task is required");
  if (!opts.answer) throw new Error("--answer is required");
  const file = join(dir, fileFor(opts.task));
  if (!existsSync(file)) throw new Error(`no report file found for task ${opts.task}`);
  const now = new Date().toISOString();
  let workerAgent = null;

  withLock(file, () => {
    const prev = JSON.parse(readFileSync(file, "utf8"));
    workerAgent = prev.agent;
    const entry = {
      ...prev,
      seq: (prev.seq ?? 0) + 1,
      state: "WORKING",
      pending_ask: null,
      failure: null,
      last_reply: { answer: opts.answer, replied_at: now },
      summary: `[ANSWERED] ${opts.answer}`,
      updated_at: now,
    };
    writeFileSync(`${file}.tmp`, `${JSON.stringify(entry, null, 2)}\n`);
    renameSync(`${file}.tmp`, file);
    appendFileSync(join(dir, "events.jsonl"), `${JSON.stringify({ event: "reply", task: opts.task, answer: opts.answer, timestamp: now })}\n`);
  });

  if (workerAgent) {
    const msg = `[ANSWER from Master] ${opts.answer}`;
    spawnSync("herdr", ["agent", "prompt", workerAgent, msg], { encoding: "utf8" });
  }
  console.log(`Reply sent to ${opts.task}`);
}

export function acknowledge(opts) {
  const dir = runDir(opts);
  if (!opts.task) throw new Error("--task is required");
  if (typeof opts.parent !== "string" || !opts.parent.trim()) throw new Error("--parent is required");
  if (typeof opts.decision !== "string" || !opts.decision.trim()) throw new Error("--decision is required");
  const file = join(dir, fileFor(opts.task));
  if (!existsSync(file)) throw new Error(`no report file found for task ${opts.task}`);
  const now = new Date().toISOString();
  let entry = null;
  withLock(file, () => {
    const prev = JSON.parse(readFileSync(file, "utf8"));
    const expectedParent = prev.identity?.parent ?? prev.parent;
    if (expectedParent && expectedParent !== opts.parent) throw new Error("parent identity mismatch");
    if (!prev.delivery || prev.delivery.status !== "delivered") throw new Error("report has no delivered result to acknowledge");
    entry = {
      ...prev,
      seq: (prev.seq ?? 0) + 1,
      parent_receipt: {
        status: "acknowledged",
        decision: opts.decision,
        parent: opts.parent,
        acknowledged_at: now,
      },
      updated_at: now,
    };
    writeFileSync(`${file}.tmp`, `${JSON.stringify(entry, null, 2)}\n`);
    renameSync(`${file}.tmp`, file);
    appendFileSync(join(dir, "events.jsonl"), `${JSON.stringify({ event: "parent_acknowledgement", task: opts.task, parent: opts.parent, decision: opts.decision, timestamp: now })}\n`);
  });
  console.log(`Acknowledged ${entry.task} seq=${entry.seq}`);
}

export const ack = acknowledge;

function herdrPayload(stdout) {
  try {
    const parsed = JSON.parse(stdout);
    return parsed.result ?? parsed;
  } catch {
    return null;
  }
}

export function liveAgents() {
  const list = spawnSync("herdr", ["agent", "list"], { encoding: "utf8" });
  if (list.status !== 0) return null;
  const payload = herdrPayload(list.stdout);
  if (!Array.isArray(payload?.agents)) return null;
  const byName = new Map();
  for (const a of payload.agents) if (a.name) byName.set(a.name, a);
  return byName;
}

export function liveAgent(name) {
  if (typeof name !== "string" || !name.trim()) return null;
  const listed = liveAgents()?.get(name);
  if (!listed) return null;
  const detail = spawnSync("herdr", ["agent", "get", name], { encoding: "utf8" });
  const payload = detail.status === 0 ? herdrPayload(detail.stdout) : null;
  const agent = { ...listed, ...(payload?.agent ?? {}) };
  const worktree = liveAnchor(agent, "worktree");
  if (!agent.branch && worktree) {
    const branch = spawnSync("git", ["-C", worktree, "branch", "--show-current"], { encoding: "utf8" });
    if (branch.status === 0 && branch.stdout.trim()) agent.branch = branch.stdout.trim();
  }
  if (!agent.parent && process.env.ORCH_MASTER) agent.parent = process.env.ORCH_MASTER;
  return agent;
}

export function supervise(opts) {
  if (!opts.report) throw new Error("--report is required");
  const reportValue = parseObject(opts.report, "report");
  const live = opts.live === undefined ? liveAgent(opts.agent ?? reportValue.agent) : parseObject(opts.live, "live");
  const now = opts.now === undefined ? Date.now() : Date.parse(opts.now);
  const staleMs = opts["stale-min"] === undefined ? 10 * 60_000 : Number(opts["stale-min"]) * 60_000;
  const decision = decideSupervision(reportValue, live, now, staleMs);
  console.log(JSON.stringify(decision));
  return decision;
}

function statusFlag(report, decision) {
  if (decision.outcome === "EXACT_MATCH") return PENDING.has(report.state) ? "OK" : "DECIDE";
  if (decision.outcome === "TERMINAL_REPORT") return decision.completion_permitted && report.state === "CLOSED" ? "OK" : "DECIDE";
  return decision.outcome;
}

export function status(opts) {
  const dir = runDir(opts);
  const staleMs = Number(opts["stale-min"] ?? 10) * 60_000;
  const live = liveAgents();
  const now = Date.now();
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")) : [];
  const rows = files.map((f) => {
    const e = JSON.parse(readFileSync(join(dir, f), "utf8"));
    const agent = live?.get(e.agent);
    const decision = live ? decideSupervision(e, agent, now, staleMs) : null;
    const flag = live ? statusFlag(e, decision) : "NO_HERDR";
    const age = Math.round((now - Date.parse(e.updated_at)) / 60_000);
    return {
      task: e.task,
      agent: e.agent,
      herdr: agent?.agent_status ?? "-",
      state: e.state,
      seq: e.seq,
      age_min: age,
      flag,
      decision: decision?.outcome ?? "-",
      required_action: decision?.required_parent_action ?? "-",
      completion_permitted: decision?.completion_permitted ?? false,
      summary: e.summary.slice(0, 60),
      evidence: e.evidence_ref ?? "-"
    };
  });
  if (opts.json === "true") return console.log(JSON.stringify(rows, null, 2));
  console.table(rows);
  const open = rows.filter((r) => r.flag !== "OK").length;
  console.log(open ? `${open} task(s) need master action` : "all tasks on track or closed");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  try {
    if (cmd === "report") report(parse(rest));
    else if (cmd === "status") status(parse(rest));
    else if (cmd === "supervise") supervise(parse(rest));
    else if (cmd === "ask") ask(parse(rest));
    else if (cmd === "reply") reply(parse(rest));
    else if (cmd === "ack" || cmd === "acknowledge") acknowledge(parse(rest));
    else throw new Error("usage: mailbox.mjs report|status|supervise|ask|reply|ack --run R [...]");
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }
}
