# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.5.2] - 2026-11-25

### Added
- **Proxmox Host-Node Validation Guidance (`skills/pi-herdr-orchestrator/references/quality.md`, `skills/pi-herdr-orchestrator/references/routing.md`)**: Prefer disposable LXC/VM guests on the Proxmox host node for pre-production commit and task validation, without replacing them with Docker Compose on the local Pi machine. Mirrors the Engineering Excellence `platform-testing.md` host matrix and Proxmox container/VM guidance applied to the installed global skills.

## [1.5.1] - 2026-11-23

### Fixed
- **Explicit Child Skill Loadouts (`README.md`, `skills/pi-herdr-orchestrator/SKILL.md`, `skills/pi-herdr-orchestrator/references/routing.md`)**: Reset inherited skill selectors before applying verified workflow-specific skills, preventing stale host skills from blocking dispatch.
- **Writer Worktree Routing (`skills/pi-herdr-orchestrator/SKILL.md`, `skills/pi-herdr-orchestrator/references/routing.md`)**: Require isolated worktrees for writing children while allowing read-only scouts to use the shared source worktree when their tools are read-only.

### Tests
- **Dispatch Contract Regression (`skills/pi-herdr-orchestrator/scripts/dispatch.test.mjs`)**: Assert that documented workflow loadouts clear inherited skills before selecting explicit capabilities.

## [1.5.0] - 2026-11-22

### Added
- **Zero-Dependency Linter (`scripts/lint.mjs`)**: Added `npm run lint` and `npm run lint:json` with syntax checks and source rules for whitespace, line endings, duplicate lines, multiple statements, work markers and loose equality. CI now runs the linter on every validation matrix row.
- **Linter Tests (`scripts/lint.test.mjs`)**: Added focused tests for clean sources, every rule, file-level suppression and finding locations.

### Fixed
- **Statement Layout (`scripts/flow-glossary.mjs`, `skills/pi-herdr-orchestrator/scripts/mailbox.mjs`)**: Split two multiple-statement lines without changing behavior.

## [1.4.0] - 2026-11-22

### Added
- **Context Window Policy (`config/context-window.json`, `scripts/check-context-window.mjs`)**: Enforced a 300000-token ceiling with a 276000-token compaction trigger for the orchestrator and workflow children, mirrored into dotenv and PiWorkflow role policy.
- **Worktree Factory (`scripts/worktree-factory.mjs`)**: Added deterministic creation and audit commands for isolated worktrees derived from `origin/main`, plus cleanup rules and evidence.
- **Workflow Context Directive (`extensions/workflow-autostart.mjs`)**: Appended pi-vcc compaction, vcc_recall, Engram, codemode, and context-ceiling guidance to parent and child prompts.
- **Extension Startup Integrity (`model-preflight.mjs`)**: Warns at `session_start` on missing local extensions and unresolved critical modules without blocking routing.

### Changed
- **Herdr Workflow Topology:** Documented the default current-tab sibling-pane tree, nested pane ownership, focused-pane zoom control, and explicit-only workspace, tab, or cwd changes; isolated writer worktrees remain unchanged.

### Fixed
- **TypeBox Peer Fallback (`extensions/workflow-autostart.mjs`)**: Registry resolution now falls back to the local PiWorkflow fork when the npm registry cannot import its `typebox` peer, so `agentPreparationHooks` still register.

## [1.3.1] - 2026-11-22

### Fixed
- **Review Evidence Contract (`references/state-protocol.md`)**: Documented the digest formula actually used by the mailbox and added a guard test so the published package cannot ship the stale `.gga` description.
- **Portable Provider Binding (`scripts/mailbox.mjs`)**: Config digests now bind committed `AGENTS.md` plus repository-tracked `skills/pi-herdr-orchestrator/reviewer-profile.gga`, restoring provider-configuration binding without a machine-local `.gga` dependency.
- **Evidence Verification Call Sites (`scripts/mailbox.mjs`)**: Terminal report and replay paths now share `verifyBindingChain`, which performs shape, stored-evidence, and real provider checks instead of trusting shape-only validation.
- **Stale Lock Reclaim (`scripts/lock.mjs`)**: Re-reads and compares owner identity before removing a stale lock, closing a TOCTOU that could delete a freshly published owner.

## [1.3.0] - 2026-11-22

### Added
- **Process-Identity Mailbox Locks (`skills/pi-herdr-orchestrator/scripts/lock.mjs`)**: Lock owners now publish a UUID and Linux boot-id/start-ticks identity atomically, so stale locks are not mistaken for a reused PID.

### Fixed
- **Portable Review Evidence (`skills/pi-herdr-orchestrator/scripts/mailbox.mjs`)**: The evidence config digest now binds only committed `AGENTS.md` rules, so validation works in clean checkouts where the machine-local `.gga` profile is absent.

## [1.2.6] - 2026-10-21

### Changed
- **npm Trusted Publishing (`.github/workflows/publish.yml`)**: Release tags now require exact parity with `package.json`, and npm publication uses GitHub Actions OIDC instead of an optional long-lived `NPM_TOKEN`.
- **Release Documentation (`docs/releasing.md`)**: Documented one-time npm bootstrap, trusted publisher setup, and the reusable release procedure for future npm projects.

## [1.2.2] - 2026-10-10

### Fixed
- **Cross-Platform Lock Resolution (`skills/pi-herdr-orchestrator/scripts/lock.mjs`)**: Replaced slash-split path parsing with `basename` from `node:path`, correctly handling Windows backslashes and eliminating `EINVAL` exceptions.

## [1.2.1] - 2026-10-10

### Added
- **Automated Release & Publish Pipeline (`.github/workflows/publish.yml`)**: Tag-triggered GitHub Action that automatically extracts version-specific changelog notes from `CHANGELOG.md`, attaches them to GitHub Releases, and publishes to the npm registry.
- **Cross-Platform CI Validation Matrix (`.github/workflows/validate.yml`)**: Automated CI verifying test suites and environment checks across Ubuntu, macOS, and Windows.

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
