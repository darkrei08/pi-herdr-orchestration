import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const ENVELOPE_VERSION = "task-map-envelope/v1";
export const BOARD_COLUMNS = Object.freeze([
  "Intake",
  "Spec",
  "Ready",
  "In Progress",
  "Review",
  "Ready to Merge",
  "Blocked/Waiting",
  "Closed",
]);
export const EVENT_FIELDS = Object.freeze([
  "id",
  "timestamp",
  "source",
  "from",
  "to",
  "reason",
  "actor",
  "commit",
  "evidence_ref",
  "revision",
  "event_type",
  "provider",
  "repo",
  "ticket",
  "pi_session_id",
  "workspace_id",
  "tab_id",
  "pane_id",
  "payload_hash",
  "correlation_id",
]);

function list(value) {
  if (Array.isArray(value)) return value;
  return value === undefined || value === null || value === "" || value === "-" ? [] : [value];
}

function sessionIdFromPath(value) {
  const match = String(value ?? "").match(/_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i);
  return match ? match[1] : null;
}

function hash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

const PROGRESS_COLUMNS = BOARD_COLUMNS.filter((column) => column !== "Blocked/Waiting");
const TASK_DOC = /(?:^|\/)odd\/tasks\/[^/\n]+\.md|task[- ]?doc/i;
const OPEN_PR = /\b(?:pr|pull request)\b[^\n]*\b(?:open|opened)\b/i;
const CHECKS_PASS = /\bchecks?\s+PASS\b/i;
const APPROVED = /approv/i;
const VERIFIED_MERGE = /verified\s+merge/i;

export function resolveColumn(envelope) {
  if (list(envelope?.blockers).length || list(envelope?.waiting).length) {
    return { column: "Blocked/Waiting", reason: "blockers/waiting present" };
  }
  const state = String(envelope?.state ?? "").trim().toUpperCase();
  const evidence = list(envelope?.evidence).map((item) => String(item));
  const has = (pattern) => evidence.some((item) => pattern.test(item));

  if (state === "MERGED" || has(VERIFIED_MERGE)) return { column: "Closed", reason: null };
  if (state === "READY_TO_MERGE" || (has(CHECKS_PASS) && has(APPROVED))) {
    return { column: "Ready to Merge", reason: null };
  }
  if (state === "PR_OPEN" || state === "OPEN_PR" || has(OPEN_PR)) {
    return { column: "Review", reason: null };
  }
  if (["WORKING", "DEVELOPMENT", "IN_PROGRESS"].includes(state)) {
    return { column: "In Progress", reason: null };
  }
  if (state === "READY") return { column: "Ready", reason: null };
  if (has(TASK_DOC)) return { column: "Spec", reason: null };
  if (state === "ASSIGNED" || state === "INTAKE") return { column: "Intake", reason: null };
  if (state === "BLOCKED") return { column: "Blocked/Waiting", reason: "state BLOCKED" };
  return { column: "Blocked/Waiting", reason: `Unknown state: ${envelope?.state ?? "UNSET"}` };
}

export function mapEnvelopeToColumn(envelope) {
  return resolveColumn(envelope).column;
}

export function createEvent(envelope, input = {}, now = new Date()) {
  const event = input ?? {};
  const timestamp = event.timestamp ?? now.toISOString();
  const revision = event.revision ?? envelope?.revision ?? 0;
  const core = {
    timestamp,
    source: event.source ?? envelope?.source ?? "envelope",
    from: event.from ?? envelope?.state ?? "UNKNOWN",
    to: event.to ?? event.from ?? envelope?.state ?? "UNKNOWN",
    reason: event.reason ?? "",
    actor: event.actor ?? null,
    commit: event.commit ?? null,
    evidence_ref: event.evidence_ref ?? null,
    revision,
    event_type: event.event_type ?? "transition",
    provider: event.provider ?? null,
    repo: event.repo ?? envelope?.repo ?? null,
    ticket: event.ticket ?? envelope?.ticket ?? null,
    pi_session_id: event.pi_session_id ?? envelope?.pi_session_id ?? null,
    workspace_id: event.workspace_id ?? envelope?.workspace_id ?? null,
    tab_id: event.tab_id ?? envelope?.tab_id ?? null,
    pane_id: event.pane_id ?? envelope?.pane_id ?? null,
    correlation_id: event.correlation_id ?? null,
  };
  const payloadHash = event.payload_hash ?? hash({ ...core, payload: event.payload ?? null });
  const id = event.id ?? hash([payloadHash, core.ticket, core.event_type, revision]).slice(0, 16);
  return {
    id,
    timestamp: core.timestamp,
    source: core.source,
    from: core.from,
    to: core.to,
    reason: core.reason,
    actor: core.actor,
    commit: core.commit,
    evidence_ref: core.evidence_ref,
    revision,
    event_type: core.event_type,
    provider: core.provider,
    repo: core.repo,
    ticket: core.ticket,
    pi_session_id: core.pi_session_id,
    workspace_id: core.workspace_id,
    tab_id: core.tab_id,
    pane_id: core.pane_id,
    payload_hash: payloadHash,
    correlation_id: core.correlation_id,
  };
}

