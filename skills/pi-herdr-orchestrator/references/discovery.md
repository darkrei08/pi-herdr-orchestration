# Repository discovery and task graph

Record branch, HEAD, dirty/staged changes, upstream divergence, worktrees, stashes, pertinent local/remote branches, unpublished commits, Issue/PR state, CI, failing checks and critical TODOs. Preserve unrelated user work.

Normalize related Issue, PR, branch, worktree and commits into one item. Identify duplicates, dependencies, blockers, completed but unclosed work and independent tasks. Classify from evidence as `STABLE`, `FIXABLE`, `DEVELOPMENT`, `EXPERIMENTAL`, `BLOCKED`, `OBSOLETE` or `RESOLVED`.

Prioritize security/data loss, repository corruption, build blockers, regressions, core defects, unblockers and near-complete work, adjusted by dependencies and user priorities. Separate discovered work from user-authorized work; a narrow request does not authorize a whole-backlog sweep.

Also classify each item by type (`BUG`, `FEATURE`, `REFACTOR`, `DOCUMENTATION`, `TEST`, `INFRASTRUCTURE`, `SECURITY`, `PERFORMANCE`, `REVIEW`, `MERGE`, `CLEANUP`, `INVESTIGATION`, `DUPLICATE`) and record affected subsystem, expected files, risk, required skills, test strategy, merge target and whether it may run concurrently. For open PRs record: ready, needs review, needs changes, unresolved threads, failing CI, conflicts, obsolete or overlapping. Pairwise relations and dispatch rules: [dispatch.md](dispatch.md).
