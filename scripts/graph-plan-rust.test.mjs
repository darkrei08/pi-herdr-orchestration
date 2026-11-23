import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { planGraph } from "../skills/pi-herdr-orchestrator/scripts/graph-supervisor.mjs";

function run(state) {
  return spawnSync(process.execPath, ["scripts/graph-plan-rust.mjs"], {
    input: `${JSON.stringify(state)}\n`,
    encoding: "utf8",
  });
}

test("Rust graph bridge matches waits-for planning categories", () => {
  const state = {
    version: "repo-orchestrator/graph-supervisor/v1",
    run_id: "bridge-test",
    nodes: [
      { id: "done", type: "task", status: "completed" },
      { id: "failed", type: "task", status: "failed" },
      { id: "ready", type: "task", status: "pending" },
      { id: "blocked", type: "task", status: "pending" },
      { id: "waiting", type: "task", status: "pending" },
    ],
    edges: [
      { id: "e1", type: "waits-for", from: "done", to: "ready" },
      { id: "e2", type: "waits-for", from: "failed", to: "blocked" },
      { id: "e3", type: "waits-for", from: "waiting", to: "ready" },
      { id: "e4", type: "waits-for", from: "ready", to: "waiting" },
    ],
  };
  const result = run(state);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), planGraph(state));
});

test("Rust graph bridge rejects unknown dependency endpoints", () => {
  const result = run({
    nodes: [{ id: "task", type: "task", status: "pending" }],
    edges: [{ id: "e1", type: "waits-for", from: "missing", to: "task" }],
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /MissingNode|invalid graph/i);
});
