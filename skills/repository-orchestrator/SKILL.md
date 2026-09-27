---
name: repository-orchestrator
description: Orchestrate substantial repository maintenance or a backlog of issues and PRs with PiWorkflow, optional Gentle memory, isolated worktrees, verification, review, integration and final audit. Use when asked to continue or recover a project, resolve multiple repository tasks, reconcile branches and PRs, or run a full repository audit. Discover installed capabilities; never assume PiWorkflow or Gentle exists.
---

# Repository Orchestrator

Act as the control session for the current repository. Respect the user's actual scope: a request to fix one issue does not authorize an unlimited backlog sweep. For a repository-wide request, continue through independently actionable work and rescan after each integration. Never claim an unavailable tool ran.

## Entry sequence

1. Read repository instructions (`AGENTS.md` and project documentation), identify the requested scope, and inspect Git state before edits.
2. Discover Pi, PiWorkflow, Pi compaction extensions, Gentle AI/Engram, Wizard-AI, Guardian Angel, Herdr, installed skills, runtimes and checks. Classify them as installed, missing or incompatible; read only their installed instructions. Run `node scripts/check-environment.mjs --json` when the checkout is available. See [bootstrap.md](references/bootstrap.md) and [dependencies.md](references/dependencies.md).
3. If the user requests setup, use the official dependency matrix in the repository README and `scripts/bootstrap-dependencies.mjs`. The Skills CLI installs skill files; it does not execute third-party installers or postinstall hooks. The bootstrap requires `--apply`, verifies every installation, and covers Gentle AI/Engram, Guardian Angel and Herdr alongside the existing tools. Keep `pi-codex-context` as the Vekexasia dotenv compaction owner, never install `@sting8k/pi-vcc`, and do not install components that overlap with the installed Gentle AI/Engram/PiWorkflow stack. Never run GGA `init` or `install` automatically because they mutate repository hooks/config.
4. If Wizard-AI is installed or the repository exposes it, discover its context stack and compatibility layer. See [wizard-ai.md](references/wizard-ai.md).
5. If installed, use Guardian Angel (GGA) as a provider-agnostic commit/PR quality gate after tests and before `READY`. See [guardian-angel.md](references/guardian-angel.md).
6. Reconcile relevant persisted memory with current Git, issues, PRs and CI; load only task-relevant memory. See [memory.md](references/memory.md).
7. Build a deduplicated work queue and dependency graph. Prioritize defects with material impact and unblockers. See [discovery.md](references/discovery.md).
8. Select the smallest useful set of available skills, methods and roles. See [routing.md](references/routing.md).
9. Operate the session hierarchy: `[MASTER] Pi Repository Orchestrator` coordinates department chiefs; chiefs coordinate issue, PR, feature, review and audit sessions. See [coordination.md](references/coordination.md).
10. Pass compact structured state between workflow layers and sessions. Use JSON as the machine contract and Markdown as the human report generated from it. See [state-protocol.md](references/state-protocol.md).
11. Execute in an isolated branch/worktree with an ordered, immediately renamed Pi tab when the task merits it. Verify and review the result. See [execution.md](references/execution.md) and [quality.md](references/quality.md).
12. Decide destination from evidence: stable integration, preserved development branch, follow-up or blocked. Persist durable knowledge, close child sessions and tabs in order, report to the master, then rescan and audit. See [integration.md](references/integration.md) and [audit.md](references/audit.md).

## Control rules

- Use PiWorkflow's actual installed workflow/session APIs if present; its current documentation governs commands. Keep `[MASTER] Pi Repository Orchestrator` as the control plane, chiefs as bounded coordinators, and task sessions in their own worktrees. Do not pretend a terminal tab or agent exists when it does not.
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
| Gentle/Engram hydration and handoff | [memory.md](references/memory.md) |
| Dynamic skill and role selection | [routing.md](references/routing.md) |
| Master, chiefs and ordered Pi tabs | [coordination.md](references/coordination.md) |
| Compact JSON state and Markdown reports | [state-protocol.md](references/state-protocol.md) |
| Worktrees, sessions and task contract | [execution.md](references/execution.md) |
| Tests, auto-grill and review | [quality.md](references/quality.md) |
| Stable/dev decisions and cleanup | [integration.md](references/integration.md) |
| Rescan, recovery and final audit | [audit.md](references/audit.md) |

Read only the references relevant to the current phase. Avoid dumping every file into the context window.
