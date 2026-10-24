# O4 Parent Lifecycle Mailbox Contract

Issue #6, branch `feat/o4-parent-lifecycle`, worktree `/root/.herdr/worktrees/pi-herdr-orchestration/o4-parent-lifecycle`.

## Specs

1. **S1 Identity:** "Reports must be able to carry exact session, tab, workspace, worktree, branch, task, parent, phase, and lifecycle anchors; preserve legacy uppercase state values."
2. **S2 Failure provenance:** "Add a typed failure object for blocked/failed outcomes with stable kind/code, message, and retryable classification; reject malformed or mismatched identity at the public interface rather than silently accepting it."
3. **S3 Parent receipt:** "Add the parent receipt/acknowledgement transition or durable field needed to distinguish a delivered result from a parent decision, without treating Herdr liveness or presentation labels as authority."
4. **S4 Lifecycle:** "every child must inform its immediate parent through directive receipt, execution/progress, result or handoff, and explicit parent receipt/decision."
5. **S5 Compatibility:** Preserve existing uppercase states, evidence behavior, legacy report fields, and existing CLI callers unless the new identity contract is explicitly supplied.

## Tasks

- T1 (S1-S5): Add RED public-interface tests for valid, missing, and mismatched identity; typed blocked/failed provenance; directive/progress/result/ack lifecycle; and legacy compatibility. Commit: pending.
- T2 (S1-S5): Implement mailbox validation, durable lifecycle and receipt fields, and typed failures. Commit: pending.
- T3 (S1-S5): Update state, supervision, coordination, and execution references and run all required checks. Commit: pending.
- T4 (S1-S5): Commit the verified work through normal hooks and hand off to master-orchestration. Commit: pending.

## Log

- L1: MASTER DIRECTIVE: Implement O4 under approved issue #6 in this isolated worktree. This task incorporates the user's mandatory team-lifecycle rule: every child must inform its immediate parent through directive receipt, execution/progress, result or handoff, and explicit parent receipt/decision.

Implement the smallest backward-compatible mailbox contract for exact sender identity and typed failure provenance. Reports must be able to carry exact session, tab, workspace, worktree, branch, task, parent, phase, and lifecycle anchors; preserve legacy uppercase state values. Add a typed failure object for blocked/failed outcomes with stable kind/code, message, and retryable classification; reject malformed or mismatched identity at the public interface rather than silently accepting it. Add the parent receipt/acknowledgement transition or durable field needed to distinguish a delivered result from a parent decision, without treating Herdr liveness or presentation labels as authority.

Allowed edit surfaces: skills/pi-herdr-orchestrator/scripts/mailbox.mjs, its focused tests, references/state-protocol.md, references/supervision.md, references/coordination.md, references/execution.md, and one ODD task note under odd/tasks/. Do not edit lock.mjs, publish workflows, installed software, or live Herdr. Test-first: add RED public-interface tests for valid identity, missing identity, mismatched identity, typed failures, directive/progress/result/ack lifecycle, and legacy compatibility, then implement. Run npm test, syntax checks, diff checks, and applicable strict check once. Read AGENTS.md, issue #6, and the user directive before editing.

Commit only with normal hooks after checks; never use --no-verify, do not push/PR/merge. If interactive review consent appears, stop and report the exact choice required to master-orchestration. Keep the tab open until the parent acknowledges the final report.

REPORTING: ORCH_RUN=master-herdr-20261024, ORCH_AGENT=o4-lifecycle, ORCH_MASTER=master-orchestration. Report WORKING at directive receipt, RED, implementation, verification, and handoff; include branch/worktree/session/tab, exact checks, failure provenance, memory state, and next action. Finish READY, DEVELOPMENT, BLOCKED, or FAILED; a READY report is not closed until master-orchestration sends a decision/acknowledgement.

- L2: Master acknowledgement: "Directive receipt recorded for O4. Continue the declared RED -> implementation -> verification -> handoff lifecycle. Do not broaden scope; report every phase and wait for the master decision after final handoff."
