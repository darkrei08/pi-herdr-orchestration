import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BOARD_COLUMNS, buildEnvelope, resolveColumn } from "./task-map-envelope.mjs";

const MAX_STAGES = 500;
const SCOPE = "factory-envelope-adapter";
const ORG = "darkrei08";
const FACTORY_LABEL = "factory";
const GATES = new Set(["PASS", "FAIL", "BLOCKED"]);
const KIND_STATE = Object.freeze({
  intake: "INTAKE",
  spec: "INTAKE",
  ready: "READY",
  development: "WORKING",
  review: "PR_OPEN",
  ready_to_merge: "READY_TO_MERGE",
  merged: "MERGED",
  closed: "MERGED",
});

function requireText(value, label) {
  const text = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  if (!text) throw new Error(`${label} is required`);
  return text;
}

function list(value) {
  return Array.isArray(value) ? value.filter((item) => item !== null && item !== undefined && item !== "") : [];
}

function validateRepos(repos) {
  if (!Array.isArray(repos) || repos.length === 0) throw new Error("repos must be a non-empty array");
  const allowed = new Set();
  for (const entry of repos) {
    if (!entry || typeof entry !== "object") throw new Error("each repo must be an object");
    const name = requireText(entry.repo, "repo");
    if (!list(entry.labels).includes(FACTORY_LABEL)) throw new Error(`factory label required for ${name}`);
    const issues = entry.permissions?.issues ?? {};
    if (issues.read !== true || issues.write !== true || entry.permissions?.wayfinder !== true) {
      throw new Error(`read/write issues and Wayfinder required for ${name}`);
    }
    if (entry.audit?.scope !== "full in-repo" || !requireText(entry.audit?.report, "repo audit report")) {
      throw new Error(`full in-repo audit required for ${name}`);
    }
    allowed.add(name);
  }
  return allowed;
}

function projectStage(stage, meta) {
  if (!stage || typeof stage !== "object" || Array.isArray(stage)) throw new Error("each stage must be an object");
  const id = requireText(stage.id, "stage id");
  const kind = requireText(stage.kind, "stage kind");
  if (!(kind in KIND_STATE)) throw new Error(`unsupported factory stage kind ${JSON.stringify(kind)}`);
  const gate = requireText(stage.gate, "gate").toUpperCase();
  if (!GATES.has(gate)) throw new Error("gate must be PASS, FAIL or BLOCKED");
  const issue = Number(stage.issue);
  if (!Number.isInteger(issue) || issue <= 0) throw new Error("issue must be a positive integer");
  const repo = requireText(stage.repo, "stage repo");
  if (!meta.repos.has(repo)) throw new Error(`repo ${repo} is outside the factory intake filter`);
  if (stage.triage !== "master" || !requireText(stage.priority, "priority")) throw new Error("master triage and priority required");
  if (stage.concepts_source !== "GPL reference") throw new Error("concepts must come from the GPL reference");
  const localAuthority = list(stage.local_authority).map((item) => String(item));
  if (!localAuthority.some((item) => /(?:^|\/)odd\/tasks\/[^/\n]+\.md|task[- ]?doc/i.test(item))) {
    throw new Error("ODD task docs and logs remain local authority");
  }
  const timestamp = requireText(stage.timestamp, "stage timestamp");
  if (Number.isNaN(Date.parse(timestamp))) throw new Error(`invalid stage timestamp ${JSON.stringify(timestamp)}`);
  const state = gate === "PASS" ? KIND_STATE[kind] : "BLOCKED";
  const evidence = list(stage.evidence).slice(0, 20).map((item) => String(item));
  const blockers = gate === "FAIL" ? [`gate ${gate}`] : [];
  const waiting = gate === "BLOCKED" ? [`gate ${gate}`] : [];
  const ticket = `I#${issue}`;
  const envelope = buildEnvelope({
    org: meta.org,
    repo,
    ticket,
    subject: requireText(stage.subject, "stage subject"),
    source: SCOPE,
    state,
    evidence: [...evidence, `factory ${kind}`, `gate ${gate}`],
    blockers,
    waiting,
    next: list(stage.next),
    summary: `${kind}: ${gate} [${meta.org}/${repo}/${ticket}/${kind}/${id}]`,
  }, new Date(timestamp));
  const column = resolveColumn(envelope).column;
  if (!BOARD_COLUMNS.includes(column)) throw new Error(`unmapped board column ${column}`);
  envelope.column = column;
  envelope.gate = gate;
  envelope.factory_stage = kind;
  envelope.local_authority = localAuthority;
  envelope.concepts_source = stage.concepts_source;
  envelope.triage = stage.triage;
  envelope.priority = requireText(stage.priority, "priority");
  envelope.idempotency_key = `${meta.org}/${repo}/${ticket}/${kind}/${id}`;
  const writeback = {
    target: `${meta.org}/${repo}/${ticket}`,
    action: "project-column",
    column,
    state,
    gate,
    authority: "local",
    live_write: false,
    idempotency_key: envelope.idempotency_key,
  };
  return { envelope, writeback };
}

export function projectFactoryEvidence(input, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("input must be an object");
  if (input.org !== ORG) throw new Error(`org must be ${ORG}`);
  const repos = validateRepos(input.repos);
  if (input.audit?.scope !== "full in-repo" || !requireText(input.audit?.report, "audit report")) {
    throw new Error("full in-repo audit required");
  }
  if (!Array.isArray(input.stages)) throw new Error("stages must be an array");
  if (input.stages.length > MAX_STAGES) throw new Error(`too many stages: cap is ${MAX_STAGES}`);
  const mode = options.mode === "write" ? "write" : "dry-run";
  const enabled = mode === "write" && options.enabled !== false;
  const envelopes = [];
  const writeback = [];
  let blocked = 0;
  for (const stage of input.stages) {
    const projected = projectStage(stage, { org: input.org, repos });
    envelopes.push(projected.envelope);
    writeback.push(projected.writeback);
    if (projected.envelope.column === "Blocked/Waiting") blocked += 1;
  }
  return {
    mode,
    source: SCOPE,
    org: input.org,
    enabled,
    network: 0,
    columns: [...BOARD_COLUMNS],
    writeback_requested: input.writeback_requested === true,
    counts: { stages: input.stages.length, envelopes: envelopes.length, writeback: writeback.length, blocked },
    envelopes,
    writeback,
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
    process.stdout.write("usage: factory-envelope-adapter.mjs --input <path> --output <path> [--write --audit <path>] [--help]\n");
    return;
  }
  if (!args.input || !args.output) throw new Error("--input and --output are required");
  const mode = args.write ? "write" : "dry-run";
  if (args.write) approvedAudit(args.audit);
  const input = readJson(args.input, "input");
  if (args.write && input?.audit?.approved !== true) throw new Error("audit report not approved");
  const output = projectFactoryEvidence(input, { mode });
  mkdirSync(dirname(args.output), { recursive: true });
  writeFileSync(args.output, `${JSON.stringify(output, null, 2)}\n`);
  process.stdout.write(
    `wrote ${args.output} envelopes=${output.counts.envelopes} writeback=${output.counts.writeback} blocked=${output.counts.blocked} mode=${output.mode} enabled=${output.enabled}\n`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`factory-envelope-adapter: ${error.message}\n`);
    process.exitCode = 1;
  }
}
