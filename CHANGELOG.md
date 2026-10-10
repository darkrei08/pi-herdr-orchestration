# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-10-10

### Added
- **Native Pi Extension (`extensions/index.mjs`)**: Direct model-facing coordination tools eliminating shell process overhead and context pollution:
  - `orch_report`: Atomic task status reporting with monotonic sequence tracking.
  - `orch_status`: Supervision dashboard joining mailbox state with live Herdr agent status.
  - `orch_ask`: Structured question submission allowing blocked workers to query the master.
  - `orch_reply`: Master response delivery returning workers to active working state.
  - `orch_evidence`: Dedicated evidence storage returning compact semantic references.
  - Interactive `/orch` command for live TUI dashboard notifications.
- **Lock-Based Mailbox (`skills/pi-herdr-orchestrator/scripts/lock.mjs`)**: Atomic directory locking (`withLock`) preventing race conditions and corrupted writes across concurrent Herdr panes.
- **Semantic Evidence Storage (`storeEvidence`)**: Offloads large test outputs, build logs, and multi-file diffs to disk (`.git/orchestrator/<run>/evidence/<sha256>.txt`), passing only `ref:sha256:...` references to protect context windows.
- **Bi-directional Ask/Reply Protocol**: Workers flag `BLOCKED` with specific questions; master resolves them asynchronously without blind loops or hanging.
- **Automated CI/CD Workflows (`.github/workflows/`)**:
  - `validate.yml`: Multi-OS test matrix (Ubuntu, macOS, Windows).
  - `publish.yml`: Automated tag-triggered release pipeline for GitHub Releases and npm registry.

### Fixed
- **Bridge Network & Extension Loading (R3-001)**: Removed `--offline` and `--no-extensions` from `agents/gga-pi/bin/kilo`, allowing CLIProxyAPI extensions to load and connect properly.
- **Uninitialized Run Directory Crash (R3-002)**: Added safe directory existence check in `mailbox.mjs status` preventing unhandled `ENOENT` exceptions.
- **Pre-commit Review Provider**: Configured Gentleman Guardian Angel (GGA) to review changes with `kilo:cliproxyapi/gemini-3.8-flash-high` with high reasoning effort.

## [1.1.0] - 2026-10-09

### Added
- **Active Supervision Loop (`references/supervision.md`)**: Continuous master supervision lifecycle joining Herdr agent liveness (`working`, `idle`, `done`, `blocked`) with task reports (`OK`, `DECIDE`, `SILENT`, `STALE`, `NEEDS_HUMAN`, `GONE`).
- **Mandatory Report-Back Clause**: Contractual requirement in every worker brief enforcing periodic and terminal reporting.
- **Root Mailbox Proxy (`scripts/mailbox.mjs`)**: Repository-root runner for convenient CLI status and report commands.
- **Pi Package Gallery Metadata**: Added `pi-package` keyword and `pi.skills` manifest in `package.json` for indexation.

### Fixed
- **Supervision & Transport Gap**: Replaced unilateral dispatch with bidirectional reporting contracts and live inspection.

## [1.0.0] - 2026-10-08

### Added
- **Initial Release**: Deterministic multi-agent repository orchestration for Pi and Herdr.
- Master, department chiefs, and isolated Git worktree worker execution.
- Quality gates: Guardian Angel (GGA), test-first verification, and two-tier integration queue.
- Environment verification and dependency bootstrap scripts.
