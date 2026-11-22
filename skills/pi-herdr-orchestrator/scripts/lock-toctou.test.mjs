import assert from "node:assert/strict";
import { test } from "node:test";
import { reclaimStaleLock } from "./lock.mjs";

test("stale reclaim cannot delete a fresh owner after a TOCTOU", () => {
  const stale = { pid: 999999999, id: "stale-owner" };
  const fresh = { pid: process.pid, id: "fresh-owner" };
  let reads = 0;
  let deleted = false;
  let removed = false;
  const deps = {
    statSync: () => ({ mtimeMs: Date.now() - 60_000 }),
    readFileSync: () => Buffer.from(JSON.stringify(reads++ === 0 ? stale : fresh)),
    unlinkSync: () => { deleted = true; },
    rmdirSync: () => { removed = true; },
  };

  assert.equal(reclaimStaleLock("/tmp/orch-lock-toctou.lock", deps), false);
  assert.equal(deleted, false);
  assert.equal(removed, false);
});
