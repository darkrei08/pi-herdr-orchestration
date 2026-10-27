import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EXECUTION_GRAPH_SCHEMA,
  buildExecutionGraph,
  buildExecutionReport,
  serializeExecutionReport,
} from "./execution-graph.mjs";

test("builds a versioned read-only graph from trajectory and mailbox evidence", () => {
  const trajectory = {
    publishers: [{
      id: "publisher-1",
      runs: [{
        run: {
          id: "run-1",
          workflowName: "release",
          sessionId: "session-root",
          cwd: "/repo",
          state: "running",
          parentRunId: "run-0",
          retry: { sourceRunId: "run-0" },
          events: [{ type: "workflow:run-started", timestamp: 10 }],
          agents: [{
            id: "agent-1",
            name: "worker",
            label: "[I#42] Worker",
            state: "completed",
            parentId: "agent-chief",
            path: "parallel/build",
            startedAt: 20,
            durationMs: 30,
            worktreeOwner: "build",
            attemptDetails: [{ session: { sessionId: "session-worker" }, setup: { cwd: "/repo/.worktrees/build" } }],
          }, {
            id: "agent-chief",
            name: "chief",
            state: "running",
            path: "parallel",
          }],
        },
      }],
    }],
  };
  const mailbox = [{
    task: "I#42",
    agent: "worker",
    state: "READY",
    lifecycle: "ready",
    branch: "fix/42",
    evidence_ref: "ref:sha256:abc",
    checks: [{ name: "unit", status: "PASS" }],
    updated_at: "2026-10-27T20:00:00.000Z",
  }];
  const input = { trajectory, mailbox, now: "2026-10-27T20:01:00.000Z" };
  const before = JSON.stringify(input);
  const graph = buildExecutionGraph(input);

  assert.equal(graph.schema, EXECUTION_GRAPH_SCHEMA);
  assert.equal(graph.readOnly, true);
  assert.ok(graph.nodes.some((node) => node.id === "workflow:run-1" && node.kind === "subworkflow"));
  const worker = graph.nodes.find((node) => node.id === "worker:run-1:agent-1");
  assert.equal(worker.taskId, "I#42");
  assert.deepEqual(worker.evidence.refs, ["ref:sha256:abc"]);
  assert.deepEqual(worker.evidence.checks, [{ name: "unit", status: "PASS" }]);
  assert.ok(graph.edges.some((edge) => edge.kind === "parent" && edge.from === worker.id && edge.to === "worker:run-1:agent-chief"));
  assert.ok(graph.edges.some((edge) => edge.kind === "retry_of" && edge.from === "workflow:run-1" && edge.to === "workflow:run-0"));
  assert.equal(JSON.stringify(input), before);
});

test("preserves explicit supervisors and records dependencies without inventing authority", () => {
  const graph = buildExecutionGraph({
    master: { id: "master-1", label: "[MASTER]" },
    chiefs: [{ id: "chief-1", label: "[CHIEF/BUILD]", parentId: "master-1" }],
    mailbox: [{ task: "T3", role: "worker", agent: "agent-a", depends_on: ["T2"], state: "WORKING" }],
    now: "2026-10-27T20:00:00.000Z",
  });

  assert.deepEqual(graph.nodes.filter((node) => ["master", "chief"].includes(node.kind)).map((node) => node.kind).sort(), ["chief", "master"]);
  assert.ok(graph.edges.some((edge) => edge.kind === "parent" && edge.from === "chief:chief-1" && edge.to === "master:master-1"));
  assert.ok(graph.edges.some((edge) => edge.kind === "depends_on" && edge.from === "worker:mailbox:T3" && edge.to === "worker:mailbox:T2"));
  assert.equal(graph.nodes.find((node) => node.id === "worker:mailbox:T3").authority, undefined);
});

test("handles null input and a zero event limit without leaking events", () => {
  assert.deepEqual(buildExecutionGraph(null).events, []);
  assert.equal(buildExecutionReport(null).graph.schema, "repo-orchestrator/execution-graph/v1");

  const graph = buildExecutionGraph({
    trajectory: { runs: [{ run: { id: "run-1", events: [{ type: "event", timestamp: 1 }] } }] },
    maxEvents: 0,
  });
  assert.deepEqual(graph.events, []);
});

test("uses mailbox run identifiers and merges mailbox lifecycle into trajectory workers", () => {
  const graph = buildExecutionGraph({
    trajectory: { runs: [{ run: { id: "run-1", agents: [{ id: "agent-1", name: "worker" }] } }] },
    mailbox: [
      { task: "T1", agent: "worker", run: "run-1", state: "READY", lifecycle: "ready" },
      { task: "T2", agent: "other", state: "WORKING" },
    ],
  });

  const worker = graph.nodes.find((node) => node.id === "worker:run-1:agent-1");
  assert.equal(worker.state, "READY");
  assert.equal(worker.lifecycle, "ready");
  assert.ok(graph.edges.some((edge) => edge.kind === "reports" && edge.from === worker.id && edge.to === "workflow:run-1"));
  assert.equal(graph.edges.some((edge) => edge.kind === "reports" && edge.to === "workflow:undefined"), false);
});

test("builds a bounded report and deterministic JSON output", async () => {
  const report = buildExecutionReport({
    trajectory: { runs: [{ run: { id: "run-1", workflowName: "check", state: "completed", agents: [], events: Array.from({ length: 4 }, (_, i) => ({ type: "event", timestamp: i })) } }] },
    maxEvents: 2,
    now: "2026-10-27T20:00:00.000Z",
  });
  assert.equal(report.schema, "repo-orchestrator/execution-report/v1");
  assert.equal(report.graph.events.length, 2);
  assert.equal(serializeExecutionReport(report), JSON.stringify(report));

  const { default: registerExtension } = await import("../../../extensions/index.mjs");
  const tools = new Map();
  registerExtension({ registerTool: (tool) => tools.set(tool.name, tool), registerCommand: () => {} });
  const result = await tools.get("orch_execution_graph").execute("test", {
    mailbox: [{ task: "T1", state: "READY" }],
    now: "2026-10-27T20:00:00.000Z",
  });
  const payload = JSON.parse(result.content[0].text);
  assert.equal(payload.schema, "repo-orchestrator/execution-report/v1");
});
