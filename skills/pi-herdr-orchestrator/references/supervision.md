# Supervision and report-back

A dispatched session that nobody watches and that never reports is not delegation, it is loss of control. Dispatch is complete only when the three pieces below exist: a named agent, a report-back contract in its brief, and a master that stays in the supervision loop until every task is closed or escalated.

## Channels

| Channel | Direction | Role |
| --- | --- | --- |
| Mailbox `scripts/mailbox.mjs` / `orch_report` | worker -> master | Source of truth. One JSON file per task in `<git-common-dir>/orchestrator/<run>/`, shared by all worktrees, untracked. Atomic directory lock (`lock.mjs`), monotonic `seq`, append-only `events.jsonl`, preserves uppercase states and provides derived lifecycle field |
| Semantic evidence store | worker -> master | Large logs/diffs saved to `<git-common-dir>/orchestrator/<run>/evidence/<sha256>.txt`. Passed as compact `ref:sha256:<hash>` so context windows stay pristine; inspectable on demand via `readEvidence` / `orch_evidence` without copying large payloads into prompts |
| Ask / Reply protocol (`orch_ask` / `orch_reply`) | worker <-> master | Worker flags `BLOCKED` with a question; master replies without worker hanging or spinning |
| `herdr agent list/get/wait/read` | master observes worker | Liveness only: `working`, `idle`, `done`, `blocked`, `unknown`. Never proof of completion |
| `herdr agent prompt` | master -> worker | Directives, nudges, decisions |
| `herdr agent prompt <master>` | worker -> master | Best-effort wake-up after a report (`ORCH_MASTER`). The target must be a distinct Herdr agent name, never the worker's own Pi/session id. Dispatched non-blockingly (`spawn` unref) so delivery or notification failure cannot block mailbox persistence or turn a completed report into a failure |

Pane state says whether an agent is busy. Only a mailbox report plus Git evidence says what it achieved.

### Identity contract

The dispatch record may include `identity.pane` and `identity.session`; unknown values are omitted.
A matching recorded and live identity is `live`, subject to the existing liveness proof requirements.
A conflicting identity is `decide` with both identities in the reason; it is never `live` or `lost`.
A missing live identity or a legacy record without identity is `unverified`, never `live` or `lost`.
Name matching only selects a liveness candidate; it is a hint, not proof of ownership.
If Herdr is unavailable, status is `unverified` and mailbox/Git evidence decides; Herdr is not a hard requirement.
No matching live agent keeps the existing absent/`GONE` handling.

## Workflow timeout and MCP evidence

Do not set a preset `timeoutMs` on workflow-owned role sessions: omit `timeoutMs` and use no budget; launch the named workflow with `foreground: true` and let foreground delivery detach if the parent turn ends. If an explicit timeout is supplied by an external caller and fails, report it as a failed attempt, not proof that PiWorkflow is unavailable. Before dispatch and during smoke verification, run the read-only registry checker:

```sh
node skills/pi-herdr-orchestrator/scripts/check-mcp.mjs --json --timeout-ms 2000
```

The checker reports configured server names, redacted transport reachability, and HTTP health status; it never prints command arguments, environment values, headers, or credentials. URL MCP `initialize` probes verify the HTTP MCP endpoint when a protocol response is returned; stdio executable probes do not start the server and remain `unverified`. Record its JSON output as evidence. `builtin:codemode` remains the stable MCP bridge, with `builtin:tool-search` and `builtin:mcp` required in every workflow role loadout. Native `subagents_run` is not an orchestration fallback.

## Terminal failure envelope

A dispatched branch that ends without a terminal report is a failed result, not a finished assignment, and one timed out branch never erases a sibling that completed. Classify the branch before retrying anything, and record the classification in the mailbox decision:

| Field | Values |
| --- | --- |
| `cause` | `MODEL`, `CAPABILITY`, `HERDR`, `TIMEOUT`, `UNKNOWN` |
| `evidence` | `ref:sha256:<hash>` for the run record, the child session JSONL and any pane read |
| `branches[]` | per branch `status` `COMPLETED`/`TIMEOUT`/`FAILED`/`NOT_STARTED`, `result_ref` when completed, `side_effects` `OBSERVED`/`NONE`/`UNKNOWN` |
| `recovery` | `NONE`, `SAFE` (re-dispatch allowed), `FORBIDDEN` (inspect uncertain effects first) |

| `cause` | Proof required before using it | Not this |
| --- | --- | --- |
| `CAPABILITY` | Pre-dispatch capability report or child error naming the missing role, skill, extension, model or MCP server | A child that started and used tools |
| `HERDR` | No live agent or pane for the name, or a transport error, with no child session progress after dispatch | A child session that kept issuing tool calls until the deadline |
| `TIMEOUT` | The deadline elapsed while the child session JSONL shows model turns or tool progress | Proof that the task is impossible or that the transport is broken |
| `MODEL` | Provider or model-preflight error on an unchanged loadout, reproduced after a Pi restart | Any failure recorded before a package or provider update |
| `UNKNOWN` | Default when the evidence above is missing or ambiguous | Nothing: no retry, no new writer, escalate |

