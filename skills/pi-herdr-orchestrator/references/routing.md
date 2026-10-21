# Dynamic skill routing

Read installed skill instructions and select the smallest sufficient set. Every name below is a candidate, never a guarantee: confirm it in the capability report or the host's skill list and skip what is missing. Load a skill in the session that needs it, not in the master.

## Executable PiWorkflow loadout

A routing decision is incomplete until it is encoded in the child-agent options:

```javascript
agent(taskPrompt, {
  label: "[CHIEF/QUALITY] Verification",
  skills: ["pi-herdr-orchestrator", "engineering-excellence", "tdd"],
  extensions: ["builtin:codemode"],
  worktree: "quality",
});
```

- `skills` selects skill names, `extensions` selects Pi extensions, `label` becomes the human-facing Herdr tab label, and `worktree` gives a writing agent an isolated Git worktree. Use only selectors confirmed by the live capability report and the current Pi settings.
- Use `parallel("<operation>", { ... })` for independent agents and `pipeline("<operation>", items, stages)` for repeated ordered stages. The object insertion order is the intended launch order; PiWorkflow assigns the display indices and `@piewf/herdr` renders them as numbered tabs when fully inspectable mode is enabled.
- The common Engineering Excellence loadout is `skills: ["engineering-excellence"]`; add `tdd`, `code-review`, `testing`, `security`, `ci`, or `platform-testing` only when the capability report confirms those skill files exist and the task needs them. Add `gentle-ai`, `work-unit-commits`, or `judgment-day` only for their applicable lifecycle responsibilities.
- A missing requested skill or extension is a routing failure. Record `BLOCKED` with the missing selector and do not silently launch a child with a weaker contract. A host without PiWorkflow or Herdr uses the documented direct-session fallback and reports `NOT APPLICABLE` for tab transport.

## Ecosystems

| Source | Provides | Notes |
| --- | --- | --- |
| PiWorkflow | Execution substrate: `workflow`, `parallel`, `pipeline`, `withWorktree`, `shell`, `agent.create` handles, roles, recovery (`workflow_status`, `workflow_retry`, `workflow_resume`) | Sequences work, supplies no method. `withWorktree` needs a clean launch tree and `tools.*` calls fail inside it; otherwise create worktrees with Git |
| Gentle AI | Harness discipline (`gentle-ai`), Engram memory, `work-unit-commits`, `chained-pr`, `branch-pr`, `issue-creation`, `judgment-day`, `rdd-defect-workflow`, `sdd-*` phases; `systemic-issue-triage` and `issue-root-resolution` in the upstream skill set | Review lifecycle (`gentle_review*`) is runtime-supplied: relay it, never reconstruct it |
| Engineering Excellence | Standards loaded on demand as references: `sdd`, `tdd`, `testing`, `quality-gates`, `code-review`, `security`, `performance`, `accessibility`, `interaction`, `docker`, `ci`, `production-readiness`, `engineering-score`, plus PR/ADR templates | The maintainer fork `darkrei08/Engineering-Excellence` (upstream `micio86dev`) adds `platform-testing` and `context-budget`; an installed copy may lag, so check the files exist |
| Matt Pocock (`mattpocock/skills`) | Flow skills: `triage`, `wayfinder`, `to-spec`, `to-tickets`, `implement`, `implement-spec`, `diagnosing-bugs`, `tdd`, `code-review`, `pr`, `handoff`, `retro`, `grill-with-docs`, `grill-me`, `prototype`, `research`, `codebase-design`, `improve-codebase-architecture` | `setup-matt-pocock-skills` stores the tracker and label mapping: read it, never assume labels |
| Local or personal | `issue-ops`, `container-test-matrix`, `multi-repo-product-workflow`, `project-memory` | Repository and user instructions name which apply |

## Route by situation

| Situation | Minimal method, first installed wins |
| --- | --- |
| Raw issue or PR you did not create | Matt `triage`; Gentle `issue-creation` where its taxonomy applies. Tickets from `to-tickets` are already agent-ready: do not re-triage |
| Backlog sharing root causes | Gentle `systemic-issue-triage` / `issue-root-resolution`: one fix per root, close against named tests |
| Ambiguous requirement or decision | Matt `grill-with-docs` (`grill-me` without a repo), or one targeted user question |
| Foggy effort too big for one session | Matt `wayfinder`, then `to-spec`; Gentle `sdd-explore` / `sdd-propose` when the repository runs SDD |
| Plan into work items | Matt `to-spec` then `to-tickets` (its blocking edges are dependency-graph input); EE `sdd`; Gentle `sdd-spec` / `sdd-tasks` |
| Reproducible or hard bug | Matt `diagnosing-bugs` (tight feedback loop first), then a `tdd` regression test; Gentle `rdd-defect-workflow` when review authority is active |
| Defined feature | Matt `implement` (`tdd`, `code-review`, commit); EE `sdd` + `tdd`; Gentle `sdd-apply` when that cycle is already running |
| Refactor | Behaviour-preservation tests first (`tdd`, EE `testing`); Matt `codebase-design` / `improve-codebase-architecture` for shape |
| Technical or factual uncertainty | Matt `prototype` (throwaway) or `research` |
| UI work | EE `interaction`, `accessibility`, `i18n`, `seo` as relevant; browser evidence; visual design skills only for visual design tasks |
| Infrastructure, containers, CI | EE `docker`, `ci`, `production-readiness`; OS-specific behaviour: EE `platform-testing` or `container-test-matrix` |
| Security, performance | EE `security`, `performance`; matching reviewer role |
| Candidate review | Independent context: Matt `code-review` (Standards and Spec vs a fixed point) or a reviewer role; Gentle `judgment-day` only when dual or adversarial review is requested; GGA before `READY` |
| Commits and PR | Gentle `work-unit-commits`, `chained-pr` for oversized diffs, `branch-pr` (issue-first, each remote action separately authorized); Matt `pr` for the body; EE pull-request template |
| Cross-repository feature | `multi-repo-product-workflow` when installed; provider-first order in [dispatch.md](dispatch.md) |
| Context pressure, new harness | Engram handoff and [state-protocol.md](state-protocol.md); Matt `handoff` (narrow: new harness, directory or colleague); EE `context-budget` |
| Session lessons | Matt `retro` |
| Large codebase context | Serena/graphify for targeted evidence, then RTK/sqz/LEA/TOON as discovered |

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
