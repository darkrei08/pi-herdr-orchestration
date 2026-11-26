import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createGraphState, loadGraphState, persistGraphState } from "../skills/pi-herdr-orchestrator/scripts/graph-supervisor.mjs";
import registerExtension from "./index.mjs";

const RUN = "step-fail-run";
const NODE = "task:W#1";

// Drives the real orch_graph_step tool against a throwaway orchestration
// directory, so no live run, workflow or Herdr pane is touched.
function stepTool(t, { status = "running" } = {}) {
  const root = mkdtempSync(join(tmpdir(), "orch-graph-step-"));
  const previous = process.env.ORCH_DIR;
  process.env.ORCH_DIR = root;
  t.after(() => {
    if (previous === undefined) delete process.env.ORCH_DIR;
    else process.env.ORCH_DIR = previous;
    rmSync(root, { recursive: true, force: true });
  });
  const directory = join(root, RUN, "graph");
  persistGraphState(directory, createGraphState({
    runId: RUN,
    budget: { maxRetries: 1 },
    nodes: [{ id: NODE, type: "task", title: "W#1", status }],
  }));
  const tools = new Map();
  registerExtension(
    { registerTool: (tool) => tools.set(tool.name, tool), registerCommand: () => {} },
    { run: () => ({ status: 0, stdout: "", stderr: "" }), warn: () => {} },
  );
  const tool = tools.get("orch_graph_step");
  return {
    directory,
    tool,
    step: async (action) => JSON.parse((await tool.execute("step", { run: RUN, action })).content[0].text),
  };
}

const nodeOf = (directory) => loadGraphState(directory).nodes.find((node) => node.id === NODE);

test("orch_graph_step exposes fail with the engine's bounded status and reason contract", (t) => {
  const { tool } = stepTool(t);
  const schema = tool.parameters.properties.action.properties;
  assert.ok(schema.type.enum.includes("fail"));
  // fail always records "failed"; the status override belongs to complete only.
  assert.deepEqual(schema.status.enum, ["completed", "closed"]);
  assert.equal(schema.reason.maxLength, 512);
});

test("orch_graph_step records fail then retry and rejects fail on a completed node", async (t) => {
  const { directory, step } = stepTool(t);

  const failed = await step({ type: "fail", nodeId: NODE, reason: "FANOUT_RETRY_BOUNDED" });
  assert.equal(failed.transition_count, 1);
  assert.equal(nodeOf(directory).status, "failed");
  assert.equal(nodeOf(directory).failure_reason, "FANOUT_RETRY_BOUNDED");
  assert.deepEqual(loadGraphState(directory).transitions.at(-1).action, { type: "fail", nodeId: NODE, reason: "FANOUT_RETRY_BOUNDED" });

  const retried = await step({ type: "retry", nodeId: NODE });
  assert.equal(retried.transition_count, 2);
  assert.equal(nodeOf(directory).status, "pending");
  assert.equal(nodeOf(directory).retry_count, 1);
  assert.equal(nodeOf(directory).failure_reason, undefined);

  const completed = stepTool(t, { status: "completed" });
  await assert.rejects(completed.step({ type: "fail", nodeId: NODE, reason: "FANOUT_RETRY_BOUNDED" }), /cannot fail/);
});
