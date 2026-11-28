# Dynamic skill routing

Read installed skill instructions and select the smallest sufficient set. Every name below is a candidate, never a guarantee: confirm it in the capability report or the host's skill list and skip what is missing. Load a skill in the session that needs it, not in the master.

## Executable PiWorkflow loadout

A routing decision is incomplete until it is encoded in a named workflow's direct child-agent options. Every direct call must select a `pi-ext-roles` role and retain the MCP bridge:

```javascript
agent(taskPrompt, {
  role: "reviewer",
  label: "#1 [CHIEF/QUALITY] Verification",
  skills: ["!*", "pi-herdr-orchestrator", "engineering-excellence", "tdd"],
  extensions: ["!*", "builtin:codemode", "builtin:tool-search", "builtin:mcp"],
  worktree: "quality",
});
```

- `role` selects a named `@piewf/pi-ext-roles` role; `skills` selects skill names; `extensions` selects Pi extensions; `label` becomes the human-facing Herdr tab title; `worktree` gives a writing agent an isolated Git worktree. Prefix the label with its 1-based dispatch position (`#1`, `#2`, ...) so launch order is visible in Herdr and verifiable in review. Use only selectors confirmed by the live capability report and the current Pi settings.
- `builtin:codemode` is the stable bridge to MCP tools. `builtin:tool-search` and `builtin:mcp` are required alongside it for every workflow-owned role session, even when the role file's own selectors are narrower. Tool names are runtime-specific: `web_search` is a host tool, while `mcp__<server>__<tool>` is valid only for a configured MCP server with that exact name. Never synthesize `mcp__web_search`; use `tool_search` or codemode to resolve the live name, then report a missing provider as `BLOCKED` without inventing results. Host tools are not added to a child merely by selecting MCP extensions, so research agents must explicitly receive the resolved search tool in their `tools` allowlist. Omit `timeoutMs` entirely; in Vekexasia's runner omitted or null means no timer is armed. Launch the named workflow with `foreground: true` and no budget; a foreground run can detach and deliver later.
- Default child loadout is `skills: ["!*", "pi-herdr-orchestrator", "engineering-excellence"]` plus one installed task skill (`tdd`, `code-review`, `diagnosing-bugs`, `pr`, `container-test-matrix`, `work-unit-commits`, `chained-pr`, `judgment-day`, `gentle-ai-branch-pr`). `issue-ops` is root-only. Matt `wayfinder`, `to-spec`, `to-tickets`, `triage`, `implement`, `handoff`, `retro`, `grill-me` and `grill-with-docs` are master-session only and declare `disable-model-invocation: true`; no session selects them on its own, and `/skill:<name>` is operator-entered, so a child cannot invoke one. See [Route by situation](#route-by-situation) for the only working child route.
- Research roles receive scope, not just a topic: the child prompt names the phase question, the explicit allowed paths/globs, the resolved tool names and a per-phase deadline, and requires a compact terminal result per phase. A read-only scout omits memory calls or passes an explicit `project` and cwd. A child that ends without a terminal result is classified with the envelope in [supervision.md](supervision.md) before any retry, because a broad unbounded research phase is the common cause of a missing report, not evidence of a transport fault.
- Use `parallel("<operation>", { ... })` for independent agents and `pipeline("<operation>", items, stages)` for repeated ordered stages. The object insertion order is the intended launch order; with the trusted fully inspectable setting, `@piewf/herdr` creates one numbered, labeled tab per agent in that order inside the workflow workspace. Labels and numbers remain presentation only, and a new workspace or cwd requires an explicit user request.
- Native `subagents_run` is forbidden for orchestration. A host without PiWorkflow uses the documented direct fallback only when PiWorkflow is genuinely unavailable; do not silently downgrade an available workflow runtime. A capability rejection is a pre-dispatch routing result, not a child timeout: record `BLOCKED`, correct the loadout or surface the missing capability, and do not create duplicate Herdr tabs.
- The common Engineering Excellence loadout is `skills: ["!*", "engineering-excellence"]`; add `tdd`, `code-review`, `testing`, `security`, `ci`, or `platform-testing` only when the capability report confirms those skill files exist and the task needs them. Add `gentle-ai`, `work-unit-commits`, or `judgment-day` only for their applicable lifecycle responsibilities.
- A missing requested skill or extension is a routing failure. Record `BLOCKED` with the missing selector and do not silently launch a child with a weaker contract. Herdr unavailable means the child keeps its session and worktree while the tab transport is `NOT APPLICABLE`; PiWorkflow unavailable uses the documented direct-session fallback and also reports `NOT APPLICABLE` for tab transport.
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

## Role source of truth

Pi Herdr Orchestration does not define roles or role-to-model assignments. The installed `pi-ext-roles` roles and `modelAliases` are the single source of truth.

- Inspect an active role with `pi-role --identify <role>`.
- Resolve model and effort from the active `pi-ext-roles` settings, not from this repository.
- Use only role names that exist in the installed `roles/` directory. A missing or unavailable role is `BLOCKED`.
- Host failover groups are owned by the host configuration; this repository records no duplicate matrix.

### Ticket supervision contract

Every ticket, map entry, grilling answer or documentation draft must be reviewed before it becomes an implementation input. Use two distinct `pi-ext-roles` selectors from `config/ticket-supervision.json`:

- Producer: `developer` via `developer-model`.
- Supervisor: `reviewer` via `reviewer-model`.

Resolve both aliases from `modelAliases` in the active `pi-ext-roles` settings; do not duplicate physical model strings in this repository. Run `npm run check:ticket-supervision` to verify that the two aliases resolve to different models or effort. The supervisor is an independent perspective, not a restatement of the producer output. If both roles resolve to the same alias, model or effort, report `BLOCKED` and do not create or activate the ticket.

### Model-fit evidence envelope

Rows in that matrix are configuration, never availability evidence: a listed route does not prove entitlement, inference, or quota. Consume `pi-model-fit` output only through `skills/pi-herdr-orchestrator/scripts/model-fit-evidence.mjs`, which is read-only and fail-closed:

```javascript
import { readModelFitEvidence } from "../scripts/model-fit-evidence.mjs";

const evidence = readModelFitEvidence(envelope, { now: Date.now() });
// evidence.outcome: PASS | UNKNOWN | BLOCKED | NOT RUN
// evidence.evidenceRef: the pi-model-fit report reference, preserved
// evidence.routing: always "unchanged"
```

The accepted envelope, version `pi-model-fit-evidence/1`:

```json
{
  "schema": "pi-model-fit-evidence/1",
  "source": "pi-model-fit",
  "generatedAt": "2026-11-26T11:30:00.000Z",
  "evidenceRef": "pi-model-fit/reports/2026-11-26.md#role-matrix",
  "routes": [
    { "route": "cliproxyapi/claude-opus-5-5:high", "outcome": "PASS" }
  ]
}
```

- Only the four explicit outcomes are accepted. Anything else, a foreign `source`, a static catalog or model matrix, a missing `evidenceRef`, an unparseable or future `generatedAt`, and an empty or malformed `routes` list return `BLOCKED`.
- A missing envelope returns `UNKNOWN`; an envelope older than the 24-hour freshness window (`DEFAULT_FRESHNESS_MS`, injectable through `freshnessMs`) returns `UNKNOWN` with its `evidenceRef` preserved for diagnosis.
- Mixed route outcomes collapse to the worst one, in the order `BLOCKED`, `UNKNOWN`, `NOT RUN`, `PASS`. `NOT RUN` and `UNKNOWN` are never passing.
- The reader never selects, replaces, or reorders a route, writes no state, and never runs SkillOpt harvest, run, or adopt: `pi-model-fit` remains the owner of catalogs, entitlement, and quota evidence. Missing or unverifiable evidence is reported as `UNKNOWN` or `BLOCKED` to the Master Chief, not filled in from a matrix or a default.

## Conflict rules

- Precedence: user and repository instructions, then host harness rules, then skill defaults.
- One owner per concern per work item: one spec-to-code pipeline (Matt tickets, EE SDD or Gentle SDD, never several), one review mechanism per candidate, one memory store, one orchestrator. Matt `implement-spec` and `chief-of-staff` are orchestrators themselves: when one owns a build, supervise and verify instead of dispatching the same tickets again.
- Gentle harness rules bind when it is the host: writes stay single-threaded unless isolated parallel worktrees are approved, and child subagents do not spawn subagents. Flatten the chief layer into labeled roles or direct master dispatch there ([coordination.md](coordination.md)).
