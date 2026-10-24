import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  acknowledgeDirective,
  createDirective,
  readDirective,
  recordDecision,
  recordParentReceipt,
  recordWorkerState,
  reassignDirective,
} from "./directives.mjs";

const root = join(import.meta.dirname, "../../..");

const baseInput = (dir) => ({
  dir,
  assignment_id: "assign-001",
  run: "run-001",
  parent: "master",
  supervisor: "chief-build",
  worker: "worker-a",
  task: "O9",
  branch: "feat/o9",
  worktree: "/worktrees/o9",
  allowed_paths: ["skills/pi-herdr-orchestrator/**"],
  dependencies: ["O4"],
  max_retries: 2,
});

function withTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), "pi-herdr-directives-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("the directive schema preserves the versioned authority contract", () => {
  const schema = JSON.parse(readFileSync(join(root, "schemas/repo-orchestrator-v1.json"), "utf8"));
  assert.equal(schema.$id, "https://github.com/darkrei08/pi-herdr-orchestration/schemas/repo-orchestrator-v1.json");
  assert.deepEqual(schema.required.slice(0, 4), ["v", "kind", "assignment_id", "run"]);
  assert.deepEqual(schema.properties.state.enum.slice(-2), ["ACCEPTED", "CLOSED"]);
});

test("creates a durable directive with authority and retry anchors", () => withTempDir((dir) => {
  const record = createDirective(baseInput(dir));

  assert.equal(record.state, "ASSIGNED");
  assert.equal(record.parent, "master");
  assert.equal(record.supervisor, "chief-build");
  assert.equal(record.worker, "worker-a");
  assert.deepEqual(record.allowed_paths, ["skills/pi-herdr-orchestrator/**"]);
  assert.equal(record.retry.attempt, 0);
  assert.equal(record.retry.max, 2);
  assert.match(record.directive_digest, /^[a-f0-9]{64}$/);
  assert.deepEqual(readDirective(dir, "assign-001"), record);
}));

test("requires exact worker identity for acknowledgement", () => withTempDir((dir) => {
  createDirective(baseInput(dir));

  assert.throws(
    () => acknowledgeDirective({ dir, assignment_id: "assign-001", actor: "worker-b" }),
    /directive authority mismatch/,
  );

  const acknowledged = acknowledgeDirective({ dir, assignment_id: "assign-001", actor: "worker-a" });
  assert.equal(acknowledged.state, "ACKNOWLEDGED");
}));

test("requires parent acceptance and a matching receipt before closure", () => withTempDir((dir) => {
  createDirective(baseInput(dir));
  acknowledgeDirective({ dir, assignment_id: "assign-001", actor: "worker-a" });
  recordWorkerState({ dir, assignment_id: "assign-001", actor: "worker-a", state: "READY", result_id: "result-1" });

  const accepted = recordDecision({
    dir,
    assignment_id: "assign-001",
    actor: "master",
    decision: "accept",
    result_id: "result-1",
  });
  assert.equal(accepted.state, "ACCEPTED");

  assert.throws(
    () => recordParentReceipt({ dir, assignment_id: "assign-001", actor: "worker-a", result_id: "result-1" }),
    /directive authority mismatch/,
  );

  const closed = recordParentReceipt({ dir, assignment_id: "assign-001", actor: "master", result_id: "result-1" });
  assert.equal(closed.state, "CLOSED");
  assert.equal(closed.parent_receipt.result_id, "result-1");
}));

test("reassignment increments the bounded retry counter and invalidates the old worker", () => withTempDir((dir) => {
  createDirective(baseInput(dir));
  const reassigned = reassignDirective({
    dir,
    assignment_id: "assign-001",
    actor: "master",
    worker: "worker-b",
    reason: "identity-drift",
  });

  assert.equal(reassigned.state, "REASSIGNED");
  assert.equal(reassigned.worker, "worker-b");
  assert.equal(reassigned.retry.attempt, 1);
  assert.equal(reassigned.previous_worker, "worker-a");
  assert.throws(
    () => recordWorkerState({ dir, assignment_id: "assign-001", actor: "worker-a", state: "WORKING" }),
    /directive authority mismatch/,
  );
}));
