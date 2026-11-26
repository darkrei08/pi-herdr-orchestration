# Feature: persisted-graph-supervisor
Owner: pi-herdr-orchestration, extending the existing mailbox, PiWorkflow, and Herdr projection contracts
Acceptance: deterministic versioned graph state with restart recovery, bounded scheduling, zero-model-cost waits, human pause/resume, and loss-tolerant Herdr projection; no automatic merge or publish

## Specs
1. S1: "Add a deterministic graph supervisor that builds and advances a persisted orchestration DAG while keeping PiWorkflow state authoritative and Herdr panes as a best-effort visual projection."
2. S2: "Define a versioned graph state for run, phase, task/issue, agent/session, worktree, PR, gate, wait, human decision, and artifact nodes."
3. S3: "Define deterministic edges: `contains`, `delegates`, `runs-in`, `checks`, `waits-for`, `reports`, `retries`, and `produces`."
4. S4: "Build the graph from persisted workflow trajectory plus mailbox evidence, never from pane titles or ambient live state alone."
5. S5: "Advance independent nodes through PiWorkflow `parallel`/`pipeline`, isolate writes with named worktrees, and persist every transition."
6. S6: "Represent CI, external review, merge, and human decisions as zero-model-cost wait/checkpoint nodes."
7. S7: "Enforce the run budget before every transition and resume from persisted state after restart."
8. S8: "Reconcile Herdr labels using the task lifecycle, but treat missing Herdr as non-fatal."
9. S9: "Keep the existing read-only graph adapter separate from scheduling and do not merge or publish automatically."
10. S10: "A deterministic dry-run test proves DAG creation, dependency blocking, zero-agent wait polling, human pause/resume, budget blocking, and restart recovery."
11. S11: "A projection test proves pane loss or unavailable Herdr does not lose persisted graph state."
12. S12: "The graph schema is versioned and documented with bounded output and input immutability."
13. S13: Required checks: `npm run check:strict`, `npm test`, and `npm run flow:sources:check`.

## Tasks
- T1 | S1-S4,S9,S12 | Implement the pure versioned graph state model, schema, deterministic dependency planner, and immutable input normalization | route: inline | commit: efcb624
- T2 | S5-S8,S10-S11 | Implement persisted reducer transitions, budget/wait/human checkpoint handling, restart recovery, and Herdr projection | route: inline | commit: efcb624
- T3 | S10-S13 | Add dry-run, persistence, projection, and compatibility regression tests; document the supervisor contract | route: inline | commit: efcb624
- T4 | S13 | Run focused and repository checks, review the candidate, and record verified commits | route: inline | commit: efcb624

## Log
- L1: Add a deterministic graph supervisor that builds and advances a persisted orchestration DAG while keeping PiWorkflow state authoritative and Herdr panes as a best-effort visual projection.
- L2: Issue #29 is open. Existing mailbox and Herdr contracts are authoritative; the current repository has no graph supervisor implementation. A read-only scout identified `skills/pi-herdr-orchestrator/scripts/graph-supervisor.mjs`, a versioned schema, native `node:test` coverage, and `withLock`-based persistence as the smallest compatible seam.
- L3: Issue #30 remains open and is tracked separately; this feature must not claim to fix Herdr transport timeouts unless a reproducible scoped fix is implemented and verified.
- L4: Commit efcb624 passed host `npm test` (72/72), strict capability checks, source freshness, syntax/diff/schema/pack checks, GGA staged review, and Debian 13, Fedora latest, Arch latest, openSUSE Tumbleweed, and Alpine latest container test rows. The independent verifier returned PASS for S1-S13; live Pi extension execution and native Gentle review were not due/run.
- L5: Closure verification of the shipped implementation on base `d37e497` added no production code. `graph-supervisor.test.mjs` now proves zero-agent wait polling completes a `wait` node without any `agent`/`run` node, and a new projection test persists the graph, projects it with the owning pane missing and with Herdr unavailable, and reloads the identical persisted state; a scratch mutation that emptied projected nodes failed 2 tests, so the assertion is meaningful. `state-protocol.md` now documents the bounded output (`max_nodes` default 100 / max 1000, `node_count`, `nodes_truncated`, 512-character transition fields), the one-record-per-step transition, and input immutability. Verified: `node --test skills/pi-herdr-orchestrator/scripts/graph-supervisor.test.mjs` 9/9, `npm test` 146/146, `npm run check:strict` Required failures 0, `npm run flow:sources:check` 10 sources valid and none stale, `npm run lint` 47 files clean, `git diff --check` clean. NOT RUN: live Pi extension execution of `orch_graph_status`/`orch_graph_step` and live Herdr pane loss.