export function appendEvent(envelope, input = {}, now = new Date()) {
  const event = createEvent(envelope, input, now);
  return {
    ...envelope,
    revision: event.revision,
    events: [...list(envelope?.events), event],
  };
}

export function migrateEnvelope(envelope, now = new Date()) {
  if (!envelope) return envelope;
  const isLegacy = !Object.hasOwn(envelope, "events");
  const base = {
    ...envelope,
    v: ENVELOPE_VERSION,
    revision: envelope.revision ?? 0,
    events: list(envelope.events),
  };
  if (!isLegacy) return base;
  if (!Object.hasOwn(envelope, "revision")) base.revision = 0;
  const resolved = resolveColumn(base);
  return appendEvent(base, {
    event_type: "migrated",
    from: envelope.state ?? "UNKNOWN",
    to: resolved.column,
    reason: resolved.reason ?? "legacy envelope migrated",
    source: envelope.source ?? "envelope",
  }, now);
}

export function applyCorrection(envelope, correction = {}, now = new Date()) {
  const revision = (envelope?.revision ?? 0) + 1;
  const first = list(envelope?.events)[0];
  return appendEvent({ ...envelope, revision }, {
    ...correction,
    revision,
    event_type: correction.event_type ?? "correction",
    correlation_id: correction.correlation_id ?? first?.correlation_id ?? first?.id ?? null,
  }, now);
}

function isForwardTransition(from, to) {
  if (from === to || from === "Blocked/Waiting" || to === "Blocked/Waiting") return true;
  const fromIndex = PROGRESS_COLUMNS.indexOf(from);
  const toIndex = PROGRESS_COLUMNS.indexOf(to);
  return fromIndex !== -1 && toIndex !== -1 && toIndex >= fromIndex;
}

export function transitionEnvelope(envelope, patch = {}, options = {}, now = new Date()) {
  const merged = {
    ...envelope,
    ...patch,
    evidence: patch.evidence === undefined ? list(envelope?.evidence) : list(patch.evidence),
    blockers: patch.blockers === undefined ? list(envelope?.blockers) : list(patch.blockers),
    waiting: patch.waiting === undefined ? list(envelope?.waiting) : list(patch.waiting),
    next: patch.next === undefined ? list(envelope?.next) : list(patch.next),
    revision: envelope?.revision ?? 0,
    events: list(envelope?.events),
  };
  const before = resolveColumn(envelope);
  const after = resolveColumn(merged);
  const reason = options.reason ?? patch.reason ?? after.reason ?? "";
  if (before.column !== after.column && !isForwardTransition(before.column, after.column) && !reason) {
    throw new Error(`reopen requires reason: ${before.column} -> ${after.column}`);
  }
  if (before.column === after.column) return merged;

  const first = merged.events[0];
  return appendEvent(merged, {
    ...options,
    source: options.source ?? merged.source ?? "envelope",
    from: before.column,
    to: after.column,
    reason,
    event_type: options.event_type ?? "transition",
    correlation_id: options.correlation_id ?? first?.correlation_id ?? first?.id ?? null,
    payload: options.payload ?? { state: merged.state },
  }, now);
}

