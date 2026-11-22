#!/usr/bin/env node
import { spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CAPTURE_CHARS = 16 * 1024;

export const COMMANDS = Object.freeze(["doctor", "scan", "list-candidates"]);

// Only deterministic, local, read-only entrypoints. Each one was inspected for
// provider inference, network access and filesystem writes before being listed.
// scripts/lint.mjs is excluded because it spawns node --check across the repo;
// profiling it repeatedly creates generated runner code unrelated to this change.
export const CANDIDATES = Object.freeze([
  "scripts/flow-sources-check.mjs",
]);

export const USAGE = [
  "Usage: node scripts/fast-anything.mjs <command>",
  "",
  "Commands:",
  "  doctor                       Run fast-anything doctor",
  "  scan <script> [args...]      Profile an allowlisted script and write a report",
  "  list-candidates              List the safe profiling entrypoints",
  "",
  "Options:",
  "  --date YYYY-MM-DD            Report date for scan (default: today)",
].join("\n");

export class UsageError extends Error {}

function isIsoDate(value) {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function parseArguments(argv, { date = today() } = {}) {
  if (argv.length === 0) throw new UsageError("missing command");
  const [command, ...rest] = argv;
  if (!COMMANDS.includes(command)) throw new UsageError(`refused command: ${command}`);
  if (command === "doctor" || command === "list-candidates") {
    if (rest.length > 0) throw new UsageError(`${command} takes no arguments`);
    return { command, date };
  }

  let remaining = rest;
  let reportDate = date;
  const candidateDate = remaining[0] === "--date" ? remaining[1] : remaining[0]?.startsWith("--date=") ? remaining[0].slice(7) : undefined;
  if (candidateDate !== undefined) {
    if (!isIsoDate(candidateDate)) throw new UsageError(`invalid --date: ${candidateDate}`);
    reportDate = candidateDate;
    remaining = remaining[0] === "--date" ? remaining.slice(2) : remaining.slice(1);
  }

  const script = remaining[0];
  if (script === undefined) throw new UsageError("scan requires a script");
  if (!CANDIDATES.includes(script)) throw new UsageError(`refused script: ${script}`);
  return { command, script, args: remaining.slice(1), date: reportDate };
}

export function buildScanArgs(script, args) {
  return ["scan", "--", "node", script, ...args];
}

export function reportFile(reportsDir, date) {
  return join(reportsDir, `${date}-fast-anything-scan.md`);
}

function createCollector(limit) {
  let text = "";
  let truncated = false;
  return {
    push(chunk) {
      const value = String(chunk);
      const room = limit - text.length;
      if (room <= 0) {
        truncated = true;
        return;
      }
      text += value.slice(0, room);
      if (value.length > room) truncated = true;
    },
    read() {
      return { text, truncated };
    },
  };
}

export function runScan({ bin, root, script, args, spawnImpl = spawn, limit = MAX_CAPTURE_CHARS }) {
  return new Promise((resolvePromise, reject) => {
    const child = spawnImpl(bin, buildScanArgs(script, args), {
      cwd: root,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = createCollector(limit);
    const stderr = createCollector(limit);
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      resolvePromise({
        exitCode: code ?? 1,
        stdout: stdout.read(),
        stderr: stderr.read(),
      });
    });
  });
}

export function runDoctor({ bin, root, spawnImpl = spawn }) {
  return new Promise((resolvePromise, reject) => {
    const child = spawnImpl(bin, ["doctor"], { cwd: root, shell: false, stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => resolvePromise(code ?? 1));
  });
}

function renderStream(label, stream) {
  const body = stream.text.length === 0 ? "(empty)" : stream.text;
  const note = stream.truncated ? "\n... [truncated]" : "";
  return [`### ${label}`, "", "```text", body + note, "```"].join("\n");
}

export function renderReport(entry) {
  const { date, script, args, exitCode, stdout, stderr } = entry;
  const command = ["fast-anything", ...buildScanArgs(script, args)].join(" ");
  const argumentsText = args.length === 0 ? "(none)" : args.join(" ");
  return [
    `## \`${command}\``,
    "",
    `- Date: ${date}`,
    `- Script: \`${script}\``,
    `- Arguments: ${argumentsText}`,
    `- Exit code: ${exitCode}`,
    "",
    renderStream("stdout", stdout),
    "",
    renderStream("stderr", stderr),
    "",
  ].join("\n");
}

export function appendReport(file, section, date) {
  mkdirSync(dirname(file), { recursive: true });
  if (existsSync(file)) {
    appendFileSync(file, `\n${section}`, "utf8");
    return;
  }
  const header = [
    `# fast-anything scan report ${date}`,
    "",
    "Bounded, read-only profiler output generated by `node scripts/fast-anything.mjs scan`.",
    "Only `fast-anything scan` is invoked; no port, verify, enable or bench command runs here.",
    "",
    "",
  ].join("\n");
  writeFileSync(file, `${header}${section}`, "utf8");
}

export function formatCandidates() {
  return [
    "Safe profiling candidates (read-only, no provider inference, no live services):",
    ...CANDIDATES.map((script) => `- ${script}`),
  ].join("\n");
}

export async function main(argv, options = {}) {
  const root = options.root ?? ROOT;
  const reportsDir = options.reportsDir ?? process.env.FAST_ANYTHING_REPORTS_DIR ?? join(root, "reports");
  const bin = options.bin ?? process.env.FAST_ANYTHING_BIN ?? "fast-anything";
  const spawnImpl = options.spawnImpl ?? spawn;
  const parsed = parseArguments(argv, { date: options.date ?? today() });

  if (parsed.command === "list-candidates") {
    process.stdout.write(`${formatCandidates()}\n`);
    return 0;
  }

  if (parsed.command === "doctor") {
    return runDoctor({ bin, root, spawnImpl });
  }

  const result = await runScan({
    bin,
    root,
    script: parsed.script,
    args: parsed.args,
    spawnImpl,
    limit: options.limit,
  });
  if (result.stdout.text.length > 0) process.stdout.write(result.stdout.text);
  if (result.stderr.text.length > 0) process.stderr.write(result.stderr.text);
  const file = reportFile(reportsDir, parsed.date);
  appendReport(file, renderReport({ date: parsed.date, script: parsed.script, args: parsed.args, ...result }), parsed.date);
  process.stdout.write(`\nReport written: ${relative(root, file)}\n`);
  return result.exitCode;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      if (error instanceof UsageError) {
        process.stderr.write(`${error.message}\n\n${USAGE}\n`);
        process.exitCode = 2;
        return;
      }
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    },
  );
}
