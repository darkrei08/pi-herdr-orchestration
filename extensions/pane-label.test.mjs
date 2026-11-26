import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { LIFECYCLE_STATES, fileFor, paneLabel, renamePane } from "../skills/pi-herdr-orchestrator/scripts/mailbox.mjs";
import registerExtension from "./index.mjs";

const EXPECTED = {
  ASSIGNED: "I#84 PENDING",
  WORKING: "I#84 RUNNING",
  READY: "I#84 READY",
  DEVELOPMENT: "I#84 RUNNING",
  BLOCKED: "I#84 BLOCKED",
  FAILED: "I#84 FAILED",
  CLOSED: "I#84 CLOSED",
};

const cleanEnv = (t) => {
  const saved = {};
  for (const key of ["ORCH_MASTER", "ORCH_AGENT", "HERDR_PANE_ID"]) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  t.after(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
};

const recorder = (result = { status: 0, stdout: "", stderr: "" }) => {
  const calls = [];
  const run = (command, args, options) => {
    calls.push({ command, args, options });
    if (result instanceof Error) throw result;
    return result;
  };
  return { calls, run };
};

// Drives the real orch_report tool in a throwaway orchestration directory with
// injected Herdr process dependencies, so no live pane is ever renamed.
const orchestrate = (t, { run = recorder().run, warn = () => {} } = {}) => {
  cleanEnv(t);
  const root = mkdtempSync(join(tmpdir(), "orch-pane-label-"));
  const previousDir = process.env.ORCH_DIR;
  process.env.ORCH_DIR = root;
  t.after(() => {
    if (previousDir === undefined) delete process.env.ORCH_DIR;
    else process.env.ORCH_DIR = previousDir;
    rmSync(root, { recursive: true, force: true });
  });
  const tools = new Map();
  registerExtension({ registerTool: (tool) => tools.set(tool.name, tool), registerCommand: () => {} }, { run, warn });
  const reportTool = tools.get("orch_report");
  const dir = join(root, "pane-label-run");
  const params = { run: "pane-label-run", silent: true };
  return {
    call: (next) => reportTool.execute("pane-label", { ...params, ...next }),
    stored: (task) => JSON.parse(readFileSync(join(dir, fileFor(task)), "utf8")),
  };
};

test("the pane label is the task id plus the upper case derived lifecycle", () => {
  for (const [state, label] of Object.entries(EXPECTED)) {
    assert.equal(paneLabel("I#84", state), label);
  }
  assert.equal(paneLabel("PR#127", "ASSIGNED"), "PR#127 PENDING");
  for (const lifecycle of LIFECYCLE_STATES) {
    assert.equal(paneLabel("F#7", lifecycle), `F#7 ${lifecycle.toUpperCase()}`);
  }
  assert.equal(paneLabel("I#84", ""), "I#84 UNKNOWN");
});

test("renamePane issues exactly herdr pane rename <PANE_ID> <LABEL>", () => {
  const { calls, run } = recorder();
  assert.equal(renamePane("w7D:p1", "I#84 RUNNING", { run, warn: () => {} }), "I#84 RUNNING");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, "herdr");
  assert.deepEqual(calls[0].args, ["pane", "rename", "w7D:p1", "I#84 RUNNING"]);
});

test("renamePane skips an unknown pane with a warning and no command", () => {
  const warnings = [];
  const { calls, run } = recorder();
  assert.equal(renamePane(undefined, "I#84 BLOCKED", { run, warn: (message) => warnings.push(message) }), null);
  assert.equal(calls.length, 0);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /ORCH_PANE_LABEL_SKIPPED/);
  assert.match(warnings[0], /I#84 BLOCKED/);
});

