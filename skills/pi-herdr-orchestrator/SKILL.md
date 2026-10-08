---
name: pi-herdr-orchestrator
description: Deterministic multi-agent repository orchestration for issues, pull requests, development, testing, integration and cleanup. Builds a work inventory and dependency graph, then dispatches one session per independent unit of work (Herdr panes, Pi sessions, isolated worktrees) using only the skills each task needs, with evidence-based validation, safe merge and verified cleanup. Use to continue or recover a project, resolve a backlog of issues and PRs, reconcile branches, or run a full audit. Discover installed capabilities (PiWorkflow, Gentle/Engram, Herdr, Docker Compose); never assume any exists.
---

# Pi Herdr Orchestrator

Act as the control session for the current repository. Respect the user's actual scope: a request to fix one issue does not authorize an unlimited backlog sweep. For a repository-wide request, continue through independently actionable work and rescan after each integration. Never claim an unavailable tool ran.

## Principles

- Correctness before speed; small, reviewable, reversible changes; explicit ownership of every task; no completion claim without evidence.
- Repository-agnostic: discover purpose, structure, commands and conventions from the repository. Repository-local instructions override these generic preferences unless they create a demonstrable safety or correctness problem.
- Parallelism is a tool, not a goal: maximize independent, validated progress at minimum coordination cost. Every merge is backed by evidence; every temporary resource is reconciled or removed.

## Entry sequence

1. Read repository instructions (`AGENTS.md` and project documentation), identify the requested scope, and inspect Git state before edits.
2. Discover Pi, PiWorkflow, Pi compaction extensions, Gentle AI/Engram, Wizard-AI, Guardian Angel, Herdr, the issue/PR provider CLI, Docker/Compose, browser tools, installed skills (Engineering Excellence, Matt Pocock, Gentle AI, project-local), runtimes and checks. Classify them as installed, missing or incompatible; run `node scripts/check-environment.mjs --strict` (or `npm run check:strict`) when available. See [bootstrap.md](references/bootstrap.md) and [dependencies.md](references/dependencies.md).
3. If missing runtimes, tools, or skill suites are detected, run the dependency bootstrap: `node scripts/bootstrap-dependencies.mjs --apply` (or `npm run bootstrap:apply`). The bootstrap installs required runtimes, CLI tools, and globally adds the required skill suites (Engineering Excellence, Matt Pocock, Gentle AI, and Pi Herdr Orchestration). It respects compaction ownership (preserving `pi-codex-context`) and prevents overlapping manager components.
4. **Mandatory Per-Repository Initialization:** Every repository or project managed by this orchestrator must be initialized before task execution by running `node scripts/init-repository.mjs --apply` (or `npm run init-repo:apply`). This ensures:
   - Git repository baseline and branch detection.
   - Isolated `.worktrees/` directory materialization and entry in `.gitignore`.
   - Engram project-scoped memory identity (`.git/engram-project-identity.json`).
   - Guardian Angel (`.gga`) configuration and repository `AGENTS.md` rules.
   - Semantic code navigation indexing via Serena (`serena project create`).
   - Context and output reduction hooks via `sqz` and `rtk`.
   - Dedicated Herdr workspace registration (`herdr workspace create`).
   - Skill registry indexing (`.atl/skill-registry.md`).
