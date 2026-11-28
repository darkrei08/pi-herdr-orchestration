---
name: pi-herdr-orchestrator
description: Deterministic multi-agent repository orchestration for issues, pull requests, development, testing, integration and cleanup. Builds a work inventory and dependency graph, then dispatches one session per independent unit of work (Herdr panes, Pi sessions, isolated worktrees) using only the skills each task needs, with evidence-based validation, safe merge and verified cleanup. Use to continue or recover a project, resolve a backlog of issues and PRs, reconcile branches, or run a full audit. Discover installed capabilities (PiWorkflow, Gentle/Engram, Herdr, Docker Compose); never assume any exists.
---

# Pi Herdr Orchestrator

Act as the control session for the current repository. Respect the user's actual scope: a request to fix one issue does not authorize an unlimited backlog sweep. For a repository-wide request, continue through independently actionable work and rescan after each integration. Never claim an unavailable tool ran.

## Principles

- Correctness before speed; small, reviewable, reversible changes; explicit ownership of every task; no completion claim without evidence.
- Treat review as a layered operating path: verify before PR, run required checks, separate bug/security review, classify risk, apply the required human approval, then integrate and preserve rollback evidence. See [review-operating-model.md](references/review-operating-model.md).
- Repository-agnostic: discover purpose, structure, commands and conventions from the repository. Repository-local instructions override these generic preferences unless they create a demonstrable safety or correctness problem.
- Parallelism is a tool, not a goal: maximize independent, validated progress at minimum coordination cost. Every merge is backed by evidence; every temporary resource is reconciled or removed.

## Entry sequence

1. Read repository instructions (`AGENTS.md` and project documentation), identify the requested scope, and inspect Git state before edits.
2. Discover Pi, PiWorkflow, Pi compaction extensions, Gentle AI/Engram, Wizard-AI, Guardian Angel, Herdr, the issue/PR provider CLI, Docker/Compose, browser tools, installed skills (Engineering Excellence, Matt Pocock, Gentle AI, project-local), runtimes and checks. Herdr core, the socket-API protocol, the desktop client presence and the Heeler plugin/host-helper are detected read-only, with the upstream ownership boundary in [clients.md](references/clients.md). Classify them as installed, missing or incompatible; run `node skills/pi-herdr-orchestrator/scripts/check-environment.mjs --strict` (or `npm run check:strict`) when available. See [bootstrap.md](references/bootstrap.md) and [dependencies.md](references/dependencies.md).
3. If missing runtimes, tools, or skill suites are detected, report the exact missing prerequisites and ask the operator before running the dependency bootstrap: `node scripts/bootstrap-dependencies.mjs --apply` (or `npm run bootstrap:apply`). Never install runtimes, CLI tools, or global skill suites without that explicit authorization. When authorized, the bootstrap respects compaction ownership (preserving `pi-codex-context`) and prevents overlapping manager components.
4. **Mandatory Per-Repository Initialization:** After explicit operator authorization for repository initialization, every repository or project managed by this orchestrator must be initialized before task execution by running `node scripts/init-repository.mjs --apply` (or `npm run init-repo:apply`). If authorization is absent, report `BLOCKED` and do not apply changes. This ensures:
   - Git repository baseline and branch detection.
   - Isolated `.worktrees/` directory materialization and entry in `.gitignore`.
   - Engram project-scoped memory identity (`.git/engram-project-identity.json`).
   - Guardian Angel (`.gga`) configuration and repository `AGENTS.md` rules.
   - Optional worktree-local CodeGraph indexing when `--codegraph` is requested.
   - Context and output reduction hooks via `sqz` and `rtk`.
   - Herdr workspace registration (`herdr workspace create`) as the ordered host for numbered, labeled workflow agent tabs.
   - Skill registry indexing (`.atl/skill-registry.md`).
5. If Wizard-AI is installed or the repository exposes it, discover its context stack and compatibility layer. See [wizard-ai.md](references/wizard-ai.md).
6. If installed, use Guardian Angel (GGA) as a provider-agnostic commit/PR quality gate after tests and before `READY`. See [guardian-angel.md](references/guardian-angel.md).
   - Before a ticket, map entry, grilling answer or documentation draft is activated, run the `supervise` phase with the producer and supervisor aliases declared in `config/ticket-supervision.json`; resolve physical model and effort from the active `pi-ext-roles` settings. The same alias, model or effort for both roles is `BLOCKED`; see [routing.md](references/routing.md).
