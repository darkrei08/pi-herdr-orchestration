import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acknowledge, classify, report, storeEvidence, readEvidence, validateIdentity, fileFor } from "./mailbox.mjs";
import { withLock } from "./lock.mjs";

const now = Date.parse("2026-10-09T12:00:00Z");
const min = 60_000;
const entry = (state, agoMin = 0, extra = {}) => ({
  state,
  updated_at: new Date(now - agoMin * min).toISOString(),
  ...extra
});
const live = (agent_status) => ({ agent_status });

const identity = (overrides = {}) => ({
  session: "pi-session-o4",
  tab: "[O4] Parent lifecycle",
  workspace: "/repo",
  worktree: "/repo/.worktrees/o4",
  branch: "feat/o4-parent-lifecycle",
  task: "O4",
  parent: "master-orchestration",
  phase: "RESULT",
  lifecycle: {
    directive: "directive-o4-1",
    execution: "execution-o4-1",
    result: "result-o4-1",
    receipt: "receipt-o4-1"
  },
  ...overrides
});

const withMailboxDir = (fn) => {
  const dir = mkdtempSync(join(tmpdir(), "orch-mailbox-"));
  const previous = process.env.ORCH_DIR;
  process.env.ORCH_DIR = dir;
  try {
    return fn(dir);
  } finally {
    if (previous === undefined) delete process.env.ORCH_DIR;
    else process.env.ORCH_DIR = previous;
    rmSync(dir, { recursive: true, force: true });
  }
};

test("classify flags what needs master action", () => {
  assert.equal(classify(entry("WORKING"), live("working"), now, 10 * min), "OK");
  assert.equal(classify(entry("WORKING", 11), live("working"), now, 10 * min), "STALE");
  assert.equal(classify(entry("WORKING"), live("idle"), now, 10 * min), "SILENT");
  assert.equal(classify(entry("ASSIGNED"), live("done"), now, 10 * min), "SILENT");
  assert.equal(classify(entry("WORKING"), live("blocked"), now, 10 * min), "NEEDS_HUMAN");
  assert.equal(classify(entry("WORKING"), undefined, now, 10 * min), "GONE");
  assert.equal(classify(entry("READY"), live("idle"), now, 10 * min), "DECIDE");
  assert.equal(classify(entry("BLOCKED"), live("working"), now, 10 * min), "DECIDE");
  assert.equal(classify(entry("CLOSED"), undefined, now, 10 * min), "OK");
  assert.equal(classify(entry("BLOCKED", 0, { pending_ask: { question: "Q?" } }), live("idle"), now, 10 * min), "ASK");
});

