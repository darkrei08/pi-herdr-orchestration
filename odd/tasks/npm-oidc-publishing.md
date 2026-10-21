Feature: Durable npm trusted publishing for pi-herdr-orchestration
Issue: #7 (status:approved)
Branch: fix/npm-oidc-publishing

## Specs

S1. "procediamo alla soluzione defintiva"

S2. "dammi i comandi anche per sistemare per futuro altri progetti pubblicabili su npm"

## Tasks

- T1 | S1 | Replace token-optional npm publication with GitHub Actions OIDC trusted publishing and enforce tag/package-version parity | commit: 8c90dfc
- T2 | S2 | Document one-time package bootstrap, npm login/trust commands, 2FA/GAT constraints, and a reusable future-project checklist | commit: 8c90dfc
- T3 | S1-S2 | Verify the workflow/documentation changes without touching credentials or the active Herdsman worktree | commit: 8c90dfc

## Log

L1. User request: procediamo alla soluzione defintiva e dammi i comandi anche per sistemare per futuro altri progetti pubblicabili su npm
L2. Current evidence: package.json is unscoped `pi-herdr-orchestration@1.2.2`, the repository has release tag v1.2.4, npm has no published package, and the current workflow skips publication when NPM_TOKEN is absent.
L3. Security decision: use npm Trusted Publishing/OIDC for steady-state releases; do not create or store a bypass-2FA GAT. The package must exist and account-level 2FA must be enabled before `npm trust` can be configured.
L4. Implementation scope: `.github/workflows/publish.yml` now requires npm 11.15+, validates tag/package-version parity, and publishes through OIDC without `NPM_TOKEN`; `docs/releasing.md` documents bootstrap, login, trust, release, and reusable future-project commands; README links the guide.
L5. Verification: npm test passed; npm pack --dry-run passed; PyYAML parsed the workflow and assertions confirmed id-token write, tag/version validation, OIDC publish, and no NPM_TOKEN; git diff --check passed. `node scripts/check.mjs` remains blocked by the repository's pre-existing pi-compaction-owner conflict.
L6. Native Gentle review closed as escalated/informational with unknown causality for OIDC-permission findings; independent workflow assertions confirm the required top-level `id-token: write` permission is present. No credentials, npm account state, active Herdsman worktree, push, or publication were mutated.