test("renamePane survives absent or failing Herdr", () => {
  const absent = recorder(new Error("spawnSync herdr ENOENT"));
  const absentWarnings = [];
  assert.equal(renamePane("w7D:p1", "I#84 READY", { run: absent.run, warn: (m) => absentWarnings.push(m) }), null);
  assert.match(absentWarnings[0], /ORCH_PANE_LABEL_SKIPPED/);

  const failing = recorder({ status: 3, stdout: "", stderr: "no such pane" });
  const failingWarnings = [];
  assert.equal(renamePane("w7D:p1", "I#84 READY", { run: failing.run, warn: (m) => failingWarnings.push(m) }), null);
  assert.match(failingWarnings[0], /ORCH_PANE_LABEL_SKIPPED/);

  const spawnError = recorder({ status: null, error: new Error("ENOENT"), stderr: "" });
  const spawnWarnings = [];
  assert.equal(renamePane("w7D:p1", "I#84 READY", { run: spawnError.run, warn: (m) => spawnWarnings.push(m) }), null);
  assert.match(spawnWarnings[0], /ORCH_PANE_LABEL_SKIPPED/);
});

test("every orch_report renames the reporting agent pane from the stored task and derived lifecycle", async (t) => {
  const { calls, run } = recorder();
  const { call, stored } = orchestrate(t, { run });
  const pane = "w7D:p1";

  for (const state of ["ASSIGNED", "WORKING", "DEVELOPMENT", "BLOCKED"]) {
    await call({ task: "I#84", state, summary: state.toLowerCase(), pane });
  }

  assert.ok(calls.every((entry) => entry.command === "herdr" && entry.args[1] === "rename" && entry.args[2] === pane));
  assert.deepEqual(calls.map((entry) => entry.args[3]), ["I#84 PENDING", "I#84 RUNNING", "I#84 RUNNING", "I#84 BLOCKED"]);
  assert.equal(stored("I#84").state, "BLOCKED");
});

test("the label follows the stored lifecycle, not the requested state or free text", async (t) => {
  const { calls, run } = recorder();
  const { call, stored } = orchestrate(t, { run });

  await call({ task: "I#84", state: "WORKING", summary: "work in progress", pane: "w7D:p1" });
  // READY without a candidate and evidence binding is downgraded to BLOCKED on write.
  await call({ task: "I#84", state: "READY", summary: "self declared ready", phase: "REVIEW", branch: "feat/x" });

  assert.equal(stored("I#84").state, "BLOCKED");
  assert.deepEqual(calls.map((entry) => entry.args), [
    ["pane", "rename", "w7D:p1", "I#84 RUNNING"],
    ["pane", "rename", "w7D:p1", "I#84 BLOCKED"],
  ]);
});

test("the pane falls back to HERDR_PANE_ID when the report carries no pane", async (t) => {
  const { calls, run } = recorder();
  const { call } = orchestrate(t, { run });
  process.env.HERDR_PANE_ID = "w7D:p7";
  await call({ task: "PR#127", state: "ASSIGNED", summary: "assigned" });
  assert.deepEqual(calls.map((entry) => entry.args), [["pane", "rename", "w7D:p7", "PR#127 PENDING"]]);
});

test("a report without a pane identity still persists and only warns", async (t) => {
  const warnings = [];
  const { calls, run } = recorder();
  const { call, stored } = orchestrate(t, { run, warn: (message) => warnings.push(message) });
  const result = await call({ task: "I#85", state: "ASSIGNED", summary: "no pane known" });
  assert.match(result.content[0].text, /I#85 ASSIGNED/);
  assert.equal(calls.length, 0);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /ORCH_PANE_LABEL_SKIPPED/);
  assert.equal(stored("I#85").state, "ASSIGNED");
});

test("a report with absent Herdr still persists and only warns", async (t) => {
  const warnings = [];
  const failing = recorder(new Error("spawnSync herdr ENOENT"));
  const { call, stored } = orchestrate(t, { run: failing.run, warn: (message) => warnings.push(message) });
  const result = await call({ task: "I#86", state: "WORKING", summary: "herdr missing", pane: "w7D:p9" });
  assert.match(result.content[0].text, /I#86 WORKING/);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /ORCH_PANE_LABEL_SKIPPED/);
  assert.equal(stored("I#86").state, "WORKING");
});
