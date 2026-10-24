# O7 Model-Fit Evidence Boundary

## Specs
1. Define a read-only, versioned `pi-model-fit` evidence boundary for orchestration.
2. Accept only explicit `PASS`, `UNKNOWN`, `BLOCKED`, and `NOT RUN` outcomes.
3. Require source, timestamp/age, evidence reference, and separate entitlement/inference/quota dimensions.
4. Return `UNKNOWN` or `BLOCKED` for malformed, stale, unavailable, or entitlement-unknown envelopes.
5. Use `pi-model-fit` commit `1df6b902` as evidence only; do not invoke SkillOpt harvest/run/adopt and do not mutate routing or model matrices.

## Tasks
- T1 (S1-S4): Add public-interface RED tests for valid, malformed, stale, unavailable, and UNKNOWN envelopes; commit: pending.
- T2 (S1-S5): Implement the read-only versioned evidence boundary and minimal test wiring; commit: pending.
- T3 (S1-S5): Run required checks, inspect the diff, and commit through normal hooks; commit: pending.

## Log
- L1: MASTER DIRECTIVE: Implement O7 under approved issue #15 in this isolated worktree. Define a read-only, versioned pi-model-fit evidence boundary for orchestration. Accept only explicit PASS, UNKNOWN, BLOCKED, and NOT RUN outcomes with source, timestamp/age, evidence reference, and separate entitlement/inference/quota dimensions; return UNKNOWN or BLOCKED for malformed, stale, unavailable, or entitlement-unknown envelopes. Do not invoke SkillOpt harvest/run/adopt and do not mutate routing or model matrices. Use pi-model-fit commit 1df6b902 as evidence only; do not edit that repository.
- L2: Allowed edit surfaces: one orchestration evidence-contract module under `skills/pi-herdr-orchestrator/scripts/`, its public-interface tests, minimum package test wiring, and this task note. `mailbox.mjs`, `lock.mjs`, publish workflows, and live settings are out of scope.
