# O5 Supervision Identity Drift

Branch `feat/o5-supervision-drift`; base commit `1be6020`; task `O5`.

## Specs

1. **S1 Objective:** "harden supervision so the master compares mailbox report identity with live Herdr agent identity and emits deterministic reassignment or escalation directives without false completion."
2. **S2 Anchors:** "Use the O4 sender anchors (session, tab, workspace, worktree, branch, parent) and live herdr agent list/get data."
3. **S3 Public decision:** "Define a public supervision decision function/command with explicit outcomes for exact match, identity drift, missing agent, stale/silent report, blocked human prompt, and terminal report."
4. **S4 No false completion:** "A mismatched or missing live identity must never become READY/CLOSED; return a compact deterministic directive containing task, prior owner, reason code, required parent action, and whether reassignment is permitted."
5. **S5 Compatibility:** "Preserve legacy uppercase states and O4 parent acknowledgement semantics."
6. **S6 Safety:** "Do not prompt or stop agents automatically in this task; produce the decision only."
7. **S7 Scope and checks:** "Allowed edit surfaces: skills/pi-herdr-orchestrator/scripts/mailbox.mjs or one focused supervision module under skills/pi-herdr-orchestrator/scripts/, focused public tests, references/supervision.md, references/state-protocol.md, and one ODD task note under odd/tasks/. Do not edit lock.mjs, publish workflows, O7 files, or live Herdr state. Test-first: RED tests for exact match, drift, missing agent, stale/silent, blocked, terminal, and no-false-completion paths. Run npm test, syntax, diff, and applicable strict checks once. Commit only with normal hooks; no --no-verify, push, PR, or merge. If review consent appears, stop and report the exact decision."

## Tasks

- T1 (S1-S7): Add RED public tests for supervision identity and lifecycle decisions. Commit: pending.
- T2 (S1-S7): Implement deterministic supervision decision function and CLI using mailbox and live Herdr identity data. Commit: pending.
- T3 (S1-S7): Document the decision contract and run required checks. Commit: pending.
- T4 (S1-S7): Commit through normal hooks and hand off to `master-orchestration`; parent acknowledgement remains required for closure. Commit: pending.

## Log

- L1: MASTER DIRECTIVE: Implement O5 after accepted O4 commit 1be6020. Objective: harden supervision so the master compares mailbox report identity with live Herdr agent identity and emits deterministic reassignment or escalation directives without false completion.

Use the O4 sender anchors (session, tab, workspace, worktree, branch, parent) and live herdr agent list/get data. Define a public supervision decision function/command with explicit outcomes for exact match, identity drift, missing agent, stale/silent report, blocked human prompt, and terminal report. A mismatched or missing live identity must never become READY/CLOSED; return a compact deterministic directive containing task, prior owner, reason code, required parent action, and whether reassignment is permitted. Preserve legacy uppercase states and O4 parent acknowledgement semantics. Do not prompt or stop agents automatically in this task; produce the decision only.

Allowed edit surfaces: skills/pi-herdr-orchestrator/scripts/mailbox.mjs or one focused supervision module under skills/pi-herdr-orchestrator/scripts/, focused public tests, references/supervision.md, references/state-protocol.md, and one ODD task note under odd/tasks/. Do not edit lock.mjs, publish workflows, O7 files, or live Herdr state. Test-first: RED tests for exact match, drift, missing agent, stale/silent, blocked, terminal, and no-false-completion paths. Run npm test, syntax, diff, and applicable strict checks once. Commit only with normal hooks; no --no-verify, push, PR, or merge. If review consent appears, stop and report the exact decision.

REPORTING: ORCH_RUN=master-herdr-20261024, ORCH_AGENT=o5-supervision, ORCH_MASTER=master-orchestration. Report WORKING at directive receipt, RED, implementation, verification, and handoff with exact branch/worktree/session/tab, checks, risks, evidence, and next action. Finish READY, DEVELOPMENT, BLOCKED, or FAILED. The master must acknowledge the result before closure.

- L2: Implemented the read-only `decideSupervision` function and `mailbox.mjs supervise` command. The decision compares all six O4 sender anchors, normalizes Herdr list/get fields, fails closed for identity drift, missing agents, stale/silent reports, blocked prompts, legacy reports, and unacknowledged terminal reports, and preserves parent acknowledgement semantics. `status` now exposes the decision and never reports a drifted or missing identified report as safe completion. Focused mailbox tests pass after the RED fixture correction; final repository checks remain pending.

- L3: Final checks passed for `npm test` (25/25), both `node --check` commands, and `git diff --check`; `npm run check:strict` remains blocked by the pre-existing `pi-compaction-owner` conflict. Native assess marked the candidate high risk and the independent verifier was unavailable. Native Gentle review started an O5 medium-risk lineage but returned `answer-consent`; the task is BLOCKED pending the master's exact grant/decline decision. No review capture, commit, push, PR, merge, prompt, or stop occurred.
