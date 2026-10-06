# Integration and cleanup

Route complete, verified and reviewed changes to the repository's stable integration path. Keep incomplete, experimental, blocked, conflicting or uncertain work on a development branch with handoff. Discover the actual default branch and merge policy; use `main` only when it is the verified stable target. Local green checks do not equal green CI.

The master makes the placement decision after receiving the chief's report:

- `STABLE` means acceptance criteria, relevant checks and review are satisfied, conflicts are understood, and the work can be published or merged on the repository's stable target (`main` when that is the project target).
- `DEVELOPMENT` means the work is incomplete, experimental, insufficiently verified, potentially conflicting with another development stream, or not safe to publish. Keep it on its feature/development branch and persist the exact next action.

Do not publish a child result before this decision. A chief may recommend a target, but cannot silently promote uncertain work to `main`.

Use coherent commits. Review PR diff, discussion, CI, conflicts and Issue before deciding `READY`, `NEEDS WORK`, `BLOCKED`, `SUPERSEDED` or `OBSOLETE`. Align tracking only within authorized scope.

Before cleanup verify the merge or branch publication, target branch, unique commits and uncommitted changes. Remove only disposable branches/worktrees; never force-delete valuable work. Persist useful rationale and rescan. Seek a product decision for material requirement changes or breaking changes while continuing independent authorized tasks.

For a completed child task, close in this order: persist Gentle/Engram development memory and the handoff; commit or preserve the branch state; send the chief report; let the master reconcile and decide; close the Pi session; close or archive the renamed tab; then update tracking, clean disposable resources and rescan. Keep `[MASTER] Pi Herdr Orchestrator` open to receive the result and issue the next directive.

Merge only with evidence: required CI green, relevant tests pass, blocking review threads resolved, no conflicts, implementation matches the issue, dependent tasks compatible. A worker's own claim is not evidence; use an independent review when available. Follow repository merge conventions; squash tightly scoped PRs when policy allows. Close an issue only when its acceptance criteria are met; if only partly solved, keep it open and create explicit follow-up work.

## PR body and integration pass

Before creating or updating a PR confirm: coherent scope, tests pass, diff self-reviewed, no unrelated changes, documentation updated, correct base, conflicts understood, and no existing PR already covers the task. The body states problem, root cause or motivation, solution, validation performed, risks, dependencies, linked issue, and screenshots or other evidence when they help review.

After individual tasks pass, validate the combination before merge decisions: combined branches and PRs, shared schemas and contracts, dependency versions, migrations, the Compose stack, end-to-end workflows, UI behavior and CI. Independent green tasks can still conflict together.

## Temporary resource cleanup

Temporary worktrees and directories (for example under `/tmp`), local branches, Herdr panes, Pi sessions, test containers and disposable volumes are removed once their work is reconciled. First prove for each: its commits are pushed or merged (no unique unpushed commits, `git status` clean, or changes preserved in a recorded branch), then remove it and update the registry. If the proof fails, keep the resource and report it. In the final report list what was removed and what was retained and why.
