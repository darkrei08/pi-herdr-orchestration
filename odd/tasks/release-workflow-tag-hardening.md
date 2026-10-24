Feature: Harden release workflow tag handling
Issue: #14 (status:approved)
Branch: fix/o2-release-tag

## Specs

S1. "harden .github/workflows/publish.yml so workflow_dispatch tag input cannot inject shell syntax and only strict semantic release tags are accepted."

S2. "Pass the input through env, avoid direct GitHub-expression interpolation inside run scripts, resolve push-derived or package-derived tags safely, validate ^v[0-9]+\\.[0-9]+\\.[0-9]+$, and preserve valid tag/version outputs."

S3. "Test-first: add RED coverage for direct interpolation, malformed tags, and valid push/manual/package paths, then implement."

S4. "Run npm test, node scripts/check.mjs, diff checks, and applicable strict checks once."

## Tasks

- T1 | S1-S3 | Add deterministic RED/GREEN coverage in the existing workflow test entrypoint | commit: pending
- T2 | S1-S2 | Harden publish.yml tag input handling and strict validation | commit: pending
- T3 | S4 | Run required checks and record native/GGA review outcome | commit: pending

## Log

L1. User request: MASTER DIRECTIVE: Implement O2 from approved issue #14 in this isolated worktree. Objective: harden .github/workflows/publish.yml so workflow_dispatch tag input cannot inject shell syntax and only strict semantic release tags are accepted. Pass the input through env, avoid direct GitHub-expression interpolation inside run scripts, resolve push-derived or package-derived tags safely, validate ^v[0-9]+\\.[0-9]+\\.[0-9]+$, and preserve valid tag/version outputs.
L2. Issue #14 acceptance criteria: inputs.tag is not interpolated directly into a run block; manual and push-derived tags are validated against the strict semantic pattern; valid tag/version outputs remain unchanged; a deterministic static test rejects direct interpolation or missing validation; npm test, node scripts/check.mjs, and git diff --check pass.
L3. RED evidence: npm test failed before implementation on direct interpolation and valid-path coverage; malformed cases were nonzero because the original GitHub expression was invalid shell.
L4. Implementation evidence: INPUT_TAG is passed through env, GITHUB_REF and package version resolve push/package paths, strict semantic validation runs before package parity, all run scripts avoid GitHub expressions, and outputs remain package/tag/version.
L5. Verification evidence: npm test and git diff --check pass. node scripts/check.mjs and npm run check:strict are blocked by the pre-existing pi-compaction-owner conflict.
L6. Native/GGA evidence: native Gentle review ran with risk, readability, and reliability lenses for the four-path candidate and completed approved acknowledgement for lineage review-05d864eb47105088. Native review was an outside review only; no publish or delivery action was authorized.
L7. Scope correction: workflow assertions live in skills/pi-herdr-orchestrator/scripts/publish-workflow.test.mjs, package.json runs both deterministic test files, and skills/pi-herdr-orchestrator/scripts/mailbox.test.mjs was restored exactly to e7b2c2d.