test("storeEvidence returns a full hash and readEvidence retrieves valid refs", () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-test-"));
  try {
    const content = "Very large test log output that would pollute context windows";
    const ref1 = storeEvidence(dir, content);
    const ref2 = storeEvidence(dir, content);
    assert.equal(ref1, ref2);
    assert.match(ref1, /^ref:sha256:[0-9a-f]{64}$/);
    assert.equal(readEvidence(dir, ref1), content);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readEvidence rejects traversal and invalid prefixes", () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-evidence-traversal-"));
  try {
    assert.throws(() => readEvidence(dir, "ref:sha256:../outside"), /invalid evidence reference/);
    assert.throws(() => readEvidence(dir, `ref:sha256:${"a".repeat(63)}\\outside`), /invalid evidence reference/);
    assert.throws(() => readEvidence(dir, `ref:md5:${"a".repeat(64)}`), /invalid evidence reference/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readEvidence rejects symlink escapes from the evidence directory", () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-evidence-symlink-"));
  const hash = "b".repeat(64);
  const outside = join(dir, "outside.txt");
  try {
    mkdirSync(join(dir, "evidence"));
    writeFileSync(outside, "outside evidence");
    symlinkSync(outside, join(dir, "evidence", `${hash}.txt`));
    assert.throws(() => readEvidence(dir, `ref:sha256:${hash}`), /invalid evidence reference/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readEvidence rejects malformed hash lengths", () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-evidence-length-"));
  try {
    assert.throws(() => readEvidence(dir, `ref:sha256:${"a".repeat(16)}`), /invalid evidence reference/);
    assert.throws(() => readEvidence(dir, `ref:sha256:${"a".repeat(65)}`), /invalid evidence reference/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readEvidence reports missing full-hash evidence", () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-evidence-missing-"));
  try {
    assert.throws(() => readEvidence(dir, `ref:sha256:${"a".repeat(64)}`), /evidence not found for reference/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("public reports persist exact identity anchors", () => {
  withMailboxDir((dir) => {
    report({ run: "run-o4", task: "O4", state: "READY", identity: identity(), summary: "result delivered", notify: "" });
    const stored = JSON.parse(readFileSync(join(dir, "run-o4", "O4.json"), "utf8"));
    assert.deepEqual(stored.identity, identity());
    assert.equal(stored.delivery.status, "delivered");
  });
});

test("public identity validation rejects missing fields and mismatches", () => {
  assert.throws(() => validateIdentity({ session: "only-session" }), /identity.*required/i);
  withMailboxDir(() => {
    assert.throws(
      () => report({ run: "run-o4", task: "other-task", state: "WORKING", identity: identity(), summary: "mismatch", notify: "" }),
      /identity.*task/i,
    );
    report({ run: "run-o4", task: "O4", state: "WORKING", identity: identity({ phase: "PROGRESS" }), summary: "progress", notify: "" });
    assert.throws(
      () => report({ run: "run-o4", task: "O4", state: "WORKING", identity: identity({ branch: "wrong-branch", phase: "PROGRESS" }), summary: "mismatch", notify: "" }),
      /identity.*mismatch/i,
    );
  });
});

test("blocked and failed reports require typed failure provenance", () => {
  withMailboxDir((dir) => {
    const failure = { kind: "verification", code: "test_failed", message: "Focused test failed", retryable: true };
    report({ run: "run-o4", task: "O4", state: "FAILED", identity: identity(), failure, summary: "failed", notify: "" });
    const stored = JSON.parse(readFileSync(join(dir, "run-o4", "O4.json"), "utf8"));
    assert.deepEqual(stored.failure, failure);
    assert.throws(
      () => report({ run: "run-o4", task: "other", state: "BLOCKED", identity: identity({ task: "other" }), summary: "missing failure", notify: "" }),
      /failure.*required/i,
    );
  });
});

test("directive, progress, result, and parent acknowledgement are distinct lifecycle records", () => {
  withMailboxDir((dir) => {
    report({ run: "run-o4", task: "O4", state: "WORKING", identity: identity({ phase: "DIRECTIVE" }), summary: "directive received", notify: "" });
    report({ run: "run-o4", task: "O4", state: "WORKING", identity: identity({ phase: "PROGRESS" }), summary: "execution progressing", notify: "" });
    report({ run: "run-o4", task: "O4", state: "READY", identity: identity({ phase: "RESULT" }), summary: "handoff delivered", notify: "" });
    acknowledge({ run: "run-o4", task: "O4", parent: "master-orchestration", decision: "accepted", notify: "" });
    const stored = JSON.parse(readFileSync(join(dir, "run-o4", "O4.json"), "utf8"));
    assert.equal(stored.delivery.status, "delivered");
    assert.deepEqual(stored.parent_receipt, {
      status: "acknowledged",
      decision: "accepted",
      parent: "master-orchestration",
      acknowledged_at: stored.parent_receipt.acknowledged_at,
    });
    assert.equal(stored.state, "READY");
    assert.throws(() => acknowledge({ run: "run-o4", task: "O4", parent: "other-parent", decision: "accepted", notify: "" }), /parent.*mismatch/i);
  });
});

test("legacy uppercase reports remain accepted without identity", () => {
  withMailboxDir((dir) => {
    report({ run: "legacy-run", task: "legacy-task", state: "WORKING", phase: "PROGRESS", branch: "legacy-branch", summary: "legacy progress", notify: "" });
    const stored = JSON.parse(readFileSync(join(dir, "legacy-run", "legacy-task.json"), "utf8"));
    assert.equal(stored.state, "WORKING");
    assert.equal(stored.agent, null);
    assert.equal("identity" in stored, false);
  });
});

test("withLock protects critical sections", () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-lock-"));
  const testFile = join(dir, "data.json");
  try {
    let executed = false;
    withLock(testFile, () => {
      executed = true;
    });
    assert.equal(executed, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("fileFor sanitizes task names correctly", () => {
  assert.equal(fileFor("I#42"), "I-42.json");
  assert.equal(fileFor("PR#127"), "PR-127.json");
  assert.equal(fileFor("task:sub"), "task-sub.json");
});

test("withLock does not reclaim a live owner after the lock ages", () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-live-lock-"));
  const testFile = join(dir, "data.json");
  const lockDir = join(dir, ".data.json.lock");
  try {
    withLock(testFile, () => {
      const old = new Date(Date.now() - 60_000);
      utimesSync(lockDir, old, old);
      assert.throws(
        () => withLock(testFile, () => {}, 20),
        /Timed out waiting for lock|Unable to verify lock ownership/,
      );
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("withLock fails closed on an unowned stale lock", () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-invalid-lock-"));
  const testFile = join(dir, "data.json");
  const lockDir = join(dir, ".data.json.lock");
  try {
    mkdirSync(lockDir);
    const old = new Date(Date.now() - 60_000);
    utimesSync(lockDir, old, old);
    assert.throws(
      () => withLock(testFile, () => {}, 20),
      /Unable to verify lock ownership/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
