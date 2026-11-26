# Dynamic skill routing

Read installed skill instructions and select the smallest sufficient set. Every name below is a candidate, never a guarantee: confirm it in the capability report or the host's skill list and skip what is missing. Load a skill in the session that needs it, not in the master.

## Executable PiWorkflow loadout

A routing decision is incomplete until it is encoded in a named workflow's direct child-agent options. Every direct call must select a `pi-ext-roles` role and retain the MCP bridge:

```javascript
agent(taskPrompt, {
  role: "reviewer",
  label: "[CHIEF/QUALITY] Verification",
  skills: ["!*", "pi-herdr-orchestrator", "engineering-excellence", "tdd"],
  extensions: ["!*", "builtin:codemode", "builtin:tool-search", "builtin:mcp"],
  worktree: "quality",
});
```

- `role` selects a named `@piewf/pi-ext-roles` role; `skills` selects skill names; `extensions` selects Pi extensions; `label` becomes the human-facing Herdr agent and pane label; `worktree` gives a writing agent an isolated Git worktree. Use only selectors confirmed by the live capability report and the current Pi settings.
- `builtin:codemode` is the stable bridge to MCP tools. `builtin:tool-search` and `builtin:mcp` are required alongside it for every workflow-owned role session, even when the role file's own selectors are narrower. Tool names are runtime-specific: `web_search` is a host tool, while `mcp__<server>__<tool>` is valid only for a configured MCP server with that exact name. Never synthesize `mcp__web_search`; use `tool_search` or codemode to resolve the live name, then report a missing provider as `BLOCKED` without inventing results. Host tools are not added to a child merely by selecting MCP extensions, so research agents must explicitly receive the resolved search tool in their `tools` allowlist. Omit `timeoutMs` entirely; in Vekexasia's runner omitted or null means no timer is armed. Launch the named workflow with `foreground: true` and no budget; a foreground run can detach and deliver later.
- Default child loadout is `skills: ["!*", "pi-herdr-orchestrator", "engineering-excellence"]` plus one installed task skill (`tdd`, `code-review`, `diagnosing-bugs`, `pr`, `container-test-matrix`, `work-unit-commits`, `chained-pr`, `judgment-day`, `gentle-ai-branch-pr`). `issue-ops` is root-only. Matt `wayfinder`, `to-spec`, `to-tickets`, `triage`, `implement`, `handoff`, `retro`, `grill-me` and `grill-with-docs` are master-session only and declare `disable-model-invocation: true`; no session selects them on its own, and `/skill:<name>` is operator-entered, so a child cannot invoke one. See [Route by situation](#route-by-situation) for the only working child route.
- Use `parallel("<operation>", { ... })` for independent agents and `pipeline("<operation>", items, stages)` for repeated ordered stages. The object insertion order is the intended launch order; default Herdr transport creates sibling panes in the caller's current tab, with nested agents splitting their parent pane. Labels remain semantic presentation only, and a new workspace, tab, or cwd requires an explicit user request.
- Native `subagents_run` is forbidden for orchestration. A host without PiWorkflow uses the documented direct fallback only when PiWorkflow is genuinely unavailable; do not silently downgrade an available workflow runtime. A capability rejection is a pre-dispatch routing result, not a child timeout: record `BLOCKED`, correct the loadout or surface the missing capability, and do not create duplicate Herdr panes.
- The common Engineering Excellence loadout is `skills: ["!*", "engineering-excellence"]`; add `tdd`, `code-review`, `testing`, `security`, `ci`, or `platform-testing` only when the capability report confirms those skill files exist and the task needs them. Add `gentle-ai`, `work-unit-commits`, or `judgment-day` only for their applicable lifecycle responsibilities.
- A missing requested skill or extension is a routing failure. Record `BLOCKED` with the missing selector and do not silently launch a child with a weaker contract. A host without PiWorkflow or Herdr uses the documented direct-session fallback and reports `NOT APPLICABLE` for pane transport.
- The Master Chief waits on the named workflow result, not on an arbitrary terminal pane. The worker reports through the mailbox/result envelope; Herdr liveness is supervision evidence only. Close a child only after its result is persisted, reconciled against Git, and the Master Chief records the decision.

## Ecosystems

| Source | Provides | Notes |
| --- | --- | --- |
| PiWorkflow | Execution substrate: `workflow`, `parallel`, `pipeline`, `withWorktree`, `shell`, `agent.create` handles, roles, recovery (`workflow_status`, `workflow_retry`, `workflow_resume`) | Sequences work, supplies no method. `withWorktree` needs a clean launch tree and `tools.*` calls fail inside it; otherwise create worktrees with Git |
| Gentle AI | Harness discipline (`gentle-ai`), Engram memory, and the installer's frontmatter names `gentle-ai-work-unit-commits`, `gentle-ai-chained-pr`, `gentle-ai-judgment-day`, `gentle-ai-branch-pr`, `gentle-ai-issue-creation`, `gentle-ai-rdd-defect-workflow`; sdd-* phases, systemic-issue-triage, issue-root-resolution and a bare branch-pr selector are not installed locally | Review lifecycle (`gentle_review*`) is runtime-supplied: relay it, never reconstruct it |
| Engineering Excellence | Standards loaded on demand as references: `sdd`, `tdd`, `testing`, `quality-gates`, `code-review`, `security`, `performance`, `accessibility`, `interaction`, `docker`, `ci`, `production-readiness`, `engineering-score`, plus PR/ADR templates | The maintainer fork `darkrei08/Engineering-Excellence` (upstream `micio86dev`) adds `platform-testing` and `context-budget`; an installed copy may lag, so check the files exist |
| Matt Pocock (`mattpocock/skills`) | Flow skills: `triage`, `wayfinder`, `to-spec`, `to-tickets`, `implement`, `implement-spec`, `diagnosing-bugs`, `tdd`, `code-review`, `pr`, `handoff`, `retro`, `grill-with-docs`, `grill-me`, `prototype`, `research`, `codebase-design`, `improve-codebase-architecture` | `setup-matt-pocock-skills` stores the tracker and label mapping: read it, never assume labels |
| Local or personal | `issue-ops`, `container-test-matrix`, `multi-repo-product-workflow`, `project-memory` | Repository and user instructions name which apply |

## Route by situation

`(user-invoked)` marks a Matt skill whose frontmatter sets `disable-model-invocation: true`: Pi keeps it out of every system prompt, so neither the root nor a child selects it on its own. Re-verified on 2026-11-26 against the installed `/root/.agents/skills/*/SKILL.md` files (`wayfinder`, `to-spec`, `to-tickets`, `triage`, `implement`, `implement-spec`, `grill-me`, `grill-with-docs`, `handoff`, `retro`, `improve-codebase-architecture`, `chief-of-staff`) and against Pi 1.6.0 `dist/core/skills.js`, whose `formatSkillsForPrompt` filters `disableModelInvocation` skills out of the prompt. An explicit PiWorkflow `skills: [..., "<name>"]` selector does not override that: `pi-extensible-workflows` 6.4.0 only narrows the child's skill list in `skillsOverride` and never reads the flag, so the selector validates and installs the name while the child prompt still omits it. The 2026-11-23 selector evidence in #40, #41, #44 and #45 covers selector validation, not this flag. To reach a child, the master passes the skill's absolute `SKILL.md` path in the child's task prompt and requires a read before acting; otherwise the operator runs `/skill:<name>` in the root session and relays the result. A live child run of a flagged skill was NOT RUN.

| Situation | Minimal method, first installed wins |
| --- | --- |
| Raw issue or PR you did not create | `issue-ops` in the root session, plus Matt `triage` (user-invoked); add `gentle-ai-issue-creation` only when the capability report lists it. Tickets from `to-tickets` are already agent-ready: do not re-triage |
| Backlog sharing root causes | Master-session guidance only: group the backlog by shared root cause, one fix per root, close against named tests and the `to-tickets` blocking edges. The upstream systemic-issue-triage and issue-root-resolution skills are not installed, so no child selects them |
| Ambiguous requirement or decision | Matt `grill-with-docs`, or `grill-me` for a repo without docs (both user-invoked), or one targeted user question |
| Foggy effort too big for one session | Matt `wayfinder`, then `to-spec` (user-invoked); the EE `sdd` reference when the repository runs SDD |
| Plan into work items | Matt `to-spec` then `to-tickets` (user-invoked; its blocking edges are dependency-graph input); EE `sdd` |
| Reproducible or hard bug | Matt `diagnosing-bugs` (tight feedback loop first), then a `tdd` regression test; `gentle-ai-rdd-defect-workflow` when review authority is active and the capability report lists it |
| Defined feature | Matt `implement` (user-invoked; `tdd`, `code-review`, commit); EE `sdd` + `tdd` |
| Refactor | Behaviour-preservation tests first (`tdd`, EE `testing`); Matt `codebase-design` / `improve-codebase-architecture` (user-invoked) for shape |
| Technical or factual uncertainty | Matt `prototype` (throwaway) or `research` |
| UI work | EE `interaction`, `accessibility`, `i18n`, `seo` as relevant; browser evidence; visual design skills only for visual design tasks |
| Infrastructure, containers, CI | EE `docker`, `ci`, `production-readiness`; OS-specific behaviour: EE `platform-testing` or `container-test-matrix`; Proxmox host-node LXC/VM guests via `platform-testing` and `quality` for pre-production commit and task validation, not Docker Compose on the local Pi machine |
| Security, performance | EE `security`, `performance`; matching reviewer role |
| Candidate review | Independent context: Matt `code-review` (Standards and Spec vs a fixed point) or a reviewer role; Gentle `judgment-day` only when dual or adversarial review is requested; GGA before `READY` |
| Commits and PR | Installed `gentle-ai-work-unit-commits` or `work-unit-commits`, `gentle-ai-chained-pr` or `chained-pr` for oversized diffs, `gentle-ai-branch-pr` (issue-first, each remote action separately authorized); Matt `pr` for the body; EE pull-request template |
| Cross-repository feature | `multi-repo-product-workflow` when installed; provider-first order in [dispatch.md](dispatch.md) |
| Anthropic Small Business skill | `anthropic-small-business-pi` plus the exact upstream skill; route chains through PiWorkflow `pipeline(...)`, preserve approval gates, and use only the active Pi MCP registry |
| Context pressure, new harness | Engram handoff and [state-protocol.md](state-protocol.md); Matt `handoff` (user-invoked; narrow: new harness, directory or colleague); EE `context-budget` |
| Session lessons | Matt `retro` (user-invoked) |
| Large codebase context | CodeGraph/graphify for targeted evidence, then RTK/sqz/LEA/TOON as discovered |

These are examples, not a mandatory pipeline.

## Canonical PiWorkflow role-to-model matrix

When configuring or routing Pi workflow roles (`pi-ext-roles`) with CLIProxyAPI and High Availability (HA CLI) groups, use this canonical matrix:

| Role | Primary Model (CLIProxyAPI / Native) | Effort | HA Failover Group | Failover Models | Responsibility |
|---|---|---|---|---|---|
| `developer` | `cliproxyapi/claude-sonnet-5-5` | `medium` | `development` / `fast` | `gemini-3.8-flash-high:high`, `gemini-4-argon:medium`, `gpt-6-luna:high` | Focused surgical edits, test-driven fixes |
| `reviewer` | `cliproxyapi/claude-opus-5-5` | `high` | `reviewer` | `gemini-4-argon:high`, `gemini-3.8-flash-high:high`, `gpt-6-luna:high` | Code review gates, defect detection |
| `oracle` | `cliproxyapi/claude-opus-5-5` | `high` | `reviewer` | `gemini-4-argon:high`, `gemini-pro-agent:high`, `gpt-6-luna:high` | Second-opinion architectural challenge |
| `architect` | `cliproxyapi/claude-opus-5-5` | `high` | `reviewer` | `gemini-4-argon:high`, `gemini-pro-agent:high`, `gpt-6-luna:high` | Component boundaries, domain models |
| `security` | `cliproxyapi/claude-opus-5-5` | `high` | `reviewer` | `gemini-4-argon:high`, `gemini-pro-agent:high`, `gpt-6-luna:high` | Trust boundaries, vulnerability audit |
| `tests-expert` | `cliproxyapi/gpt-6-luna` | `high` | `testing` | `gemini-3.8-flash-high:high`, `gemini-4-argon:high` | Test authoring, edge-case analysis |
| `researcher` | `cliproxyapi/gpt-6-luna` | `xhigh` | `research` | `gemini-pro-agent:high`, `gemini-4-argon:high` | Web & codebase deep investigation |
| `scout` | `opencode-go/cat-jam-free` | `medium` | `scout` | `gemini-3.8-flash-high:medium`, `go/cat-jam-free:medium` | Fast repo mapping, 1M context |
| `summarizer` | `cliproxyapi/claude-haiku-5-5` | `low` | `summary` | `gemini-3.5-flash-lite:low`, `cat-jam-free:low` | Text summarization without tools |
| `qa`, `release`, `sre` | `cliproxyapi/claude-sonnet-5-5` | `medium` | `development` | `gemini-3.8-flash-high:medium` | Coverage, release, ops verification |
| **GGA** | `cliproxyapi/claude-opus-5-5` | `high` | `reviewer` | `gemini-3.8-flash-high:high`, `gemini-4-argon:high` | Pre-commit quality gate |

Use `pi-ha status` and `pi-ha group <name> <models...>` to verify and switch active failover groups.

## Conflict rules

- Precedence: user and repository instructions, then host harness rules, then skill defaults.
- One owner per concern per work item: one spec-to-code pipeline (Matt tickets, EE SDD or Gentle SDD, never several), one review mechanism per candidate, one memory store, one orchestrator. Matt `implement-spec` and `chief-of-staff` are orchestrators themselves: when one owns a build, supervise and verify instead of dispatching the same tickets again.
- Gentle harness rules bind when it is the host: writes stay single-threaded unless isolated parallel worktrees are approved, and child subagents do not spawn subagents. Flatten the chief layer into labeled roles or direct master dispatch there ([coordination.md](coordination.md)).
