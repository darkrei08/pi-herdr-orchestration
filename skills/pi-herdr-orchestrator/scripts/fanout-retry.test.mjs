import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { FANOUT_REASON, resolveFanout } from "./fanout-retry.mjs";
import { buildGraphState, loadGraphState, persistGraphState, stepGraphState } from "./graph-supervisor.mjs";
import { fileFor, report, storeEvidence } from "./mailbox.mjs";

const RUN = "run-fanout-retry";
const AT = "2026-11-26T10:00:00.000Z";
const NEXT = "2026-11-26T10:10:00.000Z";
const SESSION_A = "01a215d9-cc89-7000-8000-00000000a001";
const SESSION_B = "01a215d9-ccba-7000-8000-00000000b002";
const IDENTITY_A = { pane: "wS4:p2", session: SESSION_A };
const IDENTITY_B = { pane: "wS4:p3", session: SESSION_B };

function seedMailbox(dir) {
  for (const [task, agent, identity] of [["I#A", "fanout-a", IDENTITY_A], ["I#B", "fanout-b", IDENTITY_B]]) {
    report({
      dir,
      run: RUN,
      task,
      agent,
      state: "WORKING",
      summary: `${task} phase 1`,
      pane: identity.pane,
      session: identity.session,
      silent: true,
      nonBlocking: true,
    });
  }
  return ["I#A", "I#B"].map((task) => JSON.parse(readFileSync(join(dir, fileFor(task)), "utf8")));
}

function applyActions(graph, actions, now) {
  return actions.reduce((state, action) => stepGraphState(state, action, { now }), graph);
}

function nodeOf(graph, task) {
  return graph.nodes.find((node) => node.id === `task:${task}`);
}

