Feature: hierarchical-supervisor-loop
Issues: #6 (approved enhancement) and #13 (approved bug), extending the mailbox/lifecycle contract and ordered Herdr dispatch without replacing legacy states
Branch: dedicated feature worktree to be created from the current orchestration branch

## Specs
1. S1: "Design a TypeScript/PiWorkflow loop for pi-herdr-orchestration that continuously receives directives, delegates work to Pi agents in other Herdr tabs or panes, handles help requests, returns results to the master, and reconciles all requests."
2. S2: "Continue the analysis and implementation and inspect the other Pi session."
3. S3: "Commit only after all workflows and evaluations are complete and audited; then notify me and provide a step-by-step report of staged commits and delivery choices."
4. S4: The existing approved issue #6 requires compatibility with current Herdsman supervision semantics, backward-compatible uppercase states, durable evidence references, non-blocking notification behavior, explicit destructive-operation boundaries, and the exact checks `npm test` and `git diff --check` plus applicable GGA/native checks.
5. S5: "Use Pi Orchestration as the master to assign further work, read reports, and reassign directives to apparently blocked Pi agent sessions. Improve session and Herdr-tab naming while keeping one master authority or bounded activity-specific coordinators."
6. S6: "Make pi-herdr-orchestration support swarm-like coordination and include fixes for Pi agent message sending and receiving."

## Tasks
- T1 | S1-S5 | Reconcile the existing hierarchical supervisor and ordered Herdr dispatch implementations, preserving one root Master authority with activity-scoped Chief coordinators | commit: pending
- T2 | S1-S5 | Extend durable report consumption, chief-to-master normalization, deterministic reassignment, and bounded recovery without breaking legacy mailbox states | commit: pending
- T3 | S2,S5 | Add executable session/tab identity reconciliation that derives stable names from task role and assignment, detects drift, and never treats labels as authority | commit: pending
- T4 | S1,S3,S5 | Expose the smallest native directive/status controls and document the master-centered hierarchy, report loop, naming rules, precedence, and final delivery gate | commit: pending
- T5 | S1-S5 | Run RED-GREEN tests, repository checks, applicable GGA/native checks, and an integration audit against the existing approved branches | commit: pending
- T6 | S6 | Harden worker/master message routing with a durable mailbox receive path, distinct Herdr-agent targets, self-target suppression, and non-blocking delivery failure semantics | commit: pending
- T7 | S6 | Add regression coverage and a PiWorkflow/Herdr simulation proving report, ask, reply, and self-target behavior without confusing session ids with Herdr agent names | commit: pending

## Log
- L1: "Continue the analysis and implementation and inspect the other Pi session."
- L2: Existing repository inspection found mailbox atomic writes, evidence references, `orch_report`, `orch_status`, `orch_ask`, `orch_reply`, PiWorkflow/Herdr settings, and documented Master/Chief/Worker routing. The current base branch does not yet contain the blocked O5 supervision candidate.
- L3: Existing live-session inspection found `master-orchestration` active, `o5-supervision` idle with a delivered BLOCKED report awaiting native review consent, `o2-release` idle with an uncommitted candidate and no mailbox result, and two unrelated UNKNOWN Herdr workspaces retained without closure.
- L4: The smallest compatible implementation should use ESM `.mjs` plus JSON Schema and native Node tests before introducing a TypeScript build. PiWorkflow remains the deterministic execution engine; Herdr remains pane/liveness transport; the mailbox remains durable state; Engram remains memory only.
- L5: "Use Pi Orchestration as the master to assign further work, read reports, and reassign directives to apparently blocked Pi agent sessions. Improve session and Herdr-tab naming while keeping one master authority or bounded activity-specific coordinators."
- L6: Current evidence resolves the topology choice in favor of one root `[MASTER] Pi Herdr Orchestrator` with bounded `[CHIEF/*]` activity coordinators, not peer masters. Existing 4c75ee7 already supplies directive records and a bounded supervisor planner; existing 906a7c8 supplies ordered workflow transport. New source work must extend and reconcile those contracts rather than duplicate them.
- L7: Current Herdr inspection found only the master agent live in the active workspace; two unknown panes belong to the separate `pi-extensible-workflows` repository and are not target workers. No unrelated pane will be prompted or closed.
- L8: The reported `orchestrator_send_message` failure targeted the current session id, so the message was rejected before delivery. The durable mailbox remains the correct receive path; direct wake-ups must resolve a distinct Herdr agent name and must never address the sender itself.
- L9: Added a self-target guard to `notifyAgent`, propagated the sender identity from report/ask/reply, and documented the fallback rule. Focused mailbox tests pass; workflow-level live peer delivery remains environment-dependent and is not claimed from a self-target unit test.
- L10: RED reproduced the self-target notification defect; GREEN added the guard, sender propagation, extension descriptions, and regression coverage. PiWorkflow verification passed `npm test` (15/15), `node --check`, and `git diff --check`. `npm run check:strict` remains BLOCKED by the pre-existing `pi-compaction-owner` conflict (`@sting8k/pi-vcc` plus `pi-codex-context`).
- L11: Follow-up RED exposed two remaining routing gaps: Pi session UUID/path targets were accepted as Herdr recipients, and `reply()` did not fall back to `ORCH_MASTER` when `ORCH_AGENT` was unset. GREEN added bounded Herdr-name validation, UUID/path rejection, and current-master fallback. The full suite now passes 17/17.
- L12: A second workflow review found the null-agent report edge case. GREEN now also falls back to the current master for `report()` and `ask()` when `entry.agent` is absent. The full suite passes 18/18; live Herdr delivery remains NOT RUN.
