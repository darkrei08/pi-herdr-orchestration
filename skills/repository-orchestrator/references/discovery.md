# Repository discovery and task graph

Record branch, HEAD, dirty/staged changes, upstream divergence, worktrees, stashes, pertinent local/remote branches, unpublished commits, Issue/PR state, CI, failing checks and critical TODOs. Preserve unrelated user work.

Normalize related Issue, PR, branch, worktree and commits into one item. Identify duplicates, dependencies, blockers, completed but unclosed work and independent tasks. Classify from evidence as `STABLE`, `FIXABLE`, `DEVELOPMENT`, `EXPERIMENTAL`, `BLOCKED`, `OBSOLETE` or `RESOLVED`.

Prioritize security/data loss, repository corruption, build blockers, regressions, core defects, unblockers and near-complete work, adjusted by dependencies and user priorities. Separate discovered work from user-authorized work; a narrow request does not authorize a whole-backlog sweep.
