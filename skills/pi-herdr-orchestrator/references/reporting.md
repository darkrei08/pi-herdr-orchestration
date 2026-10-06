# Dashboard, evidence and final report

Report decisions and evidence, not agent transcripts.

## Dashboard

Keep one concise table in the master context or an authorized artifact, refreshed after every state change:

| Task | Session | Status | Validation | Dependency | Next |
| --- | --- | --- | --- | --- | --- |
| #42 | issue-42 | testing | unit PASS | none | integration |
| PR #51 | pr-51 | review | CI PASS | #42 | merge |
| #53 | issue-53 | blocked | NOT RUN | API decision | hold |

The task registry fields live in [dispatch.md](dispatch.md); the machine envelope in [state-protocol.md](state-protocol.md).

## Evidence

A task is not `READY` on a claim. Prefer machine-verifiable evidence: command plus result (tests, types, lint, build), runtime health, API response, a reproduction that no longer fails, a benchmark comparison, a screenshot, a CI result. Status values stay `PASS`, `FAIL`, `BLOCKED`, `NOT RUN`.

## Cycle completion

A cycle is complete when: actionable work is classified; independent work is processed; merge-ready PRs are reviewed and, where authorized, merged; resolved issues are closed with the resolving reference; relevant tests pass and the combined result is integration-validated; temporary resources are reconciled ([integration.md](integration.md)); remaining blockers are documented; the repository is left reproducible. A request with a narrow scope completes when that scope does.

## Final report

Return these sections, in order:

1. **Completed**: merged PRs, closed issues, finished work.
2. **Ready**: finished work awaiting merge or approval.
3. **In Progress**: tasks still being implemented.
4. **Blocked**: tasks needing a dependency or a human decision.
5. **Validation**: tests, builds, runtime and UI checks actually run, each with its status; list `NOT RUN` explicitly.
6. **Cleanup**: branches, worktrees, sessions and containers removed; what was retained and why.
7. **Remaining Work**: prioritized next tasks.
8. **Repository State**: stable, partially stable, or needs further integration work.
