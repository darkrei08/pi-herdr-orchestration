import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BOARD_COLUMNS, buildEnvelope, resolveColumn } from "./task-map-envelope.mjs";

export const PR_EVENTS = new Set([
  "opened",
  "ready_for_review",
  "review",
  "checks",
  "changes_requested",
  "approved",
  "merged",
  "closed",
]);

const MAX_EVENTS = 500;
const SCOPE = "pr-envelope-adapter";
const REVIEW_EVENTS = new Set(["opened", "ready_for_review", "review", "changes_requested"]);
const READY_EVENTS = new Set(["checks", "approved"]);
const MERGE_EVENTS = new Set(["merged", "closed"]);

function requireText(value, label) {
  const text = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  if (!text) throw new Error(`${label} is required`);
  return text;
}

function normalizePorts(ports) {
  const source = ports ?? {};
  const inspect = source.inspect ?? {};
  const botFindings = source.botFindings ?? {};
  const ci = source.ci ?? {};
  const approval = source.approval ?? {};
  const mergeability = source.mergeability ?? {};
  const findings = Array.isArray(botFindings.findings) ? botFindings.findings.map((item) => String(item)) : [];
  const merged = mergeability.merge_state !== "DIRTY" && (mergeability.mergeable === true || mergeability.merged === true);
  return {
    inspect: { exists: inspect.exists === true, pullRequest: inspect.pullRequest === true },
    botFindings: { pending: botFindings.pending === true, findings },
    ci: { pending: ci.pending === true, state: ["success", "failure", "pending"].includes(ci.state) ? ci.state : "pending" },
    approval: { pending: approval.pending === true, approved: approval.approved === true },
    mergeability: { pending: mergeability.pending === true, merged, merge_state: String(mergeability.merge_state ?? "UNKNOWN") },
  };
}

function evidenceFor(name, pr, ports) {
  const ciPass = !ports.ci.pending && ports.ci.state === "success";
  const approved = !ports.approval.pending && ports.approval.approved;
  const merged = !ports.mergeability.pending && ports.mergeability.merged;
  const evidence = [
    ports.inspect.exists && ports.inspect.pullRequest ? "id=PASS" : "id=FAIL",
    ports.botFindings.pending ? "bot_review=NOT RUN" : ports.botFindings.findings.length ? "bot_review=FAIL" : "bot_review=PASS",
    ports.ci.pending ? "ci=BLOCKED" : ports.ci.state === "failure" ? "ci=FAIL" : ports.ci.state === "success" ? "ci=PASS" : "ci=NOT RUN",
    ports.approval.pending ? "approval=BLOCKED" : ports.approval.approved ? "approval=PASS" : "approval=FAIL",
  ];
  if (MERGE_EVENTS.has(name)) evidence.push(merged ? "merge=PASS" : "merge=FAIL");
  if (REVIEW_EVENTS.has(name)) evidence.push(`PR#${pr} opened`);
  if (ciPass) evidence.push("checks PASS");
  if (approved) evidence.push("approved by reviewer");
  if (merged && MERGE_EVENTS.has(name)) evidence.push("verified merge");
  return evidence;
}

function delaysFor(name, ports, evidence) {
  const blockers = [];
  const waiting = [];
  const has = (token) => evidence.includes(token);
  if (has("id=FAIL")) blockers.push("id=FAIL");
  if (has("bot_review=FAIL")) blockers.push("bot_review=FAIL");
  if (name === "changes_requested" && has("approval=FAIL")) blockers.push("approval=FAIL");
  if (READY_EVENTS.has(name) && has("ci=FAIL")) blockers.push("ci=FAIL");
  if (name === "merged" && has("merge=FAIL")) blockers.push("merge=FAIL");
  if (READY_EVENTS.has(name)) {
    if (has("ci=BLOCKED")) waiting.push("ci=BLOCKED");
    if (has("approval=BLOCKED")) waiting.push("approval=BLOCKED");
  }
  if (name === "merged" && ports.mergeability.pending) waiting.push("merge=BLOCKED");
  return { blockers, waiting };
}

function stateFor(name, ports, evidence, blockers, waiting) {
  const has = (token) => evidence.includes(token);
  if (blockers.length || waiting.length) return "BLOCKED";
  if (name === "merged" || name === "closed") return has("verified merge") || name === "closed" ? "MERGED" : "BLOCKED";
  if (READY_EVENTS.has(name) && has("checks PASS") && has("approved by reviewer")) return "READY_TO_MERGE";
  if (REVIEW_EVENTS.has(name)) return "PR_OPEN";
  if (!ports.inspect.exists || !ports.inspect.pullRequest) return "BLOCKED";
  return "PR_OPEN";
}

