import assert from "node:assert/strict";
import test from "node:test";
import { GATES, formatText, runLocalFactory } from "./local-factory.mjs";

const LIVE = GATES.filter((gate) => gate.kind === "live").map((gate) => gate.id);
const DETERMINISTIC = GATES.filter((gate) => gate.kind === "command").map((gate) => gate.id);

function recorder(overrides = {}) {
  const called = [];
  const run = (gate) => {
    called.push(gate.id);
    const code = overrides[gate.id] ?? 0;
    if (code instanceof Error) throw code;
    return { code };
  };
  return { called, run };
}

test("executes every deterministic gate once and never the live ones", () => {
  const { called, run } = recorder();
  const report = runLocalFactory({ run });

  assert.deepEqual(called, DETERMINISTIC);
  assert.deepEqual(report.gates.map((gate) => gate.id), [...DETERMINISTIC, ...LIVE]);
  for (const id of DETERMINISTIC) {
    assert.equal(report.gates.find((gate) => gate.id === id).status, "PASS", `${id} should pass`);
  }
  for (const id of LIVE) {
    const gate = report.gates.find((entry) => entry.id === id);
    assert.equal(gate.status, "NOT RUN");
    assert.match(gate.reason, /not executed/);
  }
  assert.deepEqual(report.summary, { PASS: DETERMINISTIC.length, FAIL: 0, BLOCKED: 0, "NOT RUN": LIVE.length });
  assert.equal(report.ok, true);
  assert.deepEqual(report.artifacts, []);
});

test("reports FAIL and BLOCKED separately from PASS and NOT RUN", () => {
  const { run } = recorder({ roster: 1, fanout: new Error("spawn npm ENOENT") });
  const report = runLocalFactory({ run });

  const status = (id) => report.gates.find((gate) => gate.id === id).status;
  assert.equal(status("capability-preflight"), "PASS");
  assert.equal(status("roster"), "FAIL");
  assert.equal(status("fanout"), "BLOCKED");
  assert.equal(status("repo-tests"), "PASS");
  assert.equal(status("live-fanout"), "NOT RUN");
  assert.match(report.gates.find((gate) => gate.id === "fanout").detail, /ENOENT/);
  assert.equal(report.summary.FAIL, 1);
  assert.equal(report.summary.BLOCKED, 1);
  assert.equal(report.ok, false);
});

test("records the exact repository commands for every executed gate", () => {
  const { run } = recorder();
  const report = runLocalFactory({ run });

  assert.deepEqual(
    report.gates.filter((gate) => gate.kind === "command").map((gate) => gate.command),
    [
      "node scripts/check.mjs --strict",
      "node scripts/agent-roster-diagnostic.mjs",
      "npm run test:fanout",
      "npm run test:fixture",
      "git diff --check",
      "npm run lint",
      "npm test",
    ],
  );
});

test("formats one line per gate with its status and a summary", () => {
  const { run } = recorder({ lint: 1 });
  const text = formatText(runLocalFactory({ run, cwd: "/repo" }));

  for (const gate of GATES) assert.match(text, new RegExp(`^\\S.*?\\s+${gate.id}\\b`, "m"));
  assert.match(text, /^FAIL\s+lint\b/m);
  assert.match(text, /Summary: PASS 6, FAIL 1, BLOCKED 0, NOT RUN 2/);
  assert.match(text, /Artifacts: none created/);
});