7. Reconcile relevant persisted memory with current Git, issues, PRs and CI; load only task-relevant memory. See [memory.md](references/memory.md).
8. Build a deduplicated work queue and dependency graph. Prioritize defects with material impact and unblockers. See [discovery.md](references/discovery.md). Dispatch only independent units in parallel; serialize or group related and conflicting ones. See [dispatch.md](references/dispatch.md).
9. Select the smallest useful set of available skills, methods and roles; one owner per concern. See [routing.md](references/routing.md).
10. Operate the session hierarchy: `[MASTER] Pi Herdr Orchestrator` coordinates department chiefs; chiefs coordinate issue, PR, feature, review and audit sessions. See [coordination.md](references/coordination.md).
11. Pass compact structured state between workflow layers and sessions. Use JSON as the machine contract and Markdown as the human report generated from it. See [state-protocol.md](references/state-protocol.md).
12. Execute in an isolated branch/worktree and launch each workflow agent as its own numbered, labeled tab in the workflow's Herdr workspace when the task merits it. Labels carry their 1-based dispatch position, so the workspace reads in launch order; verify the transport evidence before claiming a tab. Verify and review the result. See [execution.md](references/execution.md) and [quality.md](references/quality.md).
13. Decide destination from evidence: stable integration, preserved development branch, follow-up or blocked. When the change reaches beta, staging, production, or a live runtime claim, follow the ordered pipeline, immutable promotion, and fresh-runtime candidate identity in [production-lifecycle.md](references/production-lifecycle.md); a documentation-only change records the inapplicable stages explicitly. Persist durable knowledge, close child sessions and panes in order, report to the master, then rescan and audit. See [integration.md](references/integration.md) and [audit.md](references/audit.md).
14. Close the cycle with the dashboard, evidence and final report. See [reporting.md](references/reporting.md).

## Runtime dispatch contract

When PiWorkflow is available, invoke a named workflow (`name` plus `script`) with `foreground: true` and no budget, and keep delegation in direct `agent(...)` or `agent.create(...)` calls. PiWorkflow is the only execution scheduler: it owns workflow lifetime, waits for independent child results, and returns the normalized result to the Master Chief. Pi Herdr Orchestration owns the control plane, task graph, capability routing, integration decision, and cleanup; Herdr tabs and panes are inspectable transport and presentation, not a second scheduler. When a task uses Anthropic's Small Business plugin, load `anthropic-small-business-pi` together with the selected upstream skill; it is the Pi compatibility contract for Claude-specific routing, approval, memory, artifact, and connector assumptions. Every call must select a `pi-ext-roles` role, reset inherited role selectors with `!*` before adding only the task's verified skills and extensions, use the MCP-capable extensions, no preset timeout (`timeoutMs` omitted), and a report-back contract:

```javascript
const mcpExtensions = ["!*", "builtin:codemode", "builtin:tool-search", "builtin:mcp"];
const results = await parallel("dispatch", {
  scout: () => agent("Map the repository and return evidence.", {
    role: "scout",
    label: "#1 [CHIEF/SCOUT] Discovery",
    skills: ["!*", "pi-herdr-orchestrator", "engineering-excellence", "diagnosing-bugs"],
    extensions: mcpExtensions,
    worktree: "scout",
  }),
  build: () => agent("Implement the bounded task and verify it.", {
    role: "developer",
    label: "#2 [CHIEF/BUILD] Implementation",
    skills: ["!*", "pi-herdr-orchestrator", "engineering-excellence", "tdd"],
    extensions: mcpExtensions,
    worktree: "build",
  }),
});
return results;
```

