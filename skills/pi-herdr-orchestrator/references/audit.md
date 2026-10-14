# Rescan, recovery and final audit

After each work item refresh Git, worktrees, PRs/issues, CI and task dependencies. Address newly unblocked tasks within scope. Avoid repeating an unchanged failing approach indefinitely.

## Evidence ownership and capability-aware audits

Own the final audit verdict in the master session. Delegate bounded evidence lenses only when the current runtime exposes a suitable Agent by effective capability; do not assume a configured child is available, and do not spawn redundant scouts. Cover runtime contracts and reachability, instruction/capability ownership, and model/UI/docs/tests/package consumers as separate lenses when useful. If delegation is unavailable, investigate locally and record the capability gap.

Runtime discovery is a capability summary, not a configuration-management view. Inspect layered definitions by frontmatter name when changing roles or child eligibility, and treat disabled or unavailable required children as non-selectable. Candidate evidence is not a verdict: the audit owner closes and de-duplicates findings before assigning severity.

This guidance follows the upstream Herdsman capability and audit changes in commits `0dc62d39` and `a422c804` (2026-10-13).

Before completion try to falsify the result: inspect forgotten branches/worktrees, unpublished/unique commits, incorrect Issue/PR state, failing/missing checks, critical TODOs, documentation and memory conflicts. Re-triage actionable findings. A separate `[AUDIT] Repository Final Audit` session is useful only if supported and permitted.

On failure preserve branch, worktree, commits, uncommitted changes, relevant logs, check results and next action. Choose retry, new approach, handoff, blocked or safe rollback based on evidence. Final report states verified changes, exact check results, integration state, blockers and retained work. Never claim operations that did not occur.
