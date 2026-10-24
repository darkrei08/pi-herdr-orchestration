import assert from "node:assert/strict";
import { test } from "node:test";
import { decideSupervision, runSupervisorLoop } from "./supervisor.mjs";

const record = (overrides = {}) => ({
  assignment_id: "assign-001",
  run: "run-001",
  parent: "master",
  supervisor: "chief-build",
  worker: "worker-a",
  task: "O9",
  branch: "feat/o9",
  worktree: "/worktrees/o9",
  state: "WORKING",
  retry: { attempt: 0, max: 2 },
  nudge_count: 0,
  updated_at: "2026-10-24T10:00:00.000Z",
  ...overrides,
});

const report = (overrides = {}) => ({
  state: "WORKING",
  agent: "worker-a",
  identity: { assignment_id: "assign-001", worker: "worker-a", task: "O9" },
  checks: [],
  updated_at: "2026-10-24T10:01:00.000Z",
  ...overrides,
});

const agent = (overrides = {}) => ({ name: "worker-a", agent_status: "working", ...overrides });

const git = (overrides = {}) => ({ branch: "feat/o9", worktree: "/worktrees/o9", clean: true, ...overrides });

test("accepts a ready report only when identity, checks, and Git evidence agree", () => {
  const decision = decideSupervision(
    record({ state: "READY" }),
    report({ state: "READY", checks: [{ name: "npm-test", status: "PASS" }] }),
    agent({ agent_status: "done" }),
    git(),
    { now: Date.parse("2026-10-24T10:02:00.000Z") },
  );

  assert.equal(decision.action, "accept");
  assert.equal(decision.reason, "ready-evidence-reconciled");
});

test("fails closed on report identity drift", () => {
  const decision = decideSupervision(
    record(),
    report({ identity: { assignment_id: "other", worker: "worker-a", task: "O9" } }),
    agent(),
    git(),
  );

  assert.equal(decision.action, "escalate");
  assert.equal(decision.reason, "identity-drift");
});

test("reassigns a missing worker while retry budget remains", () => {
  const decision = decideSupervision(record(), report(), null, git());

  assert.equal(decision.action, "reassign");
  assert.equal(decision.reason, "worker-missing");
});

test("escalates a missing worker after retry budget is exhausted", () => {
  const decision = decideSupervision(record({ retry: { attempt: 2, max: 2 } }), report(), null, git());

  assert.equal(decision.action, "escalate");
  assert.equal(decision.reason, "retry-budget-exhausted");
});

test("never auto-replies to a blocked worker question", () => {
  const decision = decideSupervision(
    record({ state: "BLOCKED" }),
    report({ state: "BLOCKED", pending_ask: { question: "Need a product decision" } }),
    agent({ agent_status: "blocked" }),
    git(),
  );

  assert.equal(decision.action, "escalate");
  assert.equal(decision.reason, "worker-question");
});

test("runs a bounded loop and waits between cycles instead of polling forever", async () => {
  let loads = 0;
  let waits = 0;
  const applied = [];
  const result = await runSupervisorLoop({
    maxCycles: 2,
    loadSnapshot: async () => {
      loads += 1;
      return loads === 1
        ? { assignments: [record()], reports: { "assign-001": report() }, agents: { "worker-a": agent() }, git: { "assign-001": git() } }
        : { assignments: [], reports: {}, agents: {}, git: {} };
    },
    applyDecision: async (decision) => applied.push(decision),
    waitForWake: async () => { waits += 1; },
  });

  assert.equal(result.cycles, 2);
  assert.equal(loads, 2);
  assert.equal(waits, 1);
  assert.equal(applied.length, 1);
  assert.equal(result.reason, "no-actionable-work");
});