- Use a non-empty workflow `name` and `parallel("<operation>", { ... })` for independent work. Use `pipeline("<operation>", items, stages)` when every item must pass the same ordered stages. Never replace these with `Promise.all`/`map` agent fan-out, aliases, or native `subagents_run`; native subagents are forbidden for orchestrated delegation.
- Give every direct agent call a `pi-ext-roles` `role`, a stable `label`, explicit `skills` selectors, the three required MCP extensions, no preset timeout (`timeoutMs` omitted), and a named isolated `worktree` for writes. `builtin:codemode` is the stable bridge to MCP tools; `builtin:tool-search` and `builtin:mcp` must remain available in every workflow role session.
- Prefix every `label` with its 1-based dispatch position inside the workflow (`#1 [CHIEF/SCOUT] Discovery`, `#2 [CHIEF/BUILD] Implementation`). The number is presentation order, never authority, and it must match the `parallel`/`pipeline` position so the launch order is readable in Herdr and checkable in review.
- Matt flow skills that declare `disable-model-invocation: true` (`wayfinder`, `to-spec`, `to-tickets`, `triage`, `implement`, `grill-me`, `grill-with-docs`, `handoff`, `retro`) cannot reach a child through a `skills` selector: the selector only narrows the child's skill list, while Pi 1.6.0 keeps flagged skills out of the system prompt (`formatSkillsForPrompt`). Verified against `/root/.agents/skills/*/SKILL.md`, Pi 1.6.0 and `pi-extensible-workflows` 6.4.0 (`skillsOverride`) on 2026-11-26. Reach a child only by passing the skill's absolute `SKILL.md` path in the task prompt and requiring a read first, or keep the method in the master session under operator `/skill:<name>`; a live child run of a flagged skill was NOT RUN. See [routing.md](references/routing.md).
- Verify each requested skill, role, and extension in the live capability report first; an unavailable required capability is `BLOCKED`, not silently omitted. For Anthropic Small Business routes, also verify the official 44-skill inventory and the Pi adapter with `node scripts/check-anthropic-small-business.mjs --json` before dispatch. Hosts without PiWorkflow use only the documented single-session/direct-worktree fallback and report it as `NOT APPLICABLE`.
- The `parallel` object order is the dispatch order. With fully inspectable Herdr mode enabled by the trusted project setting, `@piewf/herdr` launches every agent into the workflow's Herdr workspace as its own tab titled with the numbered `label`, in admission order. A runtime that instead reports a sibling pane keeps the caller's `tab_id`; a runtime with local session transport returns no tab or pane metadata. Record only the transport identity the runtime actually returned, and mark tab acceptance `BLOCKED` when no tab evidence exists; never infer a tab from a label, a position or the caller's pane.
- The trusted project settings written by repository initialization set `extensionSettings.herdr.enableFullyInspectableMode` to `true`. This repository must not shell out to `pi`, create Herdr tabs itself, or edit the global host settings; repository initialization owns the project override.
- If Pi is not running inside Herdr, or PiWorkflow/@piewf/herdr is unavailable, use the documented single-session or direct-worktree fallback and report `NOT APPLICABLE`/`BLOCKED`. Never claim panes, tabs, parallel sessions, or skill execution that did not occur.
- Route worker reports/questions through the mailbox first. Use `ORCH_MASTER` only as a distinct Herdr agent name for a best-effort wake-up; never pass the current Pi session id or the worker's own identity. If peer discovery is empty or ambiguous, skip the wake-up and let the master consume `orch_status`/`orch_reply` state.

## Dispatch failure states

Decide and record one state before dispatch; never upgrade it after the fact.

| Condition | State | Required evidence |
| --- | --- | --- |
| Herdr unavailable (not inside a Herdr pane, no server answer) | `NOT APPLICABLE` for the tab transport; children still run in their session and worktree | capability report line and the absent tab claim |
| `@piewf/herdr` unavailable or it returns no tab metadata | `BLOCKED` for tab acceptance, `NOT APPLICABLE` for ordering | the transport result, plus session and worktree identity |
| PiWorkflow unavailable | `NOT APPLICABLE` for workflow transport; use the documented single-session/direct-worktree fallback | capability report line and an explicit fallback statement |
| requested skill unavailable (or a missing role/extension) | `BLOCKED` before any child starts, never a weaker loadout | the missing selector from the capability report |

## Control rules

