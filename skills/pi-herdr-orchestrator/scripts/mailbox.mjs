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
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { withLock } from "./lock.mjs";

export const STATES = ["ASSIGNED", "WORKING", "READY", "DEVELOPMENT", "BLOCKED", "FAILED", "CLOSED"];
const PENDING = new Set(["ASSIGNED", "WORKING"]);
const CHECKS = new Set(["PASS", "FAIL", "BLOCKED", "NOT RUN"]);

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
  return `ref:sha256:${hash.slice(0, 16)}`;
}

export function report(opts) {
  const dir = runDir(opts);
  if (!opts.task) throw new Error("--task is required");
  if (!STATES.includes(opts.state)) throw new Error(`--state must be one of ${STATES.join(", ")}`);
  for (const c of opts.check) {
    if (!CHECKS.has(c.split("=").slice(1).join("="))) throw new Error(`--check must be name=${[...CHECKS].join("|")}: ${c}`);
  }
  mkdirSync(dir, { recursive: true });
  const file = join(dir, fileFor(opts.task));

  let evidenceRef = null;
  if (opts.evidence) {
    evidenceRef = storeEvidence(dir, opts.evidence);
  }

  const now = new Date().toISOString();
  let entry = null;

  withLock(file, () => {
    let prev = {};
    try { prev = JSON.parse(readFileSync(file, "utf8")); } catch { /* first report */ }
    entry = {
      v: "repo-orchestrator/v1",
      kind: opts.state === "ASSIGNED" || opts.state === "WORKING" ? "progress" : "result",
      run: opts.run ?? process.env.ORCH_RUN,
      task: opts.task,
      agent: opts.agent ?? process.env.ORCH_AGENT ?? prev.agent ?? null,
      seq: (prev.seq ?? 0) + 1,
      state: opts.state,
      phase: opts.phase ?? prev.phase ?? null,
      branch: opts.branch ?? prev.branch ?? null,
      summary: opts.summary ?? "",
      checks: opts.check.map((c) => ({ name: c.split("=")[0], status: c.split("=").slice(1).join("=") })),
      evidence_ref: evidenceRef ?? prev.evidence_ref ?? null,
      pending_ask: prev.pending_ask ?? null,
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

export function liveAgents() {
  const list = spawnSync("herdr", ["agent", "list"], { encoding: "utf8" });
  if (list.status !== 0) return null;
  try {
    const byName = new Map();
    for (const a of JSON.parse(list.stdout).result.agents) if (a.name) byName.set(a.name, a);
    return byName;
  } catch {
    return null;
  }
}

export function status(opts) {
  const dir = runDir(opts);
  const staleMs = Number(opts["stale-min"] ?? 10) * 60_000;
  const live = liveAgents();
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")) : [];
  const rows = files.map((f) => {
    const e = JSON.parse(readFileSync(join(dir, f), "utf8"));
    const agent = live?.get(e.agent);
    const flag = live ? classify(e, agent, Date.now(), staleMs) : "NO_HERDR";
    const age = Math.round((Date.now() - Date.parse(e.updated_at)) / 60_000);
    return {
      task: e.task,
      agent: e.agent,
      herdr: agent?.agent_status ?? "-",
      state: e.state,
      seq: e.seq,
      age_min: age,
      flag,
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
    else if (cmd === "ask") ask(parse(rest));
    else if (cmd === "reply") reply(parse(rest));
    else throw new Error("usage: mailbox.mjs report|status|ask|reply --run R [...]");
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }
}
