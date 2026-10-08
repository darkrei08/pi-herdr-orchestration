# Repository discovery and task graph

Record branch, HEAD, dirty/staged changes, upstream divergence, worktrees, stashes, pertinent local/remote branches, unpublished commits, Issue/PR state, CI, failing checks and critical TODOs. Preserve unrelated user work.

Normalize related Issue, PR, branch, worktree and commits into one item. Identify duplicates, dependencies, blockers, completed but unclosed work and independent tasks. Classify from evidence as `STABLE`, `FIXABLE`, `DEVELOPMENT`, `EXPERIMENTAL`, `BLOCKED`, `OBSOLETE` or `RESOLVED`.

Prioritize security/data loss, repository corruption, build blockers, regressions, core defects, unblockers and near-complete work, adjusted by dependencies and user priorities. Separate discovered work from user-authorized work; a narrow request does not authorize a whole-backlog sweep.

Also classify each item by type (`BUG`, `FEATURE`, `REFACTOR`, `DOCUMENTATION`, `TEST`, `INFRASTRUCTURE`, `SECURITY`, `PERFORMANCE`, `REVIEW`, `MERGE`, `CLEANUP`, `INVESTIGATION`, `DUPLICATE`) and record repository, source, objective, affected subsystem, expected files, dependencies, blockers, risk, estimated scope, required skills, test strategy, merge target and whether it may run concurrently. Do not start implementation until the inventory is coherent. For open PRs record: ready, needs review, needs changes, unresolved threads, failing CI, conflicts, obsolete or overlapping. Pairwise relations and dispatch rules: [dispatch.md](dispatch.md).

## Reconnaissance checklist

Before planning, also record: repository purpose and workspace or monorepo boundaries (frontend, backend, documentation, infrastructure); default and active branches; documented build, test, lint, type-check and validation commands; container definitions and CI workflows; contribution guidelines and repository-specific agent instructions; draft PRs, unresolved review threads and failed CI jobs; stale branches, existing worktrees and temporary directories; local uncommitted work. Use the issue/PR provider CLI when installed, otherwise a local registry.

Verify repository initialization: ensure `.worktrees/`, `.gga`, `AGENTS.md`, Serena project configuration, and `.atl/skill-registry.md` exist. If any integration is uninitialized, run `node scripts/init-repository.mjs --apply` before worker dispatch.
