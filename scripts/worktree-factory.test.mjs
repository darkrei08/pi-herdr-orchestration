import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import { buildWorktreePlan, isRemovableWorktree } from "./worktree-factory.mjs";

const repoRoot = resolve("/repo");
const expectedPath = `${repoRoot}/.worktrees/runtime-fix`;

test("plans an isolated worktree from origin/main with deterministic names", () => {
  assert.deepEqual(buildWorktreePlan("runtime-fix", "/repo"), {
    branch: "worktree/runtime-fix",
    path: expectedPath,
    args: ["worktree", "add", "-b", "worktree/runtime-fix", expectedPath, "origin/main"],
  });
});

test("rejects invalid worktree slugs", () => {
  assert.throws(() => buildWorktreePlan("../escape", "/repo"), /invalid worktree slug/);
  assert.throws(() => buildWorktreePlan("bad slug", "/repo"), /invalid worktree slug/);
});

test("only allows removal of clean worktrees fully contained in the base", () => {
  assert.equal(isRemovableWorktree({ dirty: false, pending: 0, ancestor: true, referenced: false }), true);
  assert.equal(isRemovableWorktree({ dirty: true, pending: 0, ancestor: true, referenced: false }), false);
  assert.equal(isRemovableWorktree({ dirty: false, pending: 1, ancestor: false, referenced: false }), false);
  assert.equal(isRemovableWorktree({ dirty: false, pending: 0, ancestor: true, referenced: true }), false);
});
