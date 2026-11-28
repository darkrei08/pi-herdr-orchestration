#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export class UsageError extends Error {}

const USAGE = "usage: windows-matrix --input <fixture.json> [--output <report.txt>] [--help]";

export const MODES = Object.freeze(["plan", "dry-run"]);
export const STATUS_EXIT = Object.freeze({ "NOT RUN": 1, BLOCKED: 2, FAIL: 3, PASS: 0 });
export const FULL_SCOPE = "full-ssh+full-suite";

export const CHECKS = Object.freeze([
  { id: "herdr-app-version", label: "Herdr App version" },
  { id: "os", label: "OS" },
  { id: "session-inventory", label: "session inventory" },
  { id: "workspace-tab-pane", label: "workspace/tab/pane" },
  { id: "ui", label: "UI" },
  { id: "screenshots", label: "screenshots" },
  { id: "connectivity", label: "connectivity" },
  { id: "full-ssh", label: "full SSH" },
  { id: "full-suite", label: "full test suite" },
]);

const AUDIT_EVENT_FIELDS = Object.freeze(["id", "type", "ticket", "actor", "evidence_ref", "created_at"]);

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function scopeTokens(value) {
  const values = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[+,]/) : [];
  return values.map((item) => String(item).trim().toLowerCase()).filter(Boolean);
}

function approvalText(value) {
  const direct = text(value);
  if (direct) return direct;
  if (value && typeof value === "object" && (value.granted === true || value.approved === true)) {
    return text(value.by ?? value.id ?? value.approver);
  }
  return null;
}

export function validateTarget(input) {
  const source = input && typeof input === "object" ? input : {};
  const target = source.target && typeof source.target === "object" ? source.target : source;
  const errors = [];
  const mode = source.mode ?? "plan";
  const executionRequested =
    source.execute === true || source.command === "execute" || !MODES.includes(mode);
  const destructive = source.destructive === true || target.destructive === true;

  if (!MODES.includes(mode)) errors.push(`unsupported mode ${String(mode)}; only plan and dry-run are allowed`);
  if (source.execute === true || source.command === "execute") errors.push("execution requests are rejected locally");

  const host = text(target.host);
  if (!host) errors.push("missing explicit host");
  const user = text(target.user);
  if (!user) errors.push("missing user; explicit user required");

  const originalScope = target.scope;
  const tokens = scopeTokens(originalScope);
  const hasFullSsh = tokens.includes("full-ssh");
  const hasFullSuite = tokens.includes("full-suite") || tokens.includes("full-test-suite");
  if (!originalScope) {
    errors.push(`missing explicit scope (${FULL_SCOPE} required)`);
  } else if (!hasFullSsh || !hasFullSuite) {
    errors.push(`scope must include ${FULL_SCOPE}; missing ${!hasFullSsh ? "full-ssh" : "full-suite"}`);
  }

  const backup = text(target.backup ?? target.backupTarget ?? target.snapshot ?? target.snapshotTarget);
  if (!backup) errors.push("missing backup/snapshot target");
  if (destructive && !backup) errors.push("destructive request requires backup/snapshot target");

  const approval = approvalText(target.approval ?? source.approval);
  if (!approval) errors.push("missing explicit approval");

  return {
    ok: errors.length === 0,
    errors,
    executionRequested,
    destructive,
    mode,
    target: {
      host,
      user,
      scope: text(Array.isArray(originalScope) ? originalScope.join("+") : originalScope),
      backup,
      approval,
    },
  };
}

export function collectAuditRecords(input) {
  const source = input && typeof input === "object" ? input : {};
  const envelopes = Array.isArray(source.envelopes)
    ? source.envelopes
    : source.envelope
      ? [source.envelope]
      : [];
  const evidence = envelopes.flatMap((envelope) =>
    Array.isArray(envelope?.evidence) ? envelope.evidence.map((item) => String(item)) : [],
  );
  const events = envelopes.flatMap((envelope) =>
    Array.isArray(envelope?.events)
      ? envelope.events.map((event) => {
          const record = {};
          for (const field of AUDIT_EVENT_FIELDS) {
            if (event?.[field] !== undefined && event[field] !== null) record[field] = event[field];
          }
          return record;
        })
      : [],
  );
  return { envelopeCount: envelopes.length, evidence, events };
}

