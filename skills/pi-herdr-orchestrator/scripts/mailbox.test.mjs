import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { classify, storeEvidence, fileFor } from "./mailbox.mjs";
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

test("storeEvidence hashes and stores files deduplicated", () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-test-"));
  try {
    const content = "Very large test log output that would pollute context windows";
    const ref1 = storeEvidence(dir, content);
    const ref2 = storeEvidence(dir, content);
    assert.equal(ref1, ref2);
    assert.ok(ref1.startsWith("ref:sha256:"));
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
