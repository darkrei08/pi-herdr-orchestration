# Integration and cleanup

Route complete, verified and reviewed changes to the repository's stable integration path. Keep incomplete, experimental, blocked, conflicting or uncertain work on a development branch with handoff. Discover the actual default branch and merge policy; use `main` only when it is the verified stable target. Local green checks do not equal green CI.

The master makes the placement decision after receiving the chief's report:

- `STABLE` means acceptance criteria, relevant checks and review are satisfied, conflicts are understood, and the work can be published or merged on the repository's stable target (`main` when that is the project target).
- `DEVELOPMENT` means the work is incomplete, experimental, insufficiently verified, potentially conflicting with another development stream, or not safe to publish. Keep it on its feature/development branch and persist the exact next action.

Do not publish a child result before this decision. A chief may recommend a target, but cannot silently promote uncertain work to `main`.

Use coherent commits. Review PR diff, discussion, CI, conflicts and Issue before deciding `READY`, `NEEDS WORK`, `BLOCKED`, `SUPERSEDED` or `OBSOLETE`. Align tracking only within authorized scope.

Before cleanup verify the merge or branch publication, target branch, unique commits and uncommitted changes. Remove only disposable branches/worktrees; never force-delete valuable work. Persist useful rationale and rescan. Seek a product decision for material requirement changes or breaking changes while continuing independent authorized tasks.

For a completed child task, close in this order: persist Gentle/Engram development memory and the handoff; commit or preserve the branch state; send the chief report; let the master reconcile and decide; close the Pi session; close the child pane; then update tracking, clean disposable resources and rescan. Keep `[MASTER] Pi Herdr Orchestrator` open to receive the result and issue the next directive.

Merge only with evidence: required CI green, relevant tests pass, blocking review threads resolved, no conflicts, implementation matches the issue, dependent tasks compatible. A worker's own claim is not evidence; use an independent review when available. Follow repository merge conventions; squash tightly scoped PRs when policy allows. Close an issue only when its acceptance criteria are met; if only partly solved, keep it open and create explicit follow-up work.

## PR body and integration pass

Before creating or updating a PR confirm: coherent scope, tests pass, diff self-reviewed, no unrelated changes, documentation updated, correct base, conflicts understood, and no existing PR already covers the task. The body states problem, root cause or motivation, solution, validation performed, risks, dependencies, linked issue, and screenshots or other evidence when they help review.

After individual tasks pass, validate the combination before merge decisions: combined branches and PRs, shared schemas and contracts, dependency versions, migrations, the Compose stack, end-to-end workflows, UI behavior and CI. Independent green tasks can still conflict together.

## Temporary resource cleanup

Temporary resources have three classes:

- `disposable`: `$TMPDIR` output files and caches, removable only after the owning session is proven dead;
- `evidence`: crash records, session transcripts and workflow runs cited by a task document or issue, retained until that evidence is no longer needed;
- `registered`: Git worktrees and branch refs, removable only after their commits are pushed or merged and the registry is updated.

The repository never deletes outside its own tree. `$TMPDIR` and `~/.pi/**` reclamation remains operator-authorized; repository checks only measure resource headroom. Never search a tree containing `$TMPDIR/pi-bash-*.log`: a bash command can match its own growing output log and recurse until the temporary filesystem is full. After a crash, remove only orphaned `pi-bash-*.log` files whose owning session is proven dead.

Workflow run retention is configuration, not manual deletion. When enabled, use positive integer values in `.pi/pi-extensible-workflows/settings.json`, for example `{"retention":{"olderThanDays":14,"maxTerminalRuns":100}}`. Keep run or session identifiers cited by an open task or issue until that record is closed. Never hand-remove workflow run directories because leases, dependencies and borrowed worktrees must be evaluated by the workflow retention mechanism.

Temporary worktrees, local branches, Herdr panes, Pi sessions, test containers and disposable volumes are removed once their work is reconciled. First prove for each: its commits are pushed or merged (no unique unpushed commits, `git status` clean, or changes preserved in a recorded branch), then remove it and update the registry. If the proof fails, keep the resource and report it. In the final report list what was removed and what was retained and why.
