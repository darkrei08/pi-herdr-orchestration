# Integration and cleanup

Route complete, verified and reviewed changes to the repository's stable integration path. Keep incomplete, experimental, blocked, conflicting or uncertain work on a development branch with handoff. Discover the actual default branch and merge policy; use `main` only when it is the verified stable target. Local green checks do not equal green CI.

The master makes the placement decision after receiving the chief's report:

- `STABLE` means acceptance criteria, relevant checks and review are satisfied, conflicts are understood, and the work can be published or merged on the repository's stable target (`main` when that is the project target).
- `DEVELOPMENT` means the work is incomplete, experimental, insufficiently verified, potentially conflicting with another development stream, or not safe to publish. Keep it on its feature/development branch and persist the exact next action.

Do not publish a child result before this decision. A chief may recommend a target, but cannot silently promote uncertain work to `main`.

Use coherent commits. Review PR diff, discussion, CI, conflicts and Issue before deciding `READY`, `NEEDS WORK`, `BLOCKED`, `SUPERSEDED` or `OBSOLETE`. Align tracking only within authorized scope.

Before cleanup verify the merge or branch publication, target branch, unique commits and uncommitted changes. Remove only disposable branches/worktrees; never force-delete valuable work. Persist useful rationale and rescan. Seek a product decision for material requirement changes or breaking changes while continuing independent authorized tasks.

For a completed child task, close in this order: persist Gentle/Engram development memory and the handoff; commit or preserve the branch state; send the chief report; let the master reconcile and decide; close the Pi session; close or archive the renamed tab; then update tracking, clean disposable resources and rescan. Keep `[MASTER] Pi Repository Orchestrator` open to receive the result and issue the next directive.
