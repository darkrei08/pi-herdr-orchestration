Owner: Lead
Status: IN PROGRESS
Scope: Implement the local task-map board, envelope transition events, PR and factory projections, and workflow documentation from Wayfinder map #90.

## Specs

S1 "possiamo proseguire con svilupopo dei ticekt e completare il progetto"

S2 "benissimo proseguiamo con lo sviluppo step by step dei ticket non ti vfermare ma solo fai grilling"

S3 "Which board target should the first Kanban view use?" resolved: "hybrid target. GitHub owns state and blockers, envelope owns session/worktree/evidence, local HTML is the static view, TaskView is the main UI with adapter-routed bidirectional writeback."

S4 "Which envelope fields and event transitions should drive the local Kanban board?" resolved: "state primary, blockers/waiting force Blocked/Waiting, extended eight-column mapping, forward-only transitions with reasoned reopen, events array in envelope."

S5 "What should scripts/task-board.mjs render from task-map-envelope/v1?" resolved: "interactive self-contained HTML via evidence file path, eight columns, full cards, extended dedup, deterministic order, automatic API calls and adapter-routed writeback with audit."

S6 "What should docs/task-board.md specify for session usage?" resolved: "full workflow doc with pull/push cycle, on-demand refresh, path and counts output, complete verification, envelope schema referenced not duplicated."

S7 "Which PR events should scripts/pr-envelope-adapter.mjs map into the envelope?" resolved: "eight PR events mapped by ticket 95 rules, idempotency org/repo/PR/event/id, dual write to mailbox and envelope."

S8 "Which software-factory stages should scripts/factory-envelope-adapter.mjs map into the envelope?" resolved: "eight board columns reused, intake and spec both in Intake, gate PASS/FAIL/BLOCKED, ODD task docs remain local authority, concepts only from GPL reference."

S9 "How should task-map-envelope/v1 carry transition events?" resolved: "twenty-field event schema, migrated legacy envelopes, audited revisions with correlation IDs, unbounded logical history with bounded rendering cap."

S10 "Which GitHub organizations and repositories should feed the factory intake filter?" resolved: "all `darkrei08` repos, `factory` label, master triage and priority, read/write all issues including Wayfinder, full in-repo audit, dry-run approval gate."

S11 "Which TaskView API surface should scripts/taskview-adapter.mjs use?" resolved: "HTTP API writeback plus signed webhooks, MCP deferred, bidirectional domain-authoritative sync, shared extended dedup key, licence already accepted."

S12 "How should the provider-neutral master orchestrator select and authorize repository providers?" resolved: "wizard plus local config, file wins but wizard revalidates and blocks on invalid config, one master token per provider, stable capability contract over versioned native adapters."

S13 "How should migration from local Herdr TUI to Herdr App and Herdr core be charted?" resolved: "stays in this map; inventory required first; Herdr core unchanged, no session restart; wizard platform choice with iOS current."

S14 "Which Windows host tests are allowed without disturbing active Herdr sessions?" resolved: "full SSH and full test suite allowed, destructive actions allowed after backup/snapshot, live tests gated by explicit host/user/scope."

## Tasks

- T01 (S1-S2): #105-#109 created and linked as subissues of map #90. Route: issue ops. Commit: N/A. Verified.
- T02 (S4, S9): Event schema, migration, revision and correction helpers added to `task-map-envelope/v1` with RED tests. Route: delegated TDD. Commit: 9f233f9. Focused PASS 15/15.
- T03 (S3-S5, S9): `scripts/task-board.mjs` implements input validation, eight columns, dedup, deterministic order, bounded event rendering and self-contained HTML. Route: delegated TDD. Commit: 9f233f9. CLI smoke PASS.
- T04 (S7): `scripts/pr-envelope-adapter.mjs` implements deterministic local projection, idempotency and dual output. Route: delegated TDD. Commit: 9f233f9. Focused PASS 6/6.
- T05 (S8, S10): `scripts/factory-envelope-adapter.mjs` implements intake mapping, gate outcomes and dry-run audit. Route: delegated TDD. Commit: 9f233f9. Focused PASS 6/6.
- T06 (S6): Added `docs/task-board.md`, package scripts and envelope reference update. Route: inline docs. Commit: 9f233f9. Verifier findings corrected before final checks.
- T07 (S1, S11-S14): #110-#113 created and linked as blocked integration tickets for TaskView, providers, Herdr App inventory and Windows host. Route: issue ops. Commit: N/A. Verified.
- T08 (S1): Focused 29/29 PASS, full suite 266/266 PASS, lint exit 0, strict check Required failures 0, `git diff --check` exit 0, CLI smoke PASS. Route: inline verification. Commit: N/A. Live integrations NOT RUN.

## Log

L1 "possiamo proseguire con svilupopo dei ticekt e completare il progetto"

L2 "benissimo proseguiamo con lo sviluppo step by step dei ticket non ti vfermare ma solo fai grilling"

L3 Scoping handoff: five local deliverables are implementable now; TaskView live setup, provider activation, Herdr App/core migration and Windows live tests require external targets, tokens or explicit authorization.

L4 Repository state: active implementation worktree is `.worktrees/telegram-evidence-report` on `feat/telegram-evidence-report`; unrelated dirty files in the primary checkout are preserved.

L5 T02 and T03 verified: focused envelope and board tests 15/15 PASS; `task-board.mjs --input /tmp/board-smoke.json --output /tmp/board-smoke.html` produced 5,160 bytes and exactly eight `data-column` sections. T06 package scripts and both docs were updated; live API writeback remains blocked by #110-#113.

L6 Independent verifier found two local gaps: cards omitted `v`, `created_at`, `team` and `project`; docs omitted counts output. RED observed for both, plus per-column stdout counts. Fixes added all envelope fields, per-column counts on stdout and docs counts wording. GREEN: board 6/6 and task-map focused 29/29.

L7 Final verification: `npm run test:taskmap` 29/29, `npm test` 266/266, `npm run lint` exit 0, `npm run check:strict` Required failures 0, `git diff --check` exit 0. Container entrypoint smoke PASS on Debian node:22-bookworm, Alpine node:22-alpine, Ubuntu 24.04 with Node 18.19.1, Fedora 42 with Node 22.22.0, Arch with Node 26.13.1, openSUSE Tumbleweed with Node 26.13.1. macOS and Windows containers NOT RUN from this Linux host.

L8 Work-unit commit: 9f233f953a37b658894e278b55b8ea05742b0669 `feat(taskmap): add local board and envelope adapters`, 1,959 insertions and 2 deletions across 11 files. Push, PR, merge and issue closure are deferred by repository policy.
