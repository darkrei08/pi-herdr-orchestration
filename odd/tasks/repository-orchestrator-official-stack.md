# Repository Orchestrator official stack

## Goal
Verify every software capability referenced by the skill, install missing optional tooling through official installers, update the skill with truthful host evidence, and publish the coherent change.

## Scope
- Inventory software named by the skill and classify installed, missing, fallback, legacy, or managed capabilities.
- Install missing optional tooling using the documented official installer, without installing competing compactors.
- Update skill documentation and the capability report only with verified behavior and versions.
- Verify the candidate, create a work-unit commit, and publish the requested repository change.

## Acceptance checks
- Every referenced software capability has an evidence-backed status and installation source.
- Missing optional tools are installed through their official documented path or recorded as blocked with the exact reason.
- The skill and capability checker describe the actual installed stack and safe fallbacks.
- Relevant checks pass, GGA is configured and runnable, and no unrelated `.gitignore` changes are included.
- The coherent change is committed and published to the configured remote.

## Status
- [x] Inventory skill-referenced software and official installation plan.
- [x] Install missing official optional tooling.
- [x] Update skill with verified stack and install guidance.
- [x] Verify and publish the skill.

## Evidence
- Branch: `chore/official-tooling-stack`, based on `main`; remote is `https://github.com/darkrei08/repository-orchestrator`.
- Installed: Pi 0.87.1, pi-extensible-workflows 5.17.1, pi-codex-context as active compaction owner, @sting8k/pi-vcc 0.7.3, Gentle AI 3.7.0, Gentle Engram 0.1.16, GGA 2.10.1, Herdr 0.9.1, Claude CLI, Codex CLI, and global Skills CLI 1.7.0.
- Wizard-AI core is present at `~/.wizard-ai` version 0.49.0 with context adapter sources, but its command is not on `PATH`; its dependent RTK, sqz, Serena and graphify executables are unavailable.
- The official Wizard-AI setup was attempted once and stopped on Python dependency wheel builds with `No space left on device`; it was not retried. No overlapping Gentle/Engram/PiWorkflow alternative was installed.
- RTK, sqz, Serena and graphify remain `missing`/blocked rather than being installed independently, because the skill directs them through Wizard-AI and the user prohibited overlapping installations.
- Legacy `@adamjen/pi-vcc` is intentionally not installed because another compaction owner is active.
- GGA v2.10.1 passed the staged candidate with exit `0`; it reported only non-blocking observations about stale branch text and Pi-root verification.
- Preserve pre-existing untracked `.gitignore`.
- Work-unit commit: `12b2ae2 feat: document official tool compatibility stack`.
- Published branch: `origin/chore/official-tooling-stack`.
