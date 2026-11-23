# Release v1.5.1
Branch: `fix/explicit-workflow-skill-reset`; release is authorized by the user and must preserve unrelated dirty worktrees.
Status: in progress

## Specs

1. **S1**: "Fai tutto il ciclo di pubblicaizone pr puah merge release nom e dinstalla localmente"
2. **S2**: Complete the repository's documented PR, merge, release, npm publication, and local installation flow without introducing unrelated functional changes.
3. **S3**: Preserve unrelated local changes and report every blocked or unavailable check honestly.

## Tasks

- T1 | S1-S3 | Add release metadata for the verified workflow child-loadout fix and run local release gates | commit: 3803e0b
- T2 | S1-S3 | Push the candidate branch, open the PR, verify required checks, and merge it | commit: pending
- T3 | S1-S3 | Tag and publish the matching npm/GitHub release, install it locally, and verify the installed package | commit: pending

## Log

- L1: 2026-11-23 user request verbatim: "Fai tutto il ciclo di pubblicaizone pr puah merge release nom e dinstalla localmente"
- L2: Existing verified candidate: commits `62e5ce5`, `2a030f5`, and `936fa68` on `fix/explicit-workflow-skill-reset`; source worktree is clean and previous focused/full checks passed.
- L3: The historical primary checkout has unrelated dirty `.gitignore`, `.pi/workflow-owner.json`, and `odd/tasks/open-source-stack-completion-20261119.md`; all release work stays in the clean candidate worktree.
- L4: Commit `3803e0b` contains the release metadata and coordination records; local release gates passed before publication.
