# Repository Orchestrator compatibility

## Goal
Make the skill verifiably usable across Pi, Codex, Claude Code, Antigravity, and Antigravity CLI without claiming unavailable integrations.

## Scope
- Add a read-only runtime capability check.
- Correct stale compactor and installer documentation.
- Install the local skill into supported agent skill roots with the official `skills` CLI.
- Rewrite the README in English with source links and verification commands.

## Acceptance checks
- `node scripts/check-environment.mjs --json` returns truthful capability records and exits non-zero only for required failures.
- All documented references use runtime discovery rather than a single hard-coded Pi VCC package.
- The skill is present and contains `SKILL.md` in the four requested non-Pi global agent roots, when those roots are available.
- README is English and links to official upstream sources.
- No secrets, credentials, or unrelated user changes are modified.

## Status
- [x] Audit runtime and skill contracts.
- [x] Add executable capability verification.
- [x] Correct compatibility documentation.
- [x] Install and verify skill for supported agents.
- [x] Rewrite English README and run checks.

## Evidence
- Current branch: `main`.
- Pre-existing untracked file: `.gitignore`; preserved unchanged.
- Official local install completed with `npx --yes skills add . --skill repository-orchestrator --agent codex claude-code antigravity antigravity-cli --global`.
- The official installer uses `/root/.agents/skills/repository-orchestrator`; Claude Code resolves through a symlink and the other requested agents resolve through the universal root.
- Capability report: host JSON and strict checks pass with `required_failures: 0`; all four requested agent checks resolve to `installed`.
- `node --check`, `git diff --check`, and the Debian, Ubuntu, Fedora, Arch, openSUSE and Alpine container rows pass.
- GGA v2.10.1 was initially blocked because this repository had no `AGENTS.md`; a minimal repository rules file and scoped `.gga` patterns were then added.
- GGA v2.10.1 subsequently passed `gga run` on the staged candidate; the index was restored to its pre-check unstaged state.
- Windows and macOS rows were not run because the host is Linux; no Windows/macOS runner is available.
- Pi 0.87.1, PiWorkflow 5.17.1, GGA 2.10.1, Herdr 0.9.1, Gentle packages, and `@sting8k/pi-vcc` are installed.
- `pi-codex-context` is configured in Pi settings; `@adamjen/pi-vcc` is not the active package.
