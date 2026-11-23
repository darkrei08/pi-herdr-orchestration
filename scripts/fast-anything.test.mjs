import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  CANDIDATES,
  UsageError,
  appendReport,
  buildScanArgs,
  formatCandidates,
  main,
  parseArguments,
  renderReport,
  reportFile,
  runScan,
} from "./fast-anything.mjs";

function fakeSpawn({ code = 0, stdout = "", stderr = "", error = null } = {}) {
  const calls = [];
  const impl = (bin, args, options) => {
    calls.push({ bin, args, options });
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    process.nextTick(() => {
      if (error) {
        child.emit("error", error);
        return;
      }
      if (stdout) child.stdout.emit("data", stdout);
      if (stderr) child.stderr.emit("data", stderr);
      child.emit("close", code);
    });
    return child;
  };
  return { impl, calls };
}

test("parseArguments accepts only the three safe commands", () => {
  assert.equal(parseArguments(["doctor"]).command, "doctor");
  assert.equal(parseArguments(["list-candidates"]).command, "list-candidates");
  const parsed = parseArguments(["scan", "scripts/flow-sources-check.mjs", "--no-syntax"]);
  assert.equal(parsed.command, "scan");
  assert.equal(parsed.script, "scripts/flow-sources-check.mjs");
  assert.deepEqual(parsed.args, ["--no-syntax"]);
});

test("parseArguments accepts an explicit report date", () => {
  const spaced = parseArguments(["scan", "--date", "2026-11-22", "scripts/flow-sources-check.mjs"]);
  assert.equal(spaced.date, "2026-11-22");
  assert.equal(spaced.script, "scripts/flow-sources-check.mjs");
  const inline = parseArguments(["scan", "--date=2026-11-22", "scripts/flow-sources-check.mjs"]);
  assert.equal(inline.date, "2026-11-22");
});

test("parseArguments refuses unknown commands and non-allowlisted scripts", () => {
  assert.throws(() => parseArguments([]), UsageError);
  assert.throws(() => parseArguments(["port"]), UsageError);
  assert.throws(() => parseArguments(["scan"]), UsageError);
  assert.throws(() => parseArguments(["scan", "scripts/check.mjs"]), UsageError);
  assert.throws(() => parseArguments(["scan", "scripts/lint.mjs"]), UsageError);
  assert.throws(() => parseArguments(["scan", "../scripts/lint.mjs"]), UsageError);
  assert.throws(() => parseArguments(["doctor", "--force"]), UsageError);
  assert.throws(() => parseArguments(["list-candidates", "extra"]), UsageError);
});

test("parseArguments refuses an invalid --date", () => {
  assert.throws(() => parseArguments(["scan", "--date", "2026-13-01", "scripts/flow-sources-check.mjs"]), UsageError);
  assert.throws(() => parseArguments(["scan", "--date", "22-11-2026", "scripts/flow-sources-check.mjs"]), UsageError);
});

test("buildScanArgs keeps every user argument in its own array slot", () => {
  const hostile = ["; touch /tmp/pwned", "$(id)", "`id`", "a b"];
  const args = buildScanArgs("scripts/flow-sources-check.mjs", hostile);
  assert.deepEqual(args, ["scan", "--", "node", "scripts/flow-sources-check.mjs", "; touch /tmp/pwned", "$(id)", "`id`", "a b"]);
  assert.equal(args.length, 8);
});

test("runScan passes an argument array with shell disabled", async () => {
  const fake = fakeSpawn({ code: 0, stdout: "hot path\n" });
  const result = await runScan({ bin: "fast-anything", root: "/repo", script: "scripts/flow-sources-check.mjs", args: ["--x"], spawnImpl: fake.impl });
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout.text, "hot path\n");
  assert.equal(result.stdout.truncated, false);
  assert.equal(fake.calls.length, 1);
  assert.equal(fake.calls[0].bin, "fast-anything");
  assert.deepEqual(fake.calls[0].args, ["scan", "--", "node", "scripts/flow-sources-check.mjs", "--x"]);
  assert.equal(fake.calls[0].options.shell, false);
  assert.equal(fake.calls[0].options.cwd, "/repo");
});