- Do not open sessions or panes indiscriminately: one session per independent, actionable unit, with reserved file ownership, one responsibility and one verifiable completion condition. The master coordinates and decides; workers implement.
- Prefer finishing existing PRs over duplicating them. Close an issue only when its acceptance criteria are met, referencing the resolving PR or commit.
- Use PiWorkflow's actual installed workflow/session APIs if present; its current documentation governs commands. Keep `[MASTER] Pi Herdr Orchestrator` as the control plane, chiefs as bounded coordinators, and task sessions in their own worktrees. Do not pretend a terminal tab or agent exists when it does not.
- Maintain a traceable command chain: master assigns to a chief, the chief dispatches and supervises task sessions, child sessions return evidence to the chief, and the chief returns a normalized report to the master. Only the master decides the next repository-level action, integration target, retry, escalation or stop condition.
- Dispatch is not delegation until supervised: every brief carries the report-back clause, and after dispatch the master stays in the supervision loop (mailbox status, Herdr liveness, Git reconciliation) until every task is `CLOSED` or escalated. Never end a turn with dispatched sessions unattended. See [supervision.md](references/supervision.md).
- Select Agents by effective runtime capabilities, not bundled filenames or assumed names. A configured child allowance does not prove that the child is available to the current controller; when no suitable Agent is available, investigate locally and record the capability gap instead of simulating delegation.
- Treat runtime capability discovery and configuration management as separate views: use live discovery for assignment, and inspect layered role/definition sources when changing configuration. Disabled or unavailable required children must not be presented as selectable runtime capabilities.
- Treat Git and verified code state as authoritative for implementation status. Memory explains intent and decisions; it cannot override current evidence.
- Delegate or parallelize only when permitted by the host, user and project instructions and when task dependencies allow it. A separate reviewer is desirable when available, never mandatory theater.
- Do not automatically merge, push, close PRs/issues, delete branches, or broaden the user's scope without applicable authorization. Preserve unrelated work and uncommitted changes.
- Report `PASS`, `FAIL`, `BLOCKED` or `NOT RUN` accurately for relevant checks. State exact remaining blockers and next action.
- Cap repeated review/fix rounds at three; after that, pause for an approach decision and re-review only the new diff. Approval is bound to the exact reviewed commit and must be renewed after unverified commits.
- Use incidents, reverts, and confirmed harmful false positives as evaluator cases for reviewer changes. Record human-attention and regression guardrail metrics when available; never fabricate unavailable telemetry.
- Skill distribution is host-specific: verify Codex, Claude Code, Antigravity and Antigravity CLI roots after installation; never claim support merely because a `SKILL.md` exists in one agent's directory.
- Treat Herdr pane and agent labels as presentation only. A role-derived label such as `Lead`, `Managed Lead`, `Manager`, or `Chief` does not grant authority, replace assignment checks, or prove ownership; preserve custom names unless the runtime owns the canonical label.
- Treat model execution failure as a nonterminal fact. Do not automatically retry the model, replay tools, stop child Agents, integrate partial work, or emit a successful handoff. Inspect exact assignment and external effects before an authorized continuation.

## Reference map

| Need | Read |
| --- | --- |
| Environment and capability discovery | [bootstrap.md](references/bootstrap.md) |
| Optional dependency detection and installation | [dependencies.md](references/dependencies.md) |
| Herdr core, desktop client, Heeler plugin and upstream ownership | [clients.md](references/clients.md) |
| Wizard-AI context and Pi compatibility | [wizard-ai.md](references/wizard-ai.md) |
| Guardian Angel commit/PR quality gate | [guardian-angel.md](references/guardian-angel.md) |
| Branch, PR and issue inventory | [discovery.md](references/discovery.md) |
| Independence analysis, ownership, registry, merge queue | [dispatch.md](references/dispatch.md) |
| Gentle/Engram hydration and handoff | [memory.md](references/memory.md) |
| Dynamic skill and role selection | [routing.md](references/routing.md) |
| Master, chiefs and the pane tree | [coordination.md](references/coordination.md) |
| Compact JSON state and Markdown reports | [state-protocol.md](references/state-protocol.md) |
| Worktrees, sessions and task contract | [execution.md](references/execution.md) |
| Tests, auto-grill and review | [quality.md](references/quality.md) |
| Stable/dev decisions and cleanup | [integration.md](references/integration.md) |
| Rescan, recovery and final audit | [audit.md](references/audit.md) |
| Report-back mailbox, supervision loop, escalation rules | [supervision.md](references/supervision.md) |
| Layered review, risk, rollback and evaluator loop | [review-operating-model.md](references/review-operating-model.md) |
| Dashboard, evidence, completion criteria, final report | [reporting.md](references/reporting.md) |

Read only the references relevant to the current phase. Avoid dumping every file into the context window.