5. If Wizard-AI is installed or the repository exposes it, discover its context stack and compatibility layer. See [wizard-ai.md](references/wizard-ai.md).
6. If installed, use Guardian Angel (GGA) as a provider-agnostic commit/PR quality gate after tests and before `READY`. See [guardian-angel.md](references/guardian-angel.md).
7. Reconcile relevant persisted memory with current Git, issues, PRs and CI; load only task-relevant memory. See [memory.md](references/memory.md).
8. Build a deduplicated work queue and dependency graph. Prioritize defects with material impact and unblockers. See [discovery.md](references/discovery.md). Dispatch only independent units in parallel; serialize or group related and conflicting ones. See [dispatch.md](references/dispatch.md).
9. Select the smallest useful set of available skills, methods and roles; one owner per concern. See [routing.md](references/routing.md).
10. Operate the session hierarchy: `[MASTER] Pi Herdr Orchestrator` coordinates department chiefs; chiefs coordinate issue, PR, feature, review and audit sessions. See [coordination.md](references/coordination.md).
11. Pass compact structured state between workflow layers and sessions. Use JSON as the machine contract and Markdown as the human report generated from it. See [state-protocol.md](references/state-protocol.md).
12. Execute in an isolated branch/worktree with an ordered, immediately renamed Pi tab when the task merits it. Verify and review the result. See [execution.md](references/execution.md) and [quality.md](references/quality.md).
13. Decide destination from evidence: stable integration, preserved development branch, follow-up or blocked. Persist durable knowledge, close child sessions and tabs in order, report to the master, then rescan and audit. See [integration.md](references/integration.md) and [audit.md](references/audit.md).
14. Close the cycle with the dashboard, evidence and final report. See [reporting.md](references/reporting.md).

## Control rules

- Do not open sessions or panes indiscriminately: one session per independent, actionable unit, with reserved file ownership, one responsibility and one verifiable completion condition. The master coordinates and decides; workers implement.
- Prefer finishing existing PRs over duplicating them. Close an issue only when its acceptance criteria are met, referencing the resolving PR or commit.
- Use PiWorkflow's actual installed workflow/session APIs if present; its current documentation governs commands. Keep `[MASTER] Pi Herdr Orchestrator` as the control plane, chiefs as bounded coordinators, and task sessions in their own worktrees. Do not pretend a terminal tab or agent exists when it does not.
- Maintain a traceable command chain: master assigns to a chief, the chief dispatches and supervises task sessions, child sessions return evidence to the chief, and the chief returns a normalized report to the master. Only the master decides the next repository-level action, integration target, retry, escalation or stop condition.
- Treat Git and verified code state as authoritative for implementation status. Memory explains intent and decisions; it cannot override current evidence.
- Delegate or parallelize only when permitted by the host, user and project instructions and when task dependencies allow it. A separate reviewer is desirable when available, never mandatory theater.
- Do not automatically merge, push, close PRs/issues, delete branches, or broaden the user's scope without applicable authorization. Preserve unrelated work and uncommitted changes.
- Report `PASS`, `FAIL`, `BLOCKED` or `NOT RUN` accurately for relevant checks. State exact remaining blockers and next action.
- Skill distribution is host-specific: verify Codex, Claude Code, Antigravity and Antigravity CLI roots after installation; never claim support merely because a `SKILL.md` exists in one agent's directory.

## Reference map

| Need | Read |
| --- | --- |
| Environment and capability discovery | [bootstrap.md](references/bootstrap.md) |
| Optional dependency detection and installation | [dependencies.md](references/dependencies.md) |
| Wizard-AI context and Pi compatibility | [wizard-ai.md](references/wizard-ai.md) |
| Guardian Angel commit/PR quality gate | [guardian-angel.md](references/guardian-angel.md) |
| Branch, PR and issue inventory | [discovery.md](references/discovery.md) |
| Independence analysis, ownership, registry, merge queue | [dispatch.md](references/dispatch.md) |
| Gentle/Engram hydration and handoff | [memory.md](references/memory.md) |
| Dynamic skill and role selection | [routing.md](references/routing.md) |
| Master, chiefs and ordered Pi tabs | [coordination.md](references/coordination.md) |
| Compact JSON state and Markdown reports | [state-protocol.md](references/state-protocol.md) |
| Worktrees, sessions and task contract | [execution.md](references/execution.md) |
| Tests, auto-grill and review | [quality.md](references/quality.md) |
| Stable/dev decisions and cleanup | [integration.md](references/integration.md) |
| Rescan, recovery and final audit | [audit.md](references/audit.md) |
| Dashboard, evidence, completion criteria, final report | [reporting.md](references/reporting.md) |

Read only the references relevant to the current phase. Avoid dumping every file into the context window.