export function buildEnvelope(input, now = new Date()) {
  if (!input?.subject || !input?.source || !input?.ticket) {
    throw new Error("Missing subject, source or ticket");
  }
  return {
    v: ENVELOPE_VERSION,
    revision: input.revision ?? 0,
    events: list(input.events),
    created_at: now.toISOString(),
    org: input.org ?? null,
    team: input.team ?? null,
    project: input.project ?? null,
    repo: input.repo ?? null,
    ticket: input.ticket,
    subject: input.subject,
    source: input.source,
    session_name: input.session_name ?? null,
    pi_session_id: input.pi_session_id ?? null,
    workspace_id: input.workspace_id ?? null,
    tab_id: input.tab_id ?? null,
    pane_id: input.pane_id ?? null,
    worktree: input.worktree ?? null,
    branch: input.branch ?? null,
    state: input.state ?? "UNKNOWN",
    evidence: list(input.evidence),
    blockers: list(input.blockers),
    waiting: list(input.waiting),
    next: list(input.next),
    summary: input.summary ?? "",
  };
}

export function fromMailboxAndHerdr(rows, herdr, meta = {}, now = new Date()) {
  const agents = new Map();
  for (const agent of herdr?.result?.agents ?? []) {
    if (agent.name) agents.set(agent.name, agent);
  }
  return list(rows).map((row) => {
    const agent = agents.get(row.agent);
    const waiting = [
      ...(row.flag && row.flag !== "OK" && row.reason ? [row.reason] : []),
      ...list(row.budget_block),
      ...(agent ? [] : ["Herdr identity unavailable"]),
    ];
    return buildEnvelope({
      org: meta.org,
      team: meta.team,
      project: meta.project,
      repo: meta.repo,
      ticket: row.task,
      subject: meta.subject ?? `Ticket ${row.task}`,
      source: meta.source ?? "mailbox",
      session_name: agent?.name ?? row.agent ?? null,
      pi_session_id: sessionIdFromPath(agent?.agent_session?.value),
      workspace_id: agent?.workspace_id ?? null,
      tab_id: agent?.tab_id ?? null,
      pane_id: agent?.pane_id ?? null,
      worktree: agent?.worktree ?? row.worktree ?? null,
      branch: row.branch ?? null,
      state: row.state ?? "UNKNOWN",
      evidence: row.evidence,
      blockers: row.question_id ? [`question ${row.question_id}`] : [],
      waiting,
      next: row.next ?? [],
      summary: row.summary ?? "",
    }, now);
  });
}

export function toTelegramReportInput(envelope) {
  return {
    title: envelope.subject,
    sessions: [{
      name: envelope.session_name ?? envelope.ticket,
      status: envelope.state,
      pane: envelope.pane_id ?? "",
      workspace_id: envelope.workspace_id ?? null,
      tab_id: envelope.tab_id ?? null,
      pi_session_id: envelope.pi_session_id ?? null,
    }],
    evidence: envelope.evidence,
    blockers: envelope.blockers,
    waiting: envelope.waiting,
    next: envelope.next,
    tasks: [`${envelope.ticket}: ${envelope.subject}`],
    text: envelope.summary ?? "",
  };
}

function parseArgs(argv) {
  const args = { "telegram-input": false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--telegram-input") args["telegram-input"] = true;
    else if (arg === "--help") args.help = true;
    else if (["--mailbox", "--herdr", "--repo", "--subject", "--source", "--org", "--team", "--project"].includes(arg)) {
      args[arg.slice(2)] = argv[++i];
    } else throw new Error(`unknown argument ${arg}`);
  }
  return args;
}

function readJson(path, fallback) {
  if (!path) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write("usage: task-map-envelope.mjs --mailbox rows.json --herdr agents.json [--repo R] [--subject S] [--source S] [--org O] [--team T] [--project P] [--telegram-input]\n");
    return;
  }
  const rows = readJson(args.mailbox, []);
  const herdr = readJson(args.herdr, { result: { agents: [] } });
  const meta = {
    org: args.org,
    team: args.team,
    project: args.project,
    repo: args.repo,
    subject: args.subject,
    source: args.source,
  };
  const envelopes = fromMailboxAndHerdr(rows, herdr, meta);
  const output = args["telegram-input"] ? envelopes.map(toTelegramReportInput) : envelopes;
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
