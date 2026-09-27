# Publish dependency bootstrap

## Goal
Publish the dependency bootstrap and make every README-managed software capability use its official OS-compatible installer when missing.

## Scope
- Extend the bootstrap to cover Gentle AI/Engram, Guardian Angel and Herdr in addition to Wizard-AI, PiWorkflow, TOON/LEA, RTK/sqz, Serena, graphify and LLMLingua.
- Preserve Vekexasia dotenv ownership: pi-codex-context owns compaction and Pi VCC remains skipped.
- Keep the Skills CLI limitation explicit: `skills add` installs files; the explicit bootstrap applies missing installers.
- Verify the final published branch and current Pi global installation.

## Acceptance checks
- Official installers are selected per POSIX/Windows where documented; unsupported OS paths fail closed.
- Existing capabilities are detected and skipped; no duplicate compactor, memory, workflow or repository hooks are installed automatically.
- README sources and bootstrap instructions are current.
- Local syntax, dry-run, strict report, container matrix and remote Skills CLI tests pass.
- Commit and push the coherent feature branch after checks.

## Status
- [x] Extend official installer coverage.
- [x] Verify locally.
- [x] Commit and push the coherent feature branch.
- [ ] Windows/macOS installer rows remain unverified on this Linux host.

## Evidence
- `bootstrap-dependencies.mjs` now detects and installs missing Gentle AI/Engram, Guardian Angel and Herdr using the documented POSIX/Windows branches, verifies postconditions, and leaves GGA repository setup commands manual.
- The Skills CLI cannot run third-party post-install hooks, so the contract remains `skills add` followed by the explicit `bootstrap-dependencies.mjs --apply` command.
- Vekexasia dotenv ownership is preserved: `pi-codex-context` owns compaction and Pi VCC is never installed.
- `node --check skills/repository-orchestrator/scripts/bootstrap-dependencies.mjs`: passed.
- `node --check skills/repository-orchestrator/scripts/check-environment.mjs`: passed.
- `node skills/repository-orchestrator/scripts/bootstrap-dependencies.mjs --help`: passed.
- `node skills/repository-orchestrator/scripts/bootstrap-dependencies.mjs`: passed dry run with existing Gentle Pi, Wizard-AI, GGA and Herdr detected; no installer ran.
- `node skills/repository-orchestrator/scripts/check-environment.mjs --json` and `--strict`: passed with 0 required failures.
- Debian 13, Ubuntu 24.04, Fedora latest, Arch latest, openSUSE Tumbleweed and Alpine latest container rows passed the syntax and strict capability checks.
- The exact public `npx skills add darkrei08/repository-orchestrator --skill repository-orchestrator` command exited 0 in an isolated project before this push, but fetched the previously published revision from the default branch.
- After publication, cloning `origin/docs/official-dependency-bootstrap` and installing it through the official Skills CLI succeeded; the installed bootstrap dry run passed.
- The current Pi global skill was refreshed from the published feature branch and its bootstrap dry run passed.
- `git diff --check`: passed.
- No dependency installer was run with `--apply`; the remote branch clone and Skills CLI verification were read/install tests only.
- Windows and macOS rows were not run because this host is Linux.
- Work-unit commit `258f37d` (`feat: add official dependency bootstrap`) and closure commit are pushed to `origin/docs/official-dependency-bootstrap`.
