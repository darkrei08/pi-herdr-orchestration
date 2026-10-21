Feature: Clean npm release v1.2.6
Issue: #7 (status:approved)
Branch: release/v1.2.6

## Specs

S1. "Conserva v1.2.5 e usa v1.2.6"

S2. Publish the first clean package version through the OIDC workflow after the trusted-publishing workflow is merged.

## Tasks

- T1 | S1 | Align package.json to version 1.2.6 without modifying the preserved v1.2.5 tag/release | commit: 47f6513
- T2 | S1-S2 | Add changelog notes for the clean OIDC release preparation | commit: 47f6513
- T3 | S2 | Run release checks and prepare the tag/PR path without touching the active dirty worktree | commit: 47f6513

## Log

L1. User selected: "Conserva v1.2.5 e usa v1.2.6".
L2. Existing v1.2.5 is preserved because it points to active commit 5f82c53, has package.json version 1.2.2, and its old workflow skipped npm publication.
L3. This branch is based on PR #8's OIDC workflow commit c8b1c30; it must not be tagged until PR #8 is merged into main.
L4. Prepared package.json version 1.2.6 and added a changelog entry documenting the OIDC release path. The tag will be created only after PR #8 and this release preparation are merged into main.
L5. Verification: npm test passed; npm pack --dry-run passed; git diff --check passed. `node scripts/check.mjs` remains blocked by the pre-existing local pi-compaction-owner conflict; GitHub CI is the authoritative cross-platform gate for this release path.
