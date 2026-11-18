import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  EDGE_TYPES,
  GRAPH_VERSION,
  NODE_TYPES,
  buildGraphState,
  createGraphState,
  loadGraphState,
  normalizeGraphInput,
  persistGraphState,
  planGraph,
  projectHerdrState,
  stepGraphState,
} from "./graph-supervisor.mjs";

test("creates a versioned graph without mutating the input specification", () => {
  const specification = {
    runId: "run-graph-test",
    budget: { maxTransitions: 4 },
    nodes: [
      { id: "task-a", type: "task", status: "ready", title: "A" },
      { id: "task-b", type: "task", title: "B" },
    ],
    edges: [{ id: "edge-a-b", type: "waits-for", from: "task-a", to: "task-b" }],
  };
  const before = JSON.stringify(specification);

  const state = createGraphState(specification, { now: "2026-11-18T12:00:00.000Z" });

  assert.equal(state.version, GRAPH_VERSION);
  assert.equal(state.run_id, "run-graph-test");
  assert.deepEqual(state.budget, { maxTransitions: 4 });
  assert.deepEqual(state.nodes.map(({ id, type, status }) => ({ id, type, status })), [
    { id: "task-a", type: "task", status: "ready" },
    { id: "task-b", type: "task", status: "pending" },
  ]);
  assert.deepEqual(state.edges, specification.edges);
  assert.equal(JSON.stringify(specification), before);
  assert.deepEqual(normalizeGraphInput(state), state);
});

test("builds mailbox-backed task nodes over trajectory records without using pane labels", () => {
  const state = buildGraphState({
    runId: "run-sources",
    trajectory: [{ task: "I#1", state: "WORKING", agent: "worker-one", pane: "ignored-pane" }],
    mailbox: [
      { task: "I#1", state: "READY", summary: "verified" },
      { task: "I#2", state: "BLOCKED", summary: "needs a decision" },
    ],
  });

  assert.deepEqual(state.nodes.map(({ id, status, source }) => ({ id, status, source })), [
    { id: "task:I#1", status: "ready", source: "mailbox" },
    { id: "task:I#2", status: "blocked", source: "mailbox" },
    { id: "run:run-sources", status: "running", source: "derived" },
  ]);
  assert.equal(state.nodes[0].pane, undefined);
});

test("accepts every versioned node and edge type", () => {
  const state = createGraphState({
    runId: "run-types",
    nodes: NODE_TYPES.map((type) => ({ id: type, type })),
    edges: EDGE_TYPES.map((type, index) => ({
      id: `edge-${index}`,
      type,
      from: NODE_TYPES[0],
      to: NODE_TYPES[index % NODE_TYPES.length],
    })),
  });

  assert.equal(state.nodes.length, NODE_TYPES.length);
  assert.equal(state.edges.length, EDGE_TYPES.length);
});

test("plans independent work and reports unsatisfied dependencies deterministically", () => {
  const state = createGraphState({
    runId: "run-plan",
    nodes: [
      { id: "a", type: "task", status: "ready" },
      { id: "b", type: "task" },
      { id: "c", type: "task" },
      { id: "d", type: "task", status: "blocked" },
    ],
    edges: [
      { id: "a-b", type: "waits-for", from: "a", to: "b" },
      { id: "d-c", type: "waits-for", from: "d", to: "c" },
    ],
  });

  assert.deepEqual(planGraph(state), {
    ready: ["b"],
    blocked: ["c"],
    pending: [],
  });
});

test("advances dependencies, polls waits, and pauses and resumes without mutating prior state", () => {
  const state = createGraphState({
    runId: "run-lifecycle",
    nodes: [
      { id: "a", type: "task", status: "ready" },
      { id: "b", type: "wait" },
    ],
    edges: [{ id: "a-b", type: "waits-for", from: "a", to: "b" }],
  });
  const advanced = stepGraphState(state, { type: "advance" }, { now: "2026-11-18T12:01:00.000Z" });
  assert.equal(advanced.nodes.find((node) => node.id === "b").status, "ready");
  const waiting = stepGraphState(advanced, { type: "wait", nodeId: "b" }, { now: "2026-11-18T12:02:00.000Z" });
  assert.equal(waiting.nodes.find((node) => node.id === "b").status, "waiting");
  const polled = stepGraphState(waiting, { type: "poll", nodeId: "b", satisfied: false }, { now: "2026-11-18T12:03:00.000Z" });
  assert.equal(polled.nodes.find((node) => node.id === "b").status, "waiting");
  const paused = stepGraphState(polled, { type: "pause", reason: "human review" }, { now: "2026-11-18T12:04:00.000Z" });
  assert.equal(paused.status, "paused");
  const resumed = stepGraphState(paused, { type: "resume" }, { now: "2026-11-18T12:05:00.000Z" });
  assert.equal(resumed.status, "running");
  assert.equal(state.transition_count, 0);
  assert.equal(resumed.transition_count, 5);
});

test("blocks a transition before exceeding the configured budget", () => {
  const state = createGraphState({
    runId: "run-budget",
    budget: { maxTransitions: 1 },
    nodes: [{ id: "task", type: "task", status: "ready" }],
  });
  const first = stepGraphState(state, { type: "start", nodeId: "task" });
  const blocked = stepGraphState(first, { type: "complete", nodeId: "task" });

  assert.equal(first.nodes[0].status, "running");
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.budget_reason, "budget-exhausted");
  assert.equal(blocked.nodes[0].status, "running");
  assert.equal(blocked.transition_count, 1);
});

test("persists transitions and recovers the same graph after restart", () => {
  const directory = mkdtempSync(join(tmpdir(), "graph-supervisor-"));
  try {
    const state = createGraphState({
      runId: "run-persist",
      nodes: [{ id: "task", type: "task", status: "ready" }],
    });
    const next = stepGraphState(state, { type: "start", nodeId: "task" }, { now: "2026-11-18T12:10:00.000Z" });
    persistGraphState(directory, next);
    const recovered = loadGraphState(directory);

    assert.deepEqual(recovered, next);
    assert.match(readFileSync(join(directory, "events.jsonl"), "utf8"), /start/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("projects lifecycle labels without requiring Herdr availability", () => {
  const state = createGraphState({
    runId: "run-project",
    nodes: [
      { id: "task", type: "task", title: "Build", status: "running", agent: "worker-one" },
      { id: "wait", type: "wait", status: "waiting" },
    ],
  });

  assert.deepEqual(projectHerdrState(state, undefined), [{
    node_id: "task",
    agent: "worker-one",
    label: "[RUNNING] Build",
    lifecycle: "running",
    herdr: null,
  }]);
  assert.equal(projectHerdrState(state, [{ name: "worker-one", agent_status: "working" }])[0].herdr.agent_status, "working");
});