export function classifyRow({ validation, check }) {
  if (validation.executionRequested) {
    return {
      ...check,
      status: "FAIL",
      detail: "execution requests are rejected locally; plan and dry-run only",
    };
  }
  if (!validation.ok) {
    return { ...check, status: "BLOCKED", detail: `gate: ${validation.errors.join("; ")}` };
  }
  return {
    ...check,
    status: "NOT RUN",
    detail: `${validation.mode} only; live execution not attempted`,
  };
}

export function countRows(rows) {
  const counts = { pass: 0, blocked: 0, fail: 0, "not-run": 0 };
  for (const row of rows) counts[row.status.toLowerCase().replaceAll(" ", "-")] += 1;
  return counts;
}

export function planMatrix(input, options = {}) {
  const validation = validateTarget(input);
  const rows = CHECKS.map((check) => classifyRow({ validation, check }));
  return {
    mode: validation.mode,
    target: validation.target,
    validation,
    rows,
    counts: countRows(rows),
    audit: collectAuditRecords(input),
    network: 0,
    ssh: 0,
    spawn: 0,
    changes: 0,
    destructive: validation.destructive ? "planned" : "false",
    execution: 0,
    inputPath: options.inputPath ?? "-",
    outputPath: options.outputPath ?? "-",
  };
}

function auditValue(value) {
  return String(value).replace(/[\r\n]+/g, " ").trim() || "-";
}

function eventLine(event) {
  const fields = AUDIT_EVENT_FIELDS.filter((field) => event[field] !== undefined);
  return fields.map((field) => `${field}=${auditValue(event[field])}`).join(" ");
}

export function renderResults(plan) {
  return [
    `input=${auditValue(plan.inputPath)}`,
    `output=${auditValue(plan.outputPath)}`,
    `mode=${auditValue(plan.mode)}`,
    `host=${auditValue(plan.target.host)}`,
    `user=${auditValue(plan.target.user)}`,
    `scope=${auditValue(plan.target.scope)}`,
    `backup=${auditValue(plan.target.backup)}`,
    `approval=${auditValue(plan.target.approval)}`,
    `destructive=${auditValue(plan.destructive)}`,
    `execution=${plan.execution} network=${plan.network} ssh=${plan.ssh} spawn=${plan.spawn} changes=${plan.changes}`,
    `audit_envelopes=${plan.audit.envelopeCount}`,
    ...plan.audit.evidence.map((item, index) => `evidence[${index}]=${auditValue(item)}`),
    ...plan.audit.events.map((event, index) => `event[${index}]=${eventLine(event)}`),
    `checks=${plan.rows.length}`,
    ...plan.rows.map(
      (row) => `id=${row.id} label="${auditValue(row.label)}" status=${row.status} detail="${auditValue(row.detail)}"`,
    ),
    `summary pass=${plan.counts.pass} blocked=${plan.counts.blocked} fail=${plan.counts.fail} not-run=${plan.counts["not-run"]}`,
  ].join("\n");
}

export function exitCodeFor(results) {
  return results.reduce((max, row) => Math.max(max, STATUS_EXIT[row.status] ?? STATUS_EXIT.FAIL), 0);
}

export function parseArguments(argv) {
  if (argv.length === 0) throw new UsageError(USAGE);
  const args = { help: false, input: null, output: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--input") {
      args.input = argv[++index];
      if (!args.input) throw new UsageError("--input requires a path");
    } else if (arg.startsWith("--input=")) {
      args.input = arg.slice("--input=".length);
    } else if (arg === "--output") {
      args.output = argv[++index];
      if (!args.output) throw new UsageError("--output requires a path");
    } else if (arg.startsWith("--output=")) {
      args.output = arg.slice("--output=".length);
    } else {
      throw new UsageError(`unknown argument: ${arg}`);
    }
  }
  return args;
}

export function main(argv, { stdout = process.stdout, readFile = readFileSync, writeFile = writeFileSync } = {}) {
  const args = parseArguments(argv);
  if (args.help) {
    stdout.write(`${USAGE}\n`);
    return 0;
  }
  if (!args.input) throw new UsageError(USAGE);

  const input = JSON.parse(readFile(args.input, "utf8"));
  const plan = planMatrix(input, { inputPath: args.input, outputPath: args.output ?? "-" });
  const rendered = renderResults(plan);
  if (args.output) writeFile(args.output, `${rendered}\n`, "utf8");
  stdout.write(`${rendered}\n`);

  const code = exitCodeFor(plan.rows);
  return code === STATUS_EXIT["NOT RUN"] ? 0 : code;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  }
}