function projectEvent(event, meta) {
  const id = requireText(event.id, "event id");
  const name = requireText(event.event, "event name");
  if (!PR_EVENTS.has(name)) throw new Error(`unsupported PR event ${JSON.stringify(name)}`);
  const pr = Number(event.pr);
  if (!Number.isInteger(pr) || pr <= 0) throw new Error("pr must be a positive integer");
  const timestamp = requireText(event.timestamp, "event timestamp");
  if (Number.isNaN(Date.parse(timestamp))) throw new Error(`invalid event timestamp ${JSON.stringify(timestamp)}`);
  const ports = normalizePorts(event.ports);
  const evidence = evidenceFor(name, pr, ports);
  const { blockers, waiting } = delaysFor(name, ports, evidence);
  const state = stateFor(name, ports, evidence, blockers, waiting);
  const key = `${meta.org}/${meta.repo}/PR#${pr}/${name}/${id}`;
  const related = event.issue === undefined || event.issue === null ? null : `I#${requireText(event.issue, "issue")}`;
  const next = related ? [related] : [];
  const subject = `PR#${pr}${related ? ` (${related})` : ""}`;
  const envelope = buildEnvelope({
    org: meta.org,
    repo: meta.repo,
    ticket: `PR#${pr}`,
    subject,
    source: SCOPE,
    state,
    evidence,
    blockers,
    waiting,
    next,
    summary: `${name}: ${state} [${key}]`,
  }, new Date(timestamp));
  const column = resolveColumn(envelope).column;
  if (!BOARD_COLUMNS.includes(column)) throw new Error(`unmapped board column ${column}`);
  envelope.column = column;
  envelope.event = name;
  envelope.event_id = id;
  envelope.event_timestamp = timestamp;
  envelope.idempotency_key = key;
  envelope.ports = ports;
  const mailbox = {
    task: `PR#${pr}`,
    agent: SCOPE,
    state,
    column,
    summary: envelope.summary,
    evidence,
    blockers,
    waiting,
    next,
    question_id: null,
    flag: blockers.length ? "BLOCKED" : "OK",
    reason: blockers.join("; "),
    budget_block: [],
    branch: event.branch ?? null,
    worktree: event.worktree ?? null,
    related_task: related,
    idempotency_key: key,
  };
  return { envelope, mailbox };
}

export function projectPrEvents(input, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("input must be an object");
  const org = requireText(input.org, "org");
  const repo = requireText(input.repo, "repo");
  if (!Array.isArray(input.events)) throw new Error("events must be an array");
  if (input.events.length > MAX_EVENTS) throw new Error(`too many events: cap is ${MAX_EVENTS}`);
  const seen = new Set();
  const envelopes = [];
  const mailbox = [];
  let duplicates = 0;
  for (const event of input.events) {
    if (!event || typeof event !== "object" || Array.isArray(event)) throw new Error("each event must be an object");
    const id = requireText(event.id, "event id");
    const name = requireText(event.event, "event name");
    const pr = Number(event.pr);
    if (!Number.isInteger(pr) || pr <= 0) throw new Error("pr must be a positive integer");
    const key = `${org}/${repo}/PR#${pr}/${name}/${id}`;
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);
    const projected = projectEvent(event, { org, repo });
    envelopes.push(projected.envelope);
    mailbox.push(projected.mailbox);
  }
  return {
    mode: options.mode === "write" ? "write" : "dry-run",
    source: SCOPE,
    org,
    repo,
    counts: { events: input.events.length, envelopes: envelopes.length, mailbox: mailbox.length, duplicates },
    envelopes,
    mailbox,
  };
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help") args.help = true;
    else if (arg === "--write") args.write = true;
    else if (["--input", "--output", "--audit"].includes(arg)) {
      const value = argv[++i];
      if (!value || value.startsWith("--")) throw new Error(`${arg} requires a path`);
      args[arg.slice(2)] = value;
    } else throw new Error(`unknown argument ${arg}`);
  }
  return args;
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`invalid JSON in ${label}: ${error.message}`);
    throw error;
  }
}

function approvedAudit(path) {
  if (!path) throw new Error("--write requires --audit");
  const audit = readJson(path, "audit");
  if (audit?.approved !== true || audit?.scope !== SCOPE) throw new Error("audit not approved");
  return audit;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write("usage: pr-envelope-adapter.mjs --input <path> --output <path> [--write --audit <path>] [--help]\n");
    return;
  }
  if (!args.input || !args.output) throw new Error("--input and --output are required");
  const mode = args.write ? "write" : "dry-run";
  if (args.write) approvedAudit(args.audit);
  const input = readJson(args.input, "input");
  const output = projectPrEvents(input, { mode });
  mkdirSync(dirname(args.output), { recursive: true });
  writeFileSync(args.output, `${JSON.stringify(output, null, 2)}\n`);
  process.stdout.write(
    `wrote ${args.output} envelopes=${output.counts.envelopes} mailbox=${output.counts.mailbox} duplicates=${output.counts.duplicates} mode=${output.mode}\n`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`pr-envelope-adapter: ${error.message}\n`);
    process.exitCode = 1;
  }
}
