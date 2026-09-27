# Repository Orchestrator dependency bootstrap

## Goal
Make installation of repository-orchestrator's managed software explicit, official, documented, and safe against overlap with Gentle AI, Engram, and PiWorkflow.

## Scope
- Explain the boundary between Vercel Skills CLI installation and third-party dependency installation.
- Document every managed capability, its official installer, verification command, and overlap/skip rule in README and skill references.
- Keep the existing runtime capability report authoritative; do not silently install or add a competing compactor.
- Publish the documentation update.

## Acceptance checks
- README lists every managed capability and official source/command.
- The install path distinguishes required, optional, already-managed, and mutually exclusive components.
- Gentle AI, Engram, PiWorkflow, and active compaction ownership are not duplicated.
- Existing capability and GGA checks pass; `.gitignore` remains unrelated and untracked.
- The update is committed and pushed on a feature branch.

## Status
- [x] Define official dependency bootstrap contract.
- [x] Update README and skill references.
- [x] Verify documentation update.
- [x] Publish documentation update after explicit commit/push authorization.

## Evidence
- Base branch: `chore/official-tooling-stack`; feature branch: `docs/official-dependency-bootstrap`.
- The README now explains that `skills add` installs only skill files and documents official installers for Pi, Skills CLI, PiWorkflow, Gentle AI, Engram, GGA, Herdr, Wizard-AI, RTK, sqz and Serena.
- Graphify, TOON and LEA remain Wizard-AI/context adapters without a guessed standalone installer.
- Gentle AI, Engram, PiWorkflow and active compaction ownership are protected by explicit overlap rules.
- Preserve pre-existing untracked `.gitignore`.
- Final verification: strict environment check, JSON capability report, `sqz --version`, `sqz-mcp --help`, `gga version`, `skills --version`, and `git diff --check` all exited 0.
- Optional gaps remain `serena`, `graphify`, and legacy `@adamjen/pi-vcc`; no required failures or compaction conflicts.
- `sqz init --global` was run, but generated repository files were removed and the pre-existing `AGENTS.md` content was restored.
- Published after explicit authorization: the documentation is part of squashed commit `35d3363`, merged into `main`.
