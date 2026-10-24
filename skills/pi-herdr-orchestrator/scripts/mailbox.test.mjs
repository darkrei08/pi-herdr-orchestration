import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { classify, storeEvidence, readEvidence, fileFor } from "./mailbox.mjs";
import { withLock } from "./lock.mjs";

const now = Date.parse("2026-10-09T12:00:00Z");
const min = 60_000;
const entry = (state, agoMin = 0, extra = {}) => ({
  state,
  updated_at: new Date(now - agoMin * min).toISOString(),
  ...extra
});
const live = (agent_status) => ({ agent_status });

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
