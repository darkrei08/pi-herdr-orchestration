import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { createIsolatedCommitCandidate, fixtureGit } from "./isolated-commit-fixture.mjs";

const SLUG = "isolated-commit-candidate";
const SUBJECT = "[I#48] Isolated commit candidate";
const SCOPED_FILE = "src/scoped.txt";

function withRoot() {
  const root = mkdtempSync(join(tmpdir(), "isolated-commit-"));
  return { root, fixture: createIsolatedCommitCandidate(root, { slug: SLUG, subject: SUBJECT }) };
}

test("isolated commit candidate stays reproducible and unpublished", () => {
  const created = [];
  try {
    created.push(withRoot());
    const replay = withRoot();
    created.push(replay);
    const { root, fixture } = created[0];
    const { worktree, branch, baseline } = fixture;

    assert.equal(resolve(worktree), join(root, ".worktrees", SLUG));
    assert.equal(branch, `worktree/${SLUG}`);

    // immutable baseline reached through the separate worktree
    assert.equal(fixtureGit(root, ["rev-parse", "main"]).trim(), baseline);
    assert.equal(fixtureGit(root, ["rev-parse", "--abbrev-ref", "HEAD"]).trim(), "main");
    assert.equal(fixtureGit(worktree, ["rev-parse", "--abbrev-ref", "HEAD"]).trim(), branch);
    assert.equal(fixtureGit(worktree, ["rev-parse", "HEAD~1"]).trim(), baseline);
    assert.equal(fixtureGit(worktree, ["rev-list", "--count", `${baseline}..HEAD`]).trim(), "1");

    // clean candidate limited to the scoped change
    assert.equal(fixtureGit(worktree, ["status", "--porcelain"]), "");
    assert.equal(fixtureGit(worktree, ["diff", "--name-only", `${baseline}..HEAD`]).trim(), SCOPED_FILE);

    // commit identity
    assert.equal(fixtureGit(worktree, ["log", "-1", "--format=%s"]).trim(), SUBJECT);
    assert.equal(fixtureGit(worktree, ["log", "-1", "--format=%an <%ae>"]).trim(), "Isolated Fixture <fixture@example.invalid>");
    assert.equal(fixtureGit(worktree, ["rev-parse", "HEAD"]).trim(), fixture.candidate);

    // unrelated root changes survive byte for byte
    for (const entry of fixture.rootDirty) {
      assert.equal(readFileSync(join(root, entry.path)).equals(entry.bytes), true, `${entry.path} was modified`);
    }
    assert.equal(fixtureGit(root, ["status", "--porcelain"]), " M src/app.txt\n?? scratch.local.md\n");
    assert.equal(fixtureGit(root, ["rev-parse", "HEAD"]).trim(), baseline);

    // nothing pushed, merged or opened: no remote at all
    assert.equal(fixtureGit(root, ["remote"]), "");
    assert.equal(fixtureGit(root, ["for-each-ref", "--format=%(refname)", "refs/remotes"]), "");
    assert.equal(fixtureGit(root, ["branch", "--format=%(refname:short)"]).trim(), `main\n${branch}`);

    // reproducible: an independent fixture produces the same baseline and candidate
    assert.equal(replay.fixture.baseline, baseline);
    assert.equal(replay.fixture.candidate, fixture.candidate);
  } finally {
    for (const { root } of created) rmSync(root, { recursive: true, force: true });
  }
});
