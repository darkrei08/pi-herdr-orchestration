# Pi Herdr Orchestration

Deterministic, provider-agnostic multi-agent repository orchestration for coding agents. Dynamically coordinates task discovery, dependency graphs, isolated Git worktrees, terminal multiplexing with Herdr, and evidence-based verification across your entire development lifecycle.

The skill runs on **Pi**, **Claude Code**, **OpenAI Codex**, and **Google Antigravity**. It works out-of-the-box with plain Git and a single agent, and dynamically discovers optional high-leverage integrations at runtime: **PiWorkflow**, **Gentle AI / Engram**, **Herdr**, **Guardian Angel (GGA)**, **Engineering Excellence**, **Matt Pocock's skill suite**, and context reduction engines.

---

## Table of Contents

- [Overview & Core Problems Solved](#overview--core-problems-solved)
- [Architecture & Workflow Lifecycle](#architecture--workflow-lifecycle)
  - [The Command Hierarchy: Master, Chiefs, and Workers](#the-command-hierarchy-master-chiefs-and-workers)
  - [Workspace Isolation with Herdr & Git Worktrees](#workspace-isolation-with-herdr--git-worktrees)
- [Cognitive Model & Decision Pipeline](#cognitive-model--decision-pipeline)
  - [1. Independence-First Dispatch & Task Graph](#1-independence-first-dispatch--task-graph)
  - [2. Progressive Disclosure & Bounded Contexts](#2-progressive-disclosure--bounded-contexts)
  - [3. Evidence-Based Validation (Proof Before Claim)](#3-evidence-based-validation-proof-before-claim)
  - [4. Non-Polluting Compact State Protocol](#4-non-polluting-compact-state-protocol)
  - [5. Multi-Agent Supervision & Report-Back Mailbox](#5-multi-agent-supervision--report-back-mailbox)
  - [6. Two-Tier Integration & Merge Queue](#6-two-tier-integration--merge-queue)
- [Skill Ecosystem Integrations](#skill-ecosystem-integrations)
  - [PiWorkflow (`pi-extensible-workflows`)](#piworkflow-pi-extensible-workflows)
  - [Gentle AI Suite & Engram](#gentle-ai-suite--engram)
  - [Engineering Excellence](#engineering-excellence)
  - [Matt Pocock Skill Suite](#matt-pocock-skill-suite)
  - [Guardian Angel (GGA)](#guardian-angel-gga)
  - [Context Reduction & Semantic Navigation Stack](#context-reduction--semantic-navigation-stack)
  - [Dynamic Routing Table](#dynamic-routing-table)
- [Installation & Dependency Management](#installation--dependency-management)
  - [Install the Skill via Vercel Skills CLI](#install-the-skill-via-vercel-skills-cli)
  - [Dependency Bootstrap (System Runtimes & Skill Suites)](#dependency-bootstrap-system-runtimes--skill-suites)
  - [Mandatory Per-Repository Initialization](#mandatory-per-repository-initialization)
  - [Environment Verification](#environment-verification)
  - [Mailbox & Supervision Commands](#mailbox--supervision-commands)
  - [Compaction & Overlap Rules](#compaction--overlap-rules)
- [Sources & References](#sources--references)
- [License](#license)

---

## Overview & Core Problems Solved

When AI coding agents are assigned complex multi-step backlogs, monorepo refactors, or concurrent issue queues, they typically encounter critical failure modes:

1. **Agent Sprawl & Race Conditions:** Multiple agents editing the same files on the same branch create merge conflicts, clobbered changes, and broken git history.
2. **Context Window Degradation:** Ingesting full transcripts, logs, and whole-codebase dumps degrades LLM attention, leading to hallucinations and sloppy code.
3. **Premature "Done" Claims:** Agents claiming completion based on conversational prose rather than machine-verifiable test runs, linter passes, and runtime evidence.
4. **Coordination Debt:** Parallelizing tasks that secretly share dependencies or API contracts, leading to integration disasters.

**Pi Herdr Orchestration** solves these problems deterministically. It establishes a strict division of labor, runs tasks in isolated Git worktrees under dedicated Herdr terminal panes, routes domain-specific skills on demand, and requires reproducible proof before any code is merged.

---

## Architecture & Workflow Lifecycle

### The Command Hierarchy: Master, Chiefs, and Workers

The orchestrator enforces a clean separation of concerns across three distinct operational tiers:

```text
               ┌──────────────────────────────────────────────┐
               │         [MASTER] Pi Herdr Orchestrator       │
               │  (Control plane, dependency graph, decisions)│
               └──────────────────────┬───────────────────────┘
                                      │
         ┌──────────────┬─────────────┼──────────────┬──────────────┐
         ▼              ▼             ▼              ▼              ▼
   [CHIEF/SCOUT]  [CHIEF/BUILD] [CHIEF/QUALITY][CHIEF/MEMORY] [CHIEF/AUDIT]
    (Discovery)    (Execution)   (Verification) (Persistence)    (Cleanup)
         │              │             │              │              │
         └──────────────┼─────────────┴──────────────┴──────────────┘
                        │
         ┌──────────────┴──────────────┐
         ▼                             ▼
    [I#42] Auth Fix              [PR#18] Review
 (Worktree .worktrees/i42)    (Worktree .worktrees/pr18)
```

#### 1. `[MASTER] Pi Herdr Orchestrator` (The Control Plane)
- **Role:** Owns the repository scope, backlog discovery, pairwise independence analysis, worktree reservations, merge queue, and final stop conditions.
- **Golden Rule:** **The master never writes or implements code.** A master session editing code while coordinating workers is an architectural defect.

#### 2. Department Chiefs (Bounded Supervision)
When the host supports multiple sessions or subagents, the master delegates operational areas to specialized chiefs:
- **`[CHIEF/SCOUT]` (Discovery & Triage):** Maps monorepo boundaries, default branches, CI configurations, and clusters issues by root cause.
- **`[CHIEF/BUILD]` (Implementation & Worktrees):** Provisions worktrees, assigns tasks to workers, and supervises progress.
- **`[CHIEF/QUALITY]` (Verification & Reviews):** Orchestrates test execution, auto-grilling, adversarial reviews, and quality gates.
- **`[CHIEF/MEMORY]` (Hydration & Persistence):** Recalls historical ADRs and conventions via Engram and writes durable post-task learnings.
- **`[CHIEF/AUDIT]` (Reconciliation & Teardown):** Audits overall repository health and verifies resource cleanup.

*Fallback:* If the host cannot create independent subagents, the master flattens the hierarchy into structured phase headers without simulating false parallel execution.

#### 3. Workers (Task Execution Sessions)
- **Role:** Execute a single, bounded contract (`[I#42]`, `[PR#87]`, `[REV#12]`).
- **Contract Lifecycle:**
  $$\text{DISCOVER} \longrightarrow \text{UNDERSTAND} \longrightarrow \text{PLAN} \longrightarrow \text{IMPLEMENT} \longrightarrow \text{VERIFY} \longrightarrow \text{SELF-REVIEW} \longrightarrow \text{HANDOFF} \longrightarrow \text{READY}$$
- Workers never declare themselves `READY` until all validation commands pass and evidence is logged.

### Workspace Isolation with Herdr & Git Worktrees

The orchestrator guarantees clean workspace boundaries:

- **1 Task = 1 Branch = 1 Git Worktree = 1 Dedicated Session/Pane**
- **Single-Writer Rule:** Exactly one writer modifies a given worktree at any time.
- **Herdr Terminal Multiplexing:**
  - One Herdr workspace per repository.
  - Panes and tabs are created with semantic labels immediately upon startup (`repo:issue-42-auth`, `repo:pr-87-review`, `repo:compose-validation`).
  - Terminal state and processes remain persistent and inspectable even during agent context switches.

---

## Cognitive Model & Decision Pipeline

The orchestrator’s reasoning engine follows five deterministic principles:

### 1. Independence-First Dispatch & Task Graph

Concurrency is treated as an optimization tool, not an automatic default. Before dispatching any worker, the orchestrator constructs a dependency graph by performing pairwise relation analysis:

| Relation | Condition | Handling Strategy |
| --- | --- | --- |
| **Independent** | Zero overlap in files, APIs, schemas, or migrations | Dispatched concurrently in isolated worktrees |
| **Related** | Common subsystem or feature domain | Grouped into a single session or an ordered chain |
| **Sequential** | Task B depends on the output of Task A | B waits until A merges or starts directly from A's branch |
| **Conflicting** | Overlapping files, database schemas, or infrastructure | Strictly serialized; base change landed first |
| **Duplicate / Superseded** | Redundant reports or obsolete requests | De-duplicated and closed with reference |
| **Merge-Ready** | Code already exists in branch/PR | Routed to review-only session (no new code authored) |
| **Blocked** | Missing architectural decision, API key, or spec | Held in queue; no worker session launched |

Before an implementer starts, the master records an **ownership reservation** in the task registry (e.g. `frontend/auth/* -> I#42`). Any subsequent task claiming that surface is blocked or queued.

### 2. Progressive Disclosure & Bounded Contexts

Model context windows are treated as scarce, depleting resources:
- Workers **never** receive a full dump of the repository, entire issue backlogs, or preceding conversation transcripts.
- Each worker receives a **bounded brief**: exact objective, issue context, allowed and forbidden file scope, required verification commands, and completion criteria.
- Domain skills are loaded only into the specific sessions that need them, keeping the master session lean.

### 3. Evidence-Based Validation (Proof Before Claim)

Prose claims of success are rejected. Validation follows a strict **narrow-to-wide verification funnel**:

1. **Targeted Unit / Regression Check:** Failing reproduction test first, followed by minimal fix and passing test.
2. **Package-Level Suite:** Ensures no localized regressions.
3. **Type-Check & Linter:** Compiler and static analysis passes.
4. **Package Build:** Artifact compilation verification.
5. **Integration / E2E:** Cross-package compatibility.
6. **Docker Compose / Runtime Validation:** Starting disposable stacks to check service startup, migrations, health checks, and API connectivity.
7. **Browser / UI Verification:** Checking rendering, responsiveness, console logs, network errors, and accessibility.

Every check is logged as `PASS`, `FAIL`, `BLOCKED`, or `NOT RUN`. A check marked `NOT RUN` is never treated as passing.

### 4. Non-Polluting Compact State Protocol

Parent sessions never ingest worker transcripts. All cross-session communication uses the canonical `repo-orchestrator/v1` JSON envelope:

```json
{
  "v": "repo-orchestrator/v1",
  "kind": "result",
  "id": "r_20261008_042",
  "parent": "chief-build-01",
  "run": "repo-run-10",
  "sender": {
    "role": "implementer",
    "session": "pi-i42",
    "tab": "[I#42] Config loading",
    "worktree": ".worktrees/issue-42-config-loading"
  },
  "task": { "id": "I#42", "type": "issue", "goal": "Fix config loading precedence" },
  "state": "READY",
  "branch": "fix/42-config-loading",
  "summary": "Config precedence now prioritizes environment variables over file defaults.",
  "checks": [
    { "name": "unit", "status": "PASS", "ref": "test-run-884" },
    { "name": "types", "status": "PASS", "ref": "tsc-clean" },
    { "name": "gga", "status": "PASS", "ref": "gga-hash-cache" }
  ],
  "decisions": ["Preserve backward compatibility for legacy JSON configurations."],
  "risks": [],
  "blockers": [],
  "memory": { "status": "persisted", "ref": "engram:obs-88219" },
  "next": "chief-review"
}
```

Human-readable Markdown reports (such as the cycle dashboard) are generated directly from these structured envelopes.

### 5. Multi-Agent Supervision & Report-Back Mailbox

Dispatched sessions that operate without supervision or feedback loops lead to silent failures, runaway tokens, or deadlock at unhandled prompts. Real-world multi-agent orchestration operates like an executive control office:

#### The Communication & Transport Channels
1. **Native Pi Extension (`extensions/index.mjs`):** Registers model-facing orchestration tools (`orch_report`, `orch_status`, `orch_ask`, `orch_reply`, `orch_evidence`) and an interactive `/orch` dashboard command directly inside Pi, eliminating the need to spawn shell processes or pollute context windows.
2. **The Shared File Mailbox (`scripts/mailbox.mjs`):** The authoritative, durable file transport. Located under `<git-common-dir>/orchestrator/<run>/`, this directory is shared across all linked Git worktrees while remaining untracked by Git. Protected by directory-based file locking (`lock.mjs`), it ensures zero race conditions across concurrent panes.
3. **Semantic Result & Evidence Storage:** Large test suites, compile outputs, or diffs are hashed and saved to `<git-common-dir>/orchestrator/<run>/evidence/<sha256>.txt`. Only a compact semantic reference (`ref:sha256:...`) is forwarded upstream, preserving model context.
4. **Bi-directional Ask / Reply Protocol:** Blocked workers can submit questions with `orch_ask` (or `mailbox.mjs ask`). The master sees the `ASK` flag, replies with `orch_reply`, and automatically unblocks the worker without blind waiting or busy loops.
5. **Herdr Agent Liveness (`herdr agent list/get/wait/read`):** The master continuously tracks process lifecycle states (`working`, `idle`, `done`, `blocked`). Terminal state alone is never proof of completion.
6. **Mandatory Report-Back Clause in Every Brief:** No worker session is dispatched without a strict contractual reporting clause:
   - Report `WORKING` at every lifecycle phase transition and at least every 10 minutes.
   - If blocked on a question or decision, invoke `orch_ask` immediately.
   - Store large evidence logs via `--evidence` or `orch_evidence`.
   - Report `READY`, `DEVELOPMENT`, or `FAILED` as the final action with full check results.
   - Never exit silently without a mailbox report.
7. **Master Supervision Loop:** The master remains active, joining mailbox reports with live `herdr agent list` snapshots to classify each task into actionable flags:
   - **`OK`:** Healthy, reporting on schedule or cleanly closed.
   - **`ASK`:** Worker submitted a blocking question. Master replies and unblocks it.
   - **`DECIDE`:** Worker reported terminal state (`READY`, `DEVELOPMENT`, `BLOCKED`, `FAILED`). Master reconciles with Git/CI and decides next steps.
   - **`SILENT`:** Agent is idle or done in Herdr, but the last mailbox report was still `ASSIGNED` or `WORKING`. Master reads recent pane output and issues a targeted nudge.
   - **`STALE`:** Agent is still working in Herdr, but has not reported within the stale threshold (default 10 minutes).
   - **`NEEDS_HUMAN`:** Herdr detects an approval or input dialog. Master escalates to the human operator; it never approves dialogs on the user's behalf.
   - **`GONE`:** Worker agent process exited or is missing from Herdr. Master inspects the worktree and recovers or restarts.
8. **Span of Control & Discipline:** A master session supervises at most 4–6 concurrent workers (honoring host memory and cognitive capacity). Bounded retries (at most 2 nudges or restarts) prevent infinite loops. Prompt cache continuity is protected by keeping role headers static at the prompt prefix.

### 6. Two-Tier Integration & Merge Queue

The master categorizes completed work based on empirical evidence:
- **`STABLE`:** All acceptance criteria, tests, and reviews pass. Ready to merge or publish to the primary branch (`main`).
- **`DEVELOPMENT`:** Incomplete, exploratory, or partially verified work. Preserved on an isolated feature branch with a documented handoff state.

Before merging individual green branches into `main`, the master executes an **Integration Pass** on the combined branch. Independent tasks that pass in isolation can still conflict when combined; the integration pass prevents broken main branches.

---

## Skill Ecosystem Integrations

Pi Herdr Orchestration dynamically bridges and routes between major AI coding agent skill ecosystems:

### PiWorkflow (`pi-extensible-workflows`)
- **Role:** Execution engine substrate.
- **Capabilities Used:** Primitives including `workflow`, `parallel(...)`, `pipeline(...)`, `withWorktree(...)`, `shell(...)`, persistent `agent.create(...)` handles, role mappings, and recovery tools (`workflow_status`, `workflow_retry`, `workflow_resume`).

### Gentle AI Suite & Engram
- **Role:** Harness discipline, durable memory, and review authority.
- **Capabilities Used:**
  - `gentle-engram`: Persistent project memory across sessions, hydration of historical decisions, cross-agent handoffs.
  - `work-unit-commits`: Atomic, reviewable, self-contained commit slices.
  - `chained-pr`: Splitting changes exceeding 400 lines into stacked, reviewable PR chains.
  - `branch-pr`: Issue-first branch and PR creation with human-in-the-loop confirmation.
  - `rdd-defect-workflow` & `gentle_review`: Receipt-Driven Development with cryptographic review lineages.
  - `judgment-day`: Blind dual or adversarial reviews for high-stakes changes.
  - `systemic-issue-triage` & `issue-root-resolution`: Identifying shared root causes across large issue backlogs.

### Engineering Excellence
- **Role:** Software engineering standards, architecture, and production readiness.
- **Capabilities Used:** SDD (Spec-Driven Development), TDD standards, quality gates, security audits, performance profiling, accessibility/i18n standards, Docker/CI rules, `container-test-matrix` for multi-distribution testing, and context budgeting.

### Matt Pocock Skill Suite
- **Role:** Tactical developer workflows and problem breakdown.
- **Capabilities Used:**
  - `triage`: Classifying incoming issues and bug reports.
  - `wayfinder` & `to-spec`: Navigating fuzzy, ambiguous tasks into actionable specifications.
  - `to-tickets`: Decomposing specifications into atomic ticket graphs with explicit blocking edges.
  - `diagnosing-bugs`: Tight reproduction loops before code changes.
  - `codebase-design` & `improve-codebase-architecture`: Seams, deep module boundaries, and interface contracts.
  - `grill-with-docs` / `grill-me`: Adversarial stress-testing of plans and design assumptions.
  - `retro`: Retrospective learnings capture.

### Guardian Angel (GGA)
- **Role:** Provider-agnostic pre-commit and pre-PR quality gate.
- **Capabilities Used:** Verifies git diffs, rules, and repository invariants after tests and before declaring a worker `READY`. Uses hash caching to ensure idempotent verification.

### Context Reduction & Semantic Navigation Stack
- **Role:** Token preservation and AST-level exploration.
- **Capabilities Used:**
  - **Serena:** Language-server backed semantic code navigation (symbol search, call graphs) without exploratory file reads.
  - **graphifyy & LLMLingua:** Code knowledge graph construction and prompt token reduction.
  - **RTK & sqz:** Output compression and terminal filtering for large test logs and build output.
  - **Wizard-AI:** Compatibility manager for TOON/LEA tabular data encodings.

---

### Dynamic Routing Table

The orchestrator dynamically routes tasks to the minimal sufficient skill set based on the situation:

| Situation | Minimal Selected Method (First Installed Wins) |
| --- | --- |
| **Raw issue or untriaged PR** | Matt Pocock `triage`; Gentle AI `issue-creation` |
| **Backlog sharing common root causes** | Gentle AI `systemic-issue-triage` / `issue-root-resolution` |
| **Ambiguous requirement or design doubt** | Matt Pocock `grill-with-docs` (`grill-me`), or targeted user question |
| **Large ambiguous feature** | Matt Pocock `wayfinder` $\rightarrow$ `to-spec`; Gentle AI `sdd-explore` / `sdd-propose` |
| **Decomposing plan into work items** | Matt Pocock `to-spec` $\rightarrow$ `to-tickets`; Engineering Excellence `sdd` |
| **Reproducible or hard bug** | Matt Pocock `diagnosing-bugs` $\rightarrow$ `tdd` regression test; Gentle AI `rdd-defect-workflow` |
| **Defined feature implementation** | Matt Pocock `implement` (`tdd` $\rightarrow$ review $\rightarrow$ commit); EE `sdd` + `tdd` |
| **Refactoring** | Behavior-preservation tests first (`tdd`); Matt Pocock `codebase-design` |
| **Infrastructure / Containers / CI** | Engineering Excellence `docker`, `ci`, `production-readiness`; `container-test-matrix` |
| **Security or Performance Audit** | Engineering Excellence `security`, `performance` |
| **Candidate Code Review** | Matt Pocock `code-review`; Gentle AI `judgment-day` (dual review); Guardian Angel before `READY` |
| **Commit Creation & Pull Request** | Gentle AI `work-unit-commits`, `chained-pr` (>400 lines), `branch-pr`; Matt Pocock `pr` |
| **Context Pressure & Session Handoff** | Gentle Engram handoff; Matt Pocock `handoff`; EE `context-budget` |

---

## Installation & Dependency Management

### Install the Skill via Vercel Skills CLI

Install the skill for any supported agent directly from GitHub:

```bash
# Global installation across supported agent runtimes
npx skills add darkrei08/pi-herdr-orchestration \
  --skill pi-herdr-orchestrator \
  --agent codex claude-code antigravity antigravity-cli pi \
  --global
```

Or from a local clone:

```bash
npx skills add . \
  --skill pi-herdr-orchestrator \
  --agent codex claude-code antigravity antigravity-cli pi \
  --global
```

### Dependency Bootstrap (System Runtimes & Skill Suites)

The Vercel Skills CLI installs skill definition files only; it deliberately does not run third-party installers or post-install scripts. Run the dependency bootstrap script to inspect missing dependencies and install required runtimes as well as all 4 required skill suites (**Engineering Excellence**, **Matt Pocock skills**, **Gentle AI skills**, and **Pi Herdr Orchestration**):

```bash
# 1. Read-only dry run (inspects existing software/skills and prints a plan)
node scripts/bootstrap.mjs
# or: npm run bootstrap

# 2. Apply installations (requires explicit --apply flag)
node scripts/bootstrap.mjs --apply
# or: npm run bootstrap:apply
```

### Mandatory Per-Repository Initialization

Every project or repository orchestrated by this skill must be initialized before workers begin execution. Run the repository initialization script:

```bash
# 1. Dry run in current repository
node scripts/init-repo.mjs
# or: npm run init-repo

# 2. Apply repository initialization
node scripts/init-repo.mjs --apply
# or: npm run init-repo:apply

# Or target a specific repository path:
node scripts/init-repo.mjs --dir /path/to/my-repo --apply
```

This command automatically configures:
- **Git Baseline:** Ensures repository initialization on `main` and creates `.worktrees/`.
- **Gitignore Rules:** Appends `.worktrees/`, `.codegraph/`, and `.atl/` to `.gitignore`.
- **Engram Memory Identity:** Generates `.git/engram-project-identity.json` for isolated, persistent repository memory.
- **Guardian Angel (GGA):** Creates `.gga` quality-gate configuration and baseline `AGENTS.md` guidelines.
- **Semantic Code Navigation:** Deploys Serena project configuration for LSP symbol analysis.
- **Token Compression:** Injects `sqz` and `rtk` local hooks for terminal and tool reduction.
- **Herdr Workspace:** Creates a dedicated Herdr workspace named after the repository.
- **Skill Registry:** Catalogs all available skills into `.atl/skill-registry.md`.

### Environment Verification

Run the read-only capability and host compatibility check:

```bash
# Output JSON report
node scripts/check.mjs --json
# or: npm run check:json

# Strict validation (exits nonzero if core runtimes or compaction conflicts exist)
node scripts/check.mjs --strict
# or: npm run check:strict
```

### Mailbox & Supervision Commands

Supervise distributed worker sessions and inspect the shared mailbox:

```bash
# Check current run status and flagged tasks against Herdr agent liveness
node scripts/mailbox.mjs status --run <run-id>
# or: npm run mailbox:status -- --run <run-id>

# Run unit tests for supervision classification logic
npm test
```

The report inspects:
- Core prerequisites: Node.js, Git, and Skill definitions.
- Agent runtimes: Pi, PiWorkflow, Gentle AI / Engram, Guardian Angel (GGA), and Herdr.
- Supporting CLIs: GitHub CLI (`gh`), Docker, and Docker Compose.
- Installed skill suites: Engineering Excellence, Matt Pocock, and Gentle AI.
- Context tooling: Wizard-AI, Serena, graphifyy, RTK, and sqz.
- Active Pi compaction owner.

### Compaction & Overlap Rules

To prevent conflicting hooks and transcript corruption, the orchestrator enforces strict overlap guards:
- **Pi Compaction Ownership:** Under Vekexasia's dotenv model, `pi-codex-context` is the sole third-party compaction owner. The bootstrap intentionally skips `@sting8k/pi-vcc`. Multiple active compaction owners trigger an `incompatible` error and halt.
- **Workflow & Memory Ownership:** If Gentle AI / Engram or PiWorkflow is active, the orchestrator blocks the installation of overlapping Wizard-AI workflow, proxy, or memory modules, allowing only non-overlapping context tools (graphifyy, LLMLingua).
- **Guardian Angel (GGA):** The bootstrap installs the `gga` binary but never runs `gga init` or `gga install` automatically, preserving repository configuration.

---

## Sources & References

The architecture and routing logic follow the published interfaces and documentation of these upstream projects:

- **[Vercel Agent Skills](https://github.com/vercel-labs/skills):** Specification and CLI for universal cross-agent skill installation.
- **[OpenAI Codex Skills](https://developers.openai.com/plugins/concepts/skills):** Standardized `SKILL.md` operational contract format.
- **[Google Antigravity Skills](https://antigravity.google/docs/skills):** Skill discovery specification for Google Antigravity agents.
- **[Pi Coding Agent](https://github.com/badlogic/pi-mono):** Harness architecture, extensions, sessions, and tool calling by Mario Zechner.
- **[Pi Extensible Workflows](https://github.com/vekexasia/pi-extensible-workflows):** Multi-agent orchestration engine (`workflow`, `parallel`, `withWorktree`, checkpoints) by Roberto De Virgilio (@vekexasia).
- **[Engineering Excellence](https://github.com/darkrei08/Engineering-Excellence):** Framework-agnostic AI software engineering standards by @darkrei08 (upstream fork of [micio86dev/Engineering-Excellence](https://github.com/micio86dev/Engineering-Excellence)).
- **[Matt Pocock's Skills](https://github.com/mattpocock/skills):** Agent workflows for triage, spec decomposition, bug diagnosis, architecture design, and grilling by Matt Pocock (@mattpocock).
- **[Gentle AI](https://github.com/Gentleman-Programming/gentle-ai):** Harness discipline, Receipt-Driven Development (RDD), and review authority by Gentleman Programming.
- **[Gentle Engram](https://github.com/Gentleman-Programming/gentle-engram):** Durable project memory and cross-session learning persistence by Gentleman Programming.
- **[Gentleman Guardian Angel](https://github.com/Gentleman-Programming/gentleman-guardian-angel):** Provider-agnostic pre-commit and pre-PR quality gate by Gentleman Programming.
- **[Herdr](https://herdr.dev/):** Terminal multiplexer and workspace coordinator designed for AI coding agents.
- **[Serena](https://github.com/oraios/serena):** Language-server backed semantic navigation engine for AI agents by Oraios.
- **[graphifyy](https://pypi.org/project/graphifyy/):** Graph-based code analysis and AST dependency extraction.
- **[LLMLingua](https://github.com/microsoft/LLMLingua):** Prompt compression and token reduction framework by Microsoft.
- **[RTK](https://github.com/rtk-ai/rtk):** Terminal output filter and token reducer for AI agent command execution.
- **[sqz](https://github.com/ojuschugh1/sqz):** Token compression for CLI output and file reads by Ojus Chugh.
- **[Wizard-AI](https://github.com/darkrei08/Wizard-AI):** Guided setup manager and adapter tooling by @darkrei08.

---

## License

This project is licensed under the [MIT License](LICENSE).