test("preserves a completed sibling, retries a stale branch once, then blocks terminally", () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-fanout-retry-"));
  try {
    const entries = seedMailbox(dir);
    const graphDir = join(dir, "graph");
    const seeded = buildGraphState({ runId: RUN, budget: { maxRetries: 1 }, mailbox: entries });
    // The master reconciled I#A against Git, so its branch is complete.
    const completedGraph = stepGraphState(seeded, { type: "complete", nodeId: "task:I#A" }, { now: AT });
    persistGraphState(graphDir, completedGraph);

    const resultRef = storeEvidence(dir, "I#A candidate abc1234, focused test 4/4");
    const paneReadRef = storeEvidence(dir, "pane wS4:p3: no terminal report at the deadline");
    const branches = [
      { task: "I#A", agent: "fanout-a", identity: IDENTITY_A, outcome: "COMPLETED", side_effects: "OBSERVED", result_ref: resultRef },
      {
        task: "I#B",
        agent: "fanout-b",
        identity: IDENTITY_B,
        outcome: "TIMEOUT",
        cause: "TIMEOUT",
        liveness: "STALE",
        side_effects: "NONE",
        evidence: paneReadRef,
      },
    ];

    const before = JSON.stringify(completedGraph);
    const first = resolveFanout({ run: RUN, branches, graph: completedGraph });
    assert.equal(JSON.stringify(completedGraph), before);

    assert.equal(first.status, "PARTIAL");
    assert.equal(first.reason, FANOUT_REASON.RETRY_BOUNDED);
    assert.equal(first.retry_limit, 1);
    const [accepted, retried] = first.branches;
    assert.equal(accepted.decision, "ACCEPT");
    assert.equal(accepted.result_ref, resultRef);
    assert.deepEqual(accepted.identity, IDENTITY_A);
    assert.equal(retried.decision, "RETRY");
    assert.equal(retried.reason, FANOUT_REASON.RETRY_BOUNDED);
    assert.equal(retried.outcome, "TIMEOUT");
    assert.equal(retried.cause, "TIMEOUT");
    assert.equal(retried.liveness, "STALE");
    assert.equal(retried.retries, 0);
    assert.equal(retried.evidence, paneReadRef);
    assert.deepEqual(first.actions.map((action) => action.type), ["fail", "retry"]);
    assert.equal(first.report.state, "WORKING");
    assert.match(first.report.summary, /FANOUT_RETRY_BOUNDED/);
    assert.match(first.report.summary, /wS4:p3/);
    assert.equal(first.completed.length, 1);
    assert.equal(first.completed[0].task, "I#A");

    const retriedGraph = applyActions(completedGraph, first.actions, NEXT);
    persistGraphState(graphDir, retriedGraph);
    assert.equal(nodeOf(retriedGraph, "I#B").status, "pending");
    assert.equal(nodeOf(retriedGraph, "I#B").retry_count, 1);
    assert.equal(nodeOf(retriedGraph, "I#A").status, "completed");
    assert.equal(loadGraphState(graphDir).transition_count, 3);

    report({
      dir,
      run: RUN,
      task: "I#B",
      agent: "fanout-b",
      state: "WORKING",
      summary: first.report.summary,
      checks: first.report.checks,
      silent: true,
      nonBlocking: true,
    });

    const second = resolveFanout({ run: RUN, branches, graph: retriedGraph });
    assert.equal(second.status, "BLOCKED");
    assert.equal(second.reason, FANOUT_REASON.RETRY_EXHAUSTED);
    assert.equal(second.branches[0].decision, "ACCEPT");
    assert.equal(second.branches[1].decision, "BLOCK");
    assert.equal(second.branches[1].retries, 1);
    assert.deepEqual(second.actions.map((action) => action.type), ["fail"]);
    assert.equal(second.report.state, "BLOCKED");
    assert.match(second.report.summary, /FANOUT_RETRY_EXHAUSTED/);
    assert.match(second.report.summary, /wS4:p3/);

    const blockedGraph = applyActions(retriedGraph, second.actions, NEXT);
    persistGraphState(graphDir, blockedGraph);
    assert.equal(nodeOf(blockedGraph, "I#B").status, "failed");
    assert.equal(nodeOf(blockedGraph, "I#B").failure_reason, FANOUT_REASON.RETRY_EXHAUSTED);

    const blocked = report({
      dir,
      run: RUN,
      task: "I#B",
      agent: "fanout-b",
      state: "BLOCKED",
      summary: second.report.summary,
      checks: second.report.checks,
      silent: true,
      nonBlocking: true,
    });
    assert.equal(blocked.state, "BLOCKED");
    assert.equal(blocked.lifecycle, "blocked");
    assert.equal(blocked.identity.pane, IDENTITY_B.pane);

    const sibling = JSON.parse(readFileSync(join(dir, fileFor("I#A")), "utf8"));
    assert.equal(sibling.state, "WORKING");
    assert.deepEqual(sibling.identity, IDENTITY_A);
    assert.equal(second.completed[0].result_ref, resultRef);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("blocks a branch whose side effects are observed or unknown instead of replaying it", () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-fanout-effects-"));
  try {
    const entries = seedMailbox(dir);
    const graph = buildGraphState({ runId: RUN, budget: { maxRetries: 1 }, mailbox: entries });
    const unknownEffects = { task: "I#B", agent: "fanout-b", identity: IDENTITY_B, outcome: "FAILED", cause: "HERDR", evidence: storeEvidence(dir, "agent gone") };
    const resolution = resolveFanout({ run: RUN, branches: [unknownEffects], graph });

    assert.equal(resolution.status, "BLOCKED");
    assert.equal(resolution.reason, FANOUT_REASON.SIDE_EFFECTS_UNCERTAIN);
    assert.equal(resolution.branches[0].side_effects, "UNKNOWN");
    assert.deepEqual(resolution.actions.map((action) => action.type), ["fail"]);

    const observed = resolveFanout({
      run: RUN,
      branches: [{ ...unknownEffects, side_effects: "OBSERVED" }],
      graph,
    });
    assert.equal(observed.reason, FANOUT_REASON.SIDE_EFFECTS_UNCERTAIN);
    assert.equal(observed.branches[0].retries, 0);
    assert.equal(nodeOf(applyActions(graph, observed.actions, NEXT), "I#B").retry_count, undefined);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("rejects unsupported branch evidence and a graph from another run", () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-fanout-invalid-"));
  try {
    const graph = buildGraphState({ runId: RUN, budget: { maxRetries: 1 }, mailbox: seedMailbox(dir) });
    const branch = { task: "I#B", agent: "fanout-b", outcome: "FAILED", side_effects: "NONE", evidence: `ref:sha256:${"a".repeat(64)}` };

    assert.throws(() => resolveFanout({ run: RUN, branches: [{ ...branch, outcome: "DONE" }], graph }), /outcome/);
    assert.throws(() => resolveFanout({ run: RUN, branches: [{ ...branch, side_effects: "MAYBE" }], graph }), /side_effects/);
    assert.throws(() => resolveFanout({ run: RUN, branches: [{ ...branch, cause: "QUOTA" }], graph }), /cause/);
    assert.throws(() => resolveFanout({ run: "other-run", branches: [branch], graph }), /run_id/);
    assert.throws(() => resolveFanout({ run: RUN, branches: [{ ...branch, task: "I#Z" }], graph }), /graph node/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
