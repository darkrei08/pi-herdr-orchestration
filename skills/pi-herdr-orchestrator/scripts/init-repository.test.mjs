import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const root = join(import.meta.dirname, "../../..");
const script = join(root, "skills/pi-herdr-orchestrator/scripts/init-repository.mjs");

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "orch-init-"));
  const binDir = join(dir, "bin");
  const logPath = join(dir, "codegraph.log");
  const sqzLogPath = join(dir, "sqz.log");
  mkdirSync(join(dir, ".git"), { recursive: true });
  mkdirSync(binDir);
  return { dir, binDir, logPath, sqzLogPath };
}

function installFakeCodegraph(binDir) {
  const binary = join(binDir, "codegraph");
  writeFileSync(binary, `#!/bin/sh
if [ "$1" = "--version" ]; then exit 0; fi
printf '%s\\n' "$*" >> "$CODEGRAPH_LOG"
if [ "$1" = "init" ] && [ "$2" = "-i" ]; then mkdir -p "$3/.codegraph"; fi
`);
  chmodSync(binary, 0o755);
}

function installFakeSqz(binDir) {
  const binary = join(binDir, "sqz");
  writeFileSync(binary, `#!/bin/sh
if [ "$1" = "--version" ]; then exit 0; fi
printf '%s\\n' "$*" >> "$SQZ_LOG"
`);
  chmodSync(binary, 0o755);
}

function runInit({ dir, binDir, logPath, sqzLogPath }, extraArgs = [], options = {}) {
  const args = [script, "--apply", "--dir", dir];
  if (options.codegraph) args.push("--codegraph");
  if (options.sqz) args.push("--sqz");
  args.push(...extraArgs);
  return spawnSync(process.execPath, args, {
    env: {
      ...process.env,
      PATH: `${binDir}:/usr/bin:/bin`,
      CODEGRAPH_LOG: logPath,
      SQZ_LOG: sqzLogPath,
    },
    encoding: "utf8",
  });
}

function cleanup(dir) {
  rmSync(dir, { recursive: true, force: true });
}

function invocations(logPath) {
  try {
    return readFileSync(logPath, "utf8").trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

test("CodeGraph indexes a worktree only when --codegraph is requested", () => {
  const fixture = setup();
  try {
    installFakeCodegraph(fixture.binDir);
    const result = runInit(fixture, [], { codegraph: true });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(invocations(fixture.logPath), [`init -i ${fixture.dir}`]);
  } finally {
    cleanup(fixture.dir);
  }
});

test("CodeGraph skips an existing worktree-local index", () => {
  const fixture = setup();
  try {
    installFakeCodegraph(fixture.binDir);
    mkdirSync(join(fixture.dir, ".codegraph"));
    const result = runInit(fixture, [], { codegraph: true });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(invocations(fixture.logPath), []);
    assert.match(result.stdout, /SKIPPED\s+codegraph.*\.codegraph/);
  } finally {
    cleanup(fixture.dir);
  }
});

test("CodeGraph reports a missing binary as skipped", () => {
  const fixture = setup();
  try {
    const result = runInit(fixture, [], { codegraph: true });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(invocations(fixture.logPath), []);
    assert.match(result.stdout, /SKIPPED\s+codegraph.*not installed/);
  } finally {
    cleanup(fixture.dir);
  }
});

test("CodeGraph does not run by default", () => {
  const fixture = setup();
  try {
    installFakeCodegraph(fixture.binDir);
    const result = runInit(fixture);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(invocations(fixture.logPath), []);
    assert.match(result.stdout, /SKIPPED\s+codegraph.*not requested/);
  } finally {
    cleanup(fixture.dir);
  }
});

test("initial repository detection finds a target nested inside a parent repository", () => {
  const fixture = setup();
  const nestedDir = join(fixture.dir, "nested");
  rmSync(join(fixture.dir, ".git"), { recursive: true, force: true });
  mkdirSync(nestedDir);
  try {
    const git = spawnSync("git", ["init", "-q", "-b", "main"], { cwd: fixture.dir, encoding: "utf8" });
    assert.equal(git.status, 0, git.stderr);
    const result = runInit({ ...fixture, dir: nestedDir });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /CONFIGURED\s+git.*existing Git repository detected/);
    assert.doesNotMatch(result.stdout, /RUN:\s+git init/);
  } finally {
    cleanup(fixture.dir);
  }
});

test("sqz skips an existing Claude hook even when --sqz is requested", () => {
  const fixture = setup();
  const settingsPath = join(fixture.dir, ".claude", "settings.local.json");
  const settings = '{"existing":true}\n';
  try {
    installFakeSqz(fixture.binDir);
    mkdirSync(join(fixture.dir, ".claude"));
    writeFileSync(settingsPath, settings);
    const result = runInit(fixture, [], { sqz: true });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(invocations(fixture.sqzLogPath), []);
    assert.equal(readFileSync(settingsPath, "utf8"), settings);
    assert.match(result.stdout, /CONFIGURED\s+sqz.*project hook detected/);
  } finally {
    cleanup(fixture.dir);
  }
});

test("sqz receives the constrained Claude hook arguments when --sqz is requested", () => {
  const fixture = setup();
  try {
    installFakeSqz(fixture.binDir);
    const result = runInit(fixture, [], { sqz: true });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(invocations(fixture.sqzLogPath), ["init -y --only claude"]);
  } finally {
    cleanup(fixture.dir);
  }
});

test("PiWorkflow preserves formatted settings when current-tab transport is already configured", () => {
  const fixture = setup();
  const settingsPath = join(fixture.dir, ".pi", "pi-extensible-workflows", "settings.json");
  const settings = `{\n  "unrelated": { "keep": true },\n  "extensionSettings": {\n    "other": { "value": 7 },\n    "herdr": { "enableFullyInspectableMode": false, "local": "preserve" }\n  }\n}\n`;
  try {
    mkdirSync(join(fixture.dir, ".pi", "pi-extensible-workflows"), { recursive: true });
    writeFileSync(settingsPath, settings);
    const result = runInit(fixture);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(settingsPath, "utf8"), settings);
    assert.doesNotMatch(result.stdout, /WROTE .*settings\.json/);
    assert.match(result.stdout, /CONFIGURED\s+pi-workflow-herdr.*current-tab sibling-pane/);
  } finally {
    cleanup(fixture.dir);
  }
});
