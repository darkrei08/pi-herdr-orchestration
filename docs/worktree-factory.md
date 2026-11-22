# Worktree factory rules

## Baseline

Use `origin/main` as the factory baseline. Local `main` was observed at `ef29fc3` while `origin/main` was `7c2ab53`; do not branch from the stale local ref until it is deliberately reconciled.

## One unit, one worktree

One ticket or agent session gets:

1. one isolated branch named `worktree/<slug>`;
2. one directory under `.worktrees/<slug>`;
3. one Pi/Herdr session with that directory as `cwd`.

Create it before the first write:

```bash
npm run worktree:create -- runtime-fix
```

The script verifies the base ref exists and delegates to `git worktree add -b ... origin/main`. Never write into the root worktree or into another agent's worktree.

## Before merge or discard

- Run the relevant tests, `git diff --check`, and the repository checks from inside the worktree.
- Commit the reviewable unit; do not mix unrelated tickets.
- Confirm the branch is pushed or that every commit is contained in `origin/main`.
- Remove a worktree only when it is clean, has zero commits ahead of `origin/main`, is an ancestor of `origin/main`, and is not referenced by live configuration.
- Use `git worktree remove <path>` without `--force`. Keep the branch when in doubt; deletion of branches with unique commits is out of scope.
- Worktrees referenced by `/root/.pi/agent/settings.json` are active installations, not disposable.

## Audit

```bash
npm run worktree:audit
```

The audit prints `git worktree list --porcelain`. For each path also check `git status --porcelain` and `git rev-list --count origin/main..HEAD`.

## 2026-11-22 cleanup

Removed after verifying clean status and zero commits ahead of `origin/main`:

- `.worktrees/fix-v1.3.1` (`dc2a7ad`, branch retained)
- `.worktrees/loop-graph-research` (`dc2a7ad`, branch retained)
- `.worktrees/p2-capabilities` (`b13c8a8`, branch retained)
- `.worktrees/p3-evidence` (`a56841a`, branch retained)
- `.worktrees/release-v1.3.0-final` (`ab207e4`, detached)

Kept deliberately:

- root worktree: user-owned uncommitted changes;
- `.worktrees/workflow-autostart`: referenced by live `settings.json`;
- `.worktrees/wt-agents`, `.worktrees/wt-research`, `.worktrees/wt-sync`, `pi-herdr-pr`: unique or unpushed commits;
- `/root/.herdr/worktrees/...` registrations with unique commits or local changes.

No branch was deleted. No `git worktree prune --force` was run.
