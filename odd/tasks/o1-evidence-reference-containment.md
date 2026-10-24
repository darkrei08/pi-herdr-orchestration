# O1 Evidence Reference Containment

## Specs
1. Require exact `ref:sha256:<64 lowercase hex characters>` evidence references.
2. Reject path separators, malformed lengths, and invalid prefixes before any file read.
3. Canonical-resolve the candidate evidence file and enforce containment within the run's `evidence` directory.
4. Preserve the full-hash public contract and existing legacy uppercase mailbox states.
5. Keep changes limited to `skills/pi-herdr-orchestrator/scripts/mailbox.mjs`, its public-interface tests, and this task note.

## Tasks
- T1 (S1-S5): Add public-interface regression tests and implement validation; commit: pending.
- T2 (S1-S5): Run required checks, inspect the diff, and commit through normal hooks; commit: pending.

## Log
- L1: MASTER DIRECTIVE: Implement O1 from approved issue #6 in this isolated worktree. Objective: harden skills/pi-herdr-orchestrator/scripts/mailbox.mjs evidence-reference reads against path traversal. Require exact 64-hex SHA-256 references, reject separators, invalid length, and invalid prefix, canonical-resolve the candidate file, and enforce containment within the run evidence directory. Preserve the full-hash public contract and existing legacy states.
- L2: Tests will cover a valid full-hash reference, traversal/separator input, malformed length, and missing evidence through the exported evidence interface.