A model-preflight failure recorded before a restart or after a provider or workflow package update is `UNKNOWN`, not `MODEL`: the running process still holds the previous modules and provider registry. Restart Pi, re-run the preflight, and classify from the new result.

### Partial aggregate result

A timed out branch must not suppress a completed sibling. The run result carries every branch that returned with its own `status` and evidence reference, plus each failed branch with its classification and `side_effects`; the aggregate reports `PARTIAL`, never `COMPLETED` and never an empty failure, and it reports `BLOCKED` once a branch reaches its retry bound. Completed sibling results stay preserved as mailbox evidence, and integration covers only the completed branches after the master reconciles them against Git.

### Idempotent recovery

Recovery is keyed by run id plus task id and starts from the persisted checkpoint, so repeating it reproduces the same decision instead of creating a second writer:

1. Re-dispatch only a branch whose `side_effects` is `NONE`; never replay a completed branch and never re-run a branch whose tools may already have written outside it.
2. `OBSERVED` or `UNKNOWN` effects block re-dispatch: read the worktree, Git state and the external systems first, then `FORBIDDEN` unless the operator authorizes otherwise.
3. A retry keeps the same run, task and branch identity, so a duplicate report is ignored by `seq` instead of being applied twice.
4. The bounded retry rule below still applies: per branch at most `budget.maxRetries` retries (default one), then the branch is `failed` in the graph and the run is `BLOCKED` with the envelope as evidence. The supervision loop's separate nudge and restart budget of 2 is unchanged.

### Fan-out resolution helper

`skills/pi-herdr-orchestrator/scripts/fanout-retry.mjs` is the pure, injectable resolver for one fan-out observation. It reads the persisted graph for each branch's `retry_count` and `budget.maxRetries`, validates the envelope fields, and returns one decision per branch plus the graph actions that record it. The mailbox stays the lifecycle and identity source of truth and the graph stays the retry counter, so no second state file is introduced.

| Input | Values |
| --- | --- |
| `outcome` | `COMPLETED`, `TIMEOUT`, `FAILED`, `NOT_STARTED` |
| `side_effects` | `OBSERVED`, `NONE`, `UNKNOWN` (default, never retried) |
| `cause` | `MODEL`, `CAPABILITY`, `HERDR`, `TIMEOUT`, `UNKNOWN` (default) |
| `liveness` | mailbox flag observed for the branch, for example `STALE` |
| `identity` | `pane` and `session` copied from the mailbox record |
| `result_ref` / `evidence` | `ref:sha256:<hash>` for a completed result or for the failed attempt |

| Decision | Reason code | Graph actions |
| --- | --- | --- |
| `ACCEPT` | `FANOUT_COMPLETED` | none; the completed sibling result stays in the aggregate |
| `RETRY` | `FANOUT_RETRY_BOUNDED` | `fail` then `retry`, so the attempt classification stays in `events.jsonl` and `retry_count` increments |
| `BLOCK` | `FANOUT_RETRY_EXHAUSTED` | `fail`; the run reports `BLOCKED` with the envelope |
| `BLOCK` | `FANOUT_SIDE_EFFECTS_UNCERTAIN` | `fail`; `OBSERVED` or `UNKNOWN` effects are never replayed |

A stale branch is a `TIMEOUT` outcome with `liveness: "STALE"` and a `TIMEOUT` cause. The resolver only schedules: apply its actions with `stepGraphState`, persist them with `persistGraphState`, then report `resolution.report.summary` through the mailbox so the dashboard shows the exact reason code, the branch identity and the evidence reference. It never launches an agent, merges or publishes, and no quota failover is implemented or claimed: a provider quota error stays `UNKNOWN` or `MODEL` evidence.

## Dispatch

1. Pick a run id (`ORCH_RUN`, for example `repo-20261009`) and a unique agent name per task matching `[a-z][a-z0-9_-]{0,31}` (`issue84`, `pr127`).
2. With the trusted project setting enabled, the named workflow launches each agent as its own numbered, labeled tab in the workflow workspace, in admission order; each write-capable agent keeps its isolated worktree. Do not shell out to `pi` or create tabs manually. If the runtime reports sibling panes or a local session instead, keep that identity and do not claim ordered tabs; use the agent label from [coordination.md](coordination.md).
3. Register the task (task id, agent name, pane, worktree, branch) and write the first report: `node mailbox.mjs report --run R --task I#84 --agent issue84 --state ASSIGNED [--pane <pane>] [--session <session>]`.
4. Send the brief with `herdr agent prompt <name> "<brief>"` without `--wait` for parallel work. Every brief ends with the report-back clause below.

### Report-back clause (mandatory in every brief)

