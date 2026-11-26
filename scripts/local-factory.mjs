#!/usr/bin/env node
// Repeatable local factory run: executes only repository-owned deterministic
// gates and reports live Herdr/PiWorkflow dispatch as NOT RUN.
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const NPM = process.platform === "win32" ? "npm.cmd" : "npm";

export const GATES = Object.freeze([
  { id: "capability-preflight", kind: "command", command: "node", args: ["scripts/check.mjs", "--strict"] },
  { id: "roster", kind: "command", command: "node", args: ["scripts/agent-roster-diagnostic.mjs"] },
  { id: "fanout", kind: "command", command: NPM, args: ["run", "test:fanout"] },
  { id: "isolated-commit", kind: "command", command: NPM, args: ["run", "test:fixture"] },
  { id: "diff-check", kind: "command", command: "git", args: ["diff", "--check"] },
  { id: "lint", kind: "command", command: NPM, args: ["run", "lint"] },
  { id: "repo-tests", kind: "command", command: NPM, args: ["test"] },
  { id: "live-fanout", kind: "live", reason: "live Herdr pane fan-out is not executed by the local factory runner" },
  { id: "live-dispatch", kind: "live", reason: "live PiWorkflow agent dispatch is not executed by the local factory runner" },
]);

export const STATUSES = Object.freeze(["PASS", "FAIL", "BLOCKED", "NOT RUN"]);

function commandLine(gate) {
  return gate.kind === "command" ? [gate.command, ...gate.args].join(" ") : "-";
}

function firstProblemLine(result) {
  const text = `${result.stderr ?? ""}\n${result.stdout ?? ""}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  return text === undefined ? null : text.slice(0, 300);
}

function defaultRun({ command, args, cwd }) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32" && command.endsWith(".cmd"),
  });
  if (result.error) throw result.error;
  return { code: result.status ?? 1, stdout: result.stdout, stderr: result.stderr };
}

function evaluate(gate, result) {
  if (gate.kind !== "command") return { status: "NOT RUN", reason: gate.reason };
  if (result.code === 0) return { status: "PASS" };
  const detail = firstProblemLine(result);
  return detail === null ? { status: "FAIL" } : { status: "FAIL", detail };
}

// Read-only: the runner spawns existing repository commands and writes nothing,
// so no worktree, pane, mailbox record, or background process outlives the run.
export function runLocalFactory({ run = defaultRun, cwd = process.cwd() } = {}) {
  const gates = GATES.map((gate) => {
    const record = { id: gate.id, kind: gate.kind, command: commandLine(gate) };
    if (gate.kind !== "command") return { ...record, ...evaluate(gate) };
    try {
      return { ...record, ...evaluate(gate, run({ ...gate, cwd })) };
    } catch (error) {
      return { ...record, status: "BLOCKED", detail: String(error?.message ?? error).slice(0, 300) };
    }
  });

  const summary = Object.fromEntries(STATUSES.map((status) => [status, gates.filter((gate) => gate.status === status).length]));
  return {
    schema: "pi-herdr-orchestration/local-factory-report-v1",
    repository: cwd,
    gates,
    summary,
    ok: summary.FAIL === 0 && summary.BLOCKED === 0,
    artifacts: [],
  };
}

export function formatText(report) {
  const lines = report.gates.map((gate) => {
    const detail = gate.detail ?? gate.reason ?? "";
    return `${gate.status.padEnd(8)}${gate.id.padEnd(24)}${gate.command}${detail ? `  ${detail}` : ""}`;
  });
  lines.push("");
  lines.push(`Summary: ${STATUSES.map((status) => `${status} ${report.summary[status]}`).join(", ")}`);
  lines.push("Artifacts: none created by this runner (read-only; no worktree, pane, mailbox record, or process).");
  return `${lines.join("\n")}\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = runLocalFactory();
  process.stdout.write(process.argv.includes("--json") ? `${JSON.stringify(report, null, 2)}\n` : formatText(report));
  process.exitCode = report.ok ? 0 : 1;
}