test("runScan bounds captured output", async () => {
  const fake = fakeSpawn({ code: 1, stdout: "0123456789", stderr: "abcdefghij" });
  const result = await runScan({ bin: "fast-anything", root: "/repo", script: "scripts/flow-sources-check.mjs", args: [], spawnImpl: fake.impl, limit: 5 });
  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout.text, "01234");
  assert.equal(result.stdout.truncated, true);
  assert.equal(result.stderr.text, "abcde");
  assert.equal(result.stderr.truncated, true);
});

test("runScan rejects when the binary cannot start", async () => {
  const fake = fakeSpawn({ error: new Error("missing binary") });
  await assert.rejects(
    runScan({ bin: "missing", root: "/repo", script: "scripts/flow-sources-check.mjs", args: [], spawnImpl: fake.impl }),
    /missing binary/,
  );
});

test("renderReport produces a deterministic report shape", () => {
  const entry = {
    date: "2026-11-22",
    script: "scripts/flow-sources-check.mjs",
    args: [],
    exitCode: 0,
    stdout: { text: "hot path\n", truncated: false },
    stderr: { text: "", truncated: false },
  };
  const first = renderReport(entry);
  const second = renderReport({ ...entry });
  assert.equal(first, second);
  assert.match(first, /^## `fast-anything scan -- node scripts\/flow-sources-check\.mjs`/);
  assert.match(first, /- Exit code: 0/);
  assert.match(first, /- Arguments: \(none\)/);
  assert.match(first, /### stdout/);
  assert.match(first, /hot path/);
  assert.match(first, /\(empty\)/);
});

test("renderReport marks truncated streams", () => {
  const rendered = renderReport({
    date: "2026-11-22",
    script: "scripts/flow-sources-check.mjs",
    args: ["--no-syntax"],
    exitCode: 1,
    stdout: { text: "x", truncated: true },
    stderr: { text: "y", truncated: true },
  });
  assert.match(rendered, /- Exit code: 1/);
  assert.match(rendered, /- Arguments: --no-syntax/);
  assert.equal(rendered.match(/\.\.\. \[truncated\]/g).length, 2);
});

test("appendReport writes then appends a dated report", () => {
  const dir = mkdtempSync(join(tmpdir(), "fast-anything-"));
  try {
    const entry = {
      date: "2026-11-22",
      script: "scripts/flow-sources-check.mjs",
      args: [],
      exitCode: 0,
      stdout: { text: "hot path", truncated: false },
      stderr: { text: "", truncated: false },
    };
    const file = reportFile(dir, "2026-11-22");
    const section = renderReport(entry);
    appendReport(file, section, "2026-11-22");
    const first = readFileSync(file, "utf8");
    appendReport(file, section, "2026-11-22");
    const second = readFileSync(file, "utf8");
    assert.match(first, /^# fast-anything scan report 2026-11-22/);
    assert.equal(second, `${first}\n${section}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("candidate list is deterministic and allowlisted", () => {
  assert.deepEqual([...CANDIDATES], ["scripts/flow-sources-check.mjs"]);
  assert.equal(formatCandidates(), [
    "Safe profiling candidates (read-only, no provider inference, no live services):",
    "- scripts/flow-sources-check.mjs",
  ].join("\n"));
  for (const script of CANDIDATES) {
    assert.ok(script.endsWith(".mjs"));
    assert.equal(script.includes(".."), false);
    assert.equal(script.startsWith("/"), false);
  }
});

test("main writes a report and forwards the scan exit code", async () => {
  const dir = mkdtempSync(join(tmpdir(), "fast-anything-"));
  try {
    const fake = fakeSpawn({ code: 3, stdout: "output line\n", stderr: "warn line\n" });
    const code = await main(["scan", "--date", "2026-11-22", "scripts/flow-sources-check.mjs"], {
      bin: "fake",
      root: "/repo",
      reportsDir: dir,
      spawnImpl: fake.impl,
    });
    assert.equal(code, 3);
    const text = readFileSync(reportFile(dir, "2026-11-22"), "utf8");
    assert.match(text, /- Exit code: 3/);
    assert.match(text, /output line/);
    assert.match(text, /warn line/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("main doctor forwards the doctor exit status", async () => {
  const fake = fakeSpawn({ code: 1 });
  const code = await main(["doctor"], { bin: "fake", root: "/repo", reportsDir: "/tmp", spawnImpl: fake.impl });
  assert.equal(code, 1);
  assert.deepEqual(fake.calls[0].args, ["doctor"]);
  assert.equal(fake.calls[0].options.shell, false);
});