```text
REPORTING: ORCH_RUN=<run>, ORCH_AGENT=<name>, ORCH_MASTER=<master agent name>.
Report with either native Pi tools (orch_report, orch_ask) or CLI:
  node <skill>/scripts/mailbox.mjs report --task <id> --state <STATE> --summary "<one line>" [--phase P] [--branch B] [--pane PANE] [--session SESSION] [--check name=PASS|FAIL|BLOCKED|NOT RUN] [--evidence "<large output>"] [--risk R] [--next N]
- Report WORKING at each lifecycle phase change and at least every 10 minutes while working.
- If blocked, ask immediately with `orch_ask` (or `node mailbox.mjs ask --task <id> --question "<exact question>"`).
- Large test logs or diffs should be passed via --evidence or `orch_evidence` to avoid context window pollution.
- Report READY or DEVELOPMENT or FAILED as your last action, with every check you ran.
- Never end your turn silently. Do not close your own pane. The master decides what happens next.
```

Name the master agent once with `herdr agent rename "$HERDR_PANE_ID" master` (unless it already has a name) and pass that **Herdr agent name** in `ORCH_MASTER`. Before dispatch, verify `ORCH_MASTER` and `ORCH_AGENT` identify different agents. Never pass a Pi session id to `herdr agent prompt` or a direct session-message API; if no distinct target is available, persist the mailbox report and let the master consume it through `orch_status`.

## Message routing invariant

The mailbox is the durable receive path; Herdr prompts are only best-effort wake-ups. A worker sends reports and questions to the master named by `ORCH_MASTER`, and the master sends replies to the worker identity stored in that task's report. The notifier accepts only a Herdr agent name, rejects Pi session UUIDs and session paths, and skips an empty or self target, so a misconfigured `ORCH_MASTER` cannot send a message back into the same Pi session. A failed or skipped wake-up never invalidates a persisted report or question.

## Supervision loop (master)

The master does not end its turn after dispatch. Repeat until every task is `CLOSED` or explicitly escalated to the user:

1. `node mailbox.mjs status --run R` (adds `--stale-min N`, default 10, and `--json true` for scripts). It joins mailbox reports with live `herdr agent list`.
2. Act on each flag:

| Flag | Meaning | Action |
| --- | --- | --- |
| `OK` | Reporting on time, or closed | Nothing |
| `ASK` | Worker submitted a blocking question (`orch_ask`) | Read the question's `message_id`, then respond with `node mailbox.mjs reply --task <id> --question-id <message_id> --answer "<decision>"` or `orch_reply` |
| `DECIDE` | Worker reported `READY`/`DEVELOPMENT`/`BLOCKED`/`FAILED`, or agent liveness is `unknown` (fail-closed) | Verify with Git and CI, then issue a `decision` (integrate, continue, retry, escalate) |
| `SILENT` | Agent is idle or done but last report is still `ASSIGNED`/`WORKING` | `herdr agent read <name> --source recent-unwrapped --lines 120`, then one nudge: "Report your state with mailbox.mjs now." |
| `STALE` | Agent is working but no report within the stale window | Read the pane; if progressing, ask for a report at the next phase boundary; if looping, steer or stop it |
| `NEEDS_HUMAN` | Herdr sees an approval or question dialog | `agent get` and `agent read`; surface to the user. Never answer approval dialogs on the user's behalf |
| `GONE` | No live agent with that name | Check the worktree and Git; preserve uncommitted work; restart or reassign |
| `NO_HERDR` | Herdr unreachable | Fall back to mailbox only; say liveness is unverified |

3. To block efficiently between checks use `herdr agent wait <name> --timeout 300000`, or wait on whichever agent finishes first, then rerun `status`. Do not poll in a tight loop and do not sleep blindly.
4. After a report, reconcile with Git (commits, diff, CI) before accepting it. A report that conflicts with Git is `BLOCKED`, not `READY`.
5. Record the `decision` as a mailbox report on the task (`--state CLOSED` once the decision is executed and the pane may be closed) and refresh the dashboard in [reporting.md](reporting.md).

## Management rules

- Span of control: one master supervises at most 4-6 live sessions (resource limit and attention limit). More work waits in the queue or goes through chiefs.
- Prompt cache preservation: keep static role briefs and instructions at the prefix; append dynamic per-task arguments at the end to guarantee high cache hit rates and reduce inference costs.
- Semantic evidence references: save extensive diffs and test suites to disk via `storeEvidence`; never copy raw test traces or large diffs into parent prompts.
- Single accountable owner per task; the mailbox file for a task is written only by its worker and by the master's decision.
- Escalate by exception: the master reads only flagged tasks, not every transcript. Read panes only for `SILENT`, `STALE`, `NEEDS_HUMAN` or `GONE`.
- Bounded retries: at most 2 nudges per silence and 2 restarts per task, then mark `BLOCKED` and escalate with evidence.
- `unknown` pane state is not completion and not failure: classify it fail-closed as `DECIDE` to require master verification against the mailbox and Git before proceeding.
- Upstream Herdsman alignment: follows `boadij/pi-herdsman` supervision semantics, exact-session supervision, presentation-only pane and agent labels, and non-blocking notifications.
- Idempotence: reports carry `seq`; ignore a report with a lower `seq` than one already processed.
- Closure order: report persisted, master decision recorded, memory saved, then close the pane. Closing a pane never discards unreported work.
- If Herdr or the mailbox script is unavailable, say so and supervise from Git and pane reads; never claim a session reported when it did not.
