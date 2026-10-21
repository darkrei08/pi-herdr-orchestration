Feature: Remove GitHub Actions Node.js 20 runtime warnings
Issue: #11 (status:approved)
Branch: fix/actions-node24-runtime

## Specs

S1. "Rischi residui: solo warning GitHub relativi alla deprecazione Node.js 20 e migrazione dei runner; nessun blocco di pubblicazione."

S2. Update the repository workflows to use the current Node.js 24-compatible major versions of the checkout and setup-node actions without changing the package's tested Node.js version.

## Tasks

- T1 | S1-S2 | Update checkout/setup-node action references in publish and validation workflows | commit: pending
- T2 | S1-S2 | Verify workflow references, package checks, and repository diff without creating a release | commit: pending

## Log

L1. User request: procedi con Rischi residui: solo warning GitHub relativi alla deprecazione Node.js 20 e migrazione dei runner; nessun blocco di pubblicazione.
L2. Evidence: `.github/workflows/publish.yml` and `.github/workflows/validate.yml` use `actions/checkout@v4` and `actions/setup-node@v4`; current official releases are checkout v7.0.1 and setup-node v7.1.0 with Node.js 24 action runtimes.
L3. Scope decision: change only workflow action majors to v7; retain the project's Node.js 22 test runtime and do not create a package release/tag in this maintenance change.
L4. Verification: npm test passed; npm pack --dry-run passed for package version 1.2.6; workflow YAML parsed successfully; git diff --check passed; no checkout/setup-node v4 references remain; only the two requested workflow files changed besides this task record.
