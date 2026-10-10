# Independence-first dispatch

Never open sessions or panes just because concurrency is available. Inventory and dependency analysis come first; then open one session/pane per independent, actionable unit of work. Parallelism is a tool, not a goal: maximize validated independent progress at minimum coordination cost.

## Relations between work items

Classify every pair from evidence before dispatch:

| Relation | Handling |
| --- | --- |
| Independent | Run concurrently, one session each |
| Related (same feature/subsystem) | Group into one session or one ordered chain |
| Sequential (B needs A) | Run in order; B starts from A's branch or after A merges |
| Conflicting (same files, API, schema, infra) | Serialize, merge into one task, or land a base change first |
| Duplicate / superseded | Keep one; close or link the other with authorization |
| Merge-ready (code exists) | Review-only session, no new implementation |
| Blocked | Record blocker and owner; do not dispatch |

Only the independent class is parallel by default. Prefer finishing an existing PR over opening a duplicate.

## Execution mode per item

Direct (small, isolated) / dedicated session (real investigation or implementation) / parallel group (proven independent) / review-only (verification, CI, merge assessment) / investigation (root cause unclear). Do not turn every issue into an implementation session.

## Ownership reservation

Before a worker starts, reserve its area in the registry (for example `frontend/auth/* -> I#42`). Overlapping reservations are a conflict: resolve by serialization or grouping, never by hoping merges work out. One writer per worktree.

## Master does not implement

The master inventories, builds the graph, assigns, checks evidence and decides merges. Workers implement. A master that edits the same files as its workers is a defect.

## Worker contract

Each worker receives a bounded brief only: objective, issue/PR context, allowed and forbidden scope, branch/worktree, dependencies, validation to run, completion criteria, and the mandatory report-back clause from [supervision.md](supervision.md). A brief without it is not dispatchable. Progressive disclosure: no whole-project dumps. Skills are chosen per task by [routing.md](routing.md); never load every installed skill into every session.

Worker lifecycle: `DISCOVER -> UNDERSTAND -> PLAN -> IMPLEMENT -> VERIFY -> SELF-REVIEW -> HANDOFF -> READY`. Not `READY` until validation has run. Master lifecycle: `INVENTORY -> DEPENDENCY GRAPH -> DISPATCH -> SUPERVISION -> INTEGRATION -> REVIEW -> MERGE -> CLEANUP`. SUPERVISION is an active loop, not a phase name: see [supervision.md](supervision.md).

## Task registry

Keep one registry (master context or authorized artifact): `task_id`, repo, issue/PR, session/pane, Herdr agent name, worktree, branch, status, dependencies, owner, validation state, next action. Check it before creating a pane so no two sessions own the same task. Name panes semantically (`repo:issue-142-auth-timeout`, `repo:pr-87-review`, `repo:compose-validation`).

## Multiple repositories

One Herdr workspace per repository. Map ownership and API/schema contracts first, decide merge order, and prefer: backward-compatible provider change, then consumer adoption, then removal of the compatibility layer. Avoid simultaneous tightly coupled changes.

## Merge queue

Keep `READY`, `WAITING FOR DEPENDENCY`, `NEEDS FIX`, `BLOCKED`, `OBSOLETE`. Merge by dependency order, not creation time. After individual tasks pass, run a separate integration pass on the combined result: green tasks can still conflict together.

## Failure handling

On failure, classify the cause (implementation, test, environment, dependency, repository inconsistency, wrong assumption, parallel conflict) and record it. Change strategy before retrying; bound retries (default 2); escalate architectural ambiguity instead of generating speculative code.

## Fallbacks

No Herdr: independent worktrees and sessions. No Pi: the available coding agent. No Engram: repository-local handoff. No Compose: repository-native validation. No issue provider: local registry. Never claim an unavailable tool ran.
