# Supervision and report-back

A dispatched session that nobody watches and that never reports is not delegation, it is loss of control. Dispatch is complete only when the three pieces below exist: a named agent, a report-back contract in its brief, and a master that stays in the supervision loop until every task is closed or escalated.

## Channels

| Channel | Direction | Role |
| --- | --- | --- |
| Mailbox `scripts/mailbox.mjs` / `orch_report` | worker -> master | Source of truth. One JSON file per task in `<git-common-dir>/orchestrator/<run>/`, shared by all worktrees, untracked. Atomic directory lock (`lock.mjs`), monotonic `seq`, append-only `events.jsonl` |
| Semantic evidence store | worker -> master | Large logs/diffs saved to `<git-common-dir>/orchestrator/<run>/evidence/<sha256>.txt`. Passed as compact `ref:sha256:...` so context windows stay pristine |
| Ask / Reply protocol (`orch_ask` / `orch_reply`) | worker <-> master | Worker flags `BLOCKED` with a question; master replies without worker hanging or spinning |
| `herdr agent list/get/wait/read` | master observes worker | Liveness only: `working`, `idle`, `done`, `blocked`, `unknown`. Never proof of completion |
| `herdr agent prompt` | master -> worker | Directives, nudges, decisions |
| `herdr agent prompt <master>` | worker -> master | Best-effort wake-up after a report (`ORCH_MASTER`). Loss is harmless because the mailbox holds the report |

Pane state says whether an agent is busy. Only a mailbox report plus Git evidence says what it achieved.

## Dispatch

1. Pick a run id (`ORCH_RUN`, for example `repo-20261009`) and a unique agent name per task matching `[a-z][a-z0-9_-]{0,31}` (`issue84`, `pr127`).
2. Create the pane and worktree, then `herdr agent start <name> --kind pi --pane <pane>`. Rename the tab per [coordination.md](coordination.md).
3. Register the task (task id, agent name, pane, worktree, branch) and write the first report: `node mailbox.mjs report --run R --task I#84 --agent issue84 --state ASSIGNED`.
4. Send the brief with `herdr agent prompt <name> "<brief>"` without `--wait` for parallel work. Every brief ends with the report-back clause below.

### Report-back clause (mandatory in every brief)

```text
REPORTING: ORCH_RUN=<run>, ORCH_AGENT=<name>, ORCH_MASTER=<master agent name>.
Report with either native Pi tools (orch_report, orch_ask) or CLI:
  node <skill>/scripts/mailbox.mjs report --task <id> --state <STATE> --summary "<one line>" [--phase P] [--branch B] [--check name=PASS|FAIL|BLOCKED|NOT RUN] [--evidence "<large output>"] [--risk R] [--next N]
- Report WORKING at each lifecycle phase change and at least every 10 minutes while working.
- If blocked, ask immediately with `orch_ask` (or `node mailbox.mjs ask --task <id> --question "<exact question>"`).
- Large test logs or diffs should be passed via --evidence or `orch_evidence` to avoid context window pollution.
- Report READY or DEVELOPMENT or FAILED as your last action, with every check you ran.
- Never end your turn silently. Do not close your own tab. The master decides what happens next.
```

Name the master agent once with `herdr agent rename "$HERDR_PANE_ID" master` (unless it already has a name) and pass that name in `ORCH_MASTER`.

## Supervision loop (master)

The master does not end its turn after dispatch. Repeat until every task is `CLOSED` or explicitly escalated to the user:

1. `node mailbox.mjs status --run R` (adds `--stale-min N`, default 10, and `--json true` for scripts). It joins mailbox reports with live `herdr agent list`.
2. Act on each flag:

| Flag | Meaning | Action |
| --- | --- | --- |
| `OK` | Reporting on time, or closed | Nothing |
| `ASK` | Worker submitted a blocking question (`orch_ask`) | Read question, respond with `node mailbox.mjs reply --task <id> --answer "<decision>"` or `orch_reply` |
| `DECIDE` | Worker reported `READY`/`DEVELOPMENT`/`BLOCKED`/`FAILED` | Verify with Git and CI, then issue a `decision` (integrate, continue, retry, escalate) |
| `SILENT` | Agent is idle or done but last report is still `ASSIGNED`/`WORKING` | `herdr agent read <name> --source recent-unwrapped --lines 120`, then one nudge: "Report your state with mailbox.mjs now." |
| `STALE` | Agent is working but no report within the stale window | Read the pane; if progressing, ask for a report at the next phase boundary; if looping, steer or stop it |
| `NEEDS_HUMAN` | Herdr sees an approval or question dialog | `agent get` and `agent read`; surface to the user. Never answer approval dialogs on the user's behalf |
| `GONE` | No live agent with that name | Check the worktree and Git; preserve uncommitted work; restart or reassign |
| `NO_HERDR` | Herdr unreachable | Fall back to mailbox only; say liveness is unverified |

3. To block efficiently between checks use `herdr agent wait <name> --timeout 300000`, or wait on whichever agent finishes first, then rerun `status`. Do not poll in a tight loop and do not sleep blindly.
4. After a report, reconcile with Git (commits, diff, CI) before accepting it. A report that conflicts with Git is `BLOCKED`, not `READY`.
5. Record the `decision` as a mailbox report on the task (`--state CLOSED` once the decision is executed and the tab may be closed) and refresh the dashboard in [reporting.md](reporting.md).

## Management rules

- Span of control: one master supervises at most 4-6 live sessions (resource limit and attention limit). More work waits in the queue or goes through chiefs.
- Prompt cache preservation: keep static role briefs and instructions at the prefix; append dynamic per-task arguments at the end to guarantee high cache hit rates and reduce inference costs.
- Semantic evidence references: save extensive diffs and test suites to disk via `storeEvidence`; never copy raw test traces or large diffs into parent prompts.
- Single accountable owner per task; the mailbox file for a task is written only by its worker and by the master's decision.
- Escalate by exception: the master reads only flagged tasks, not every transcript. Read panes only for `SILENT`, `STALE`, `NEEDS_HUMAN` or `GONE`.
- Bounded retries: at most 2 nudges per silence and 2 restarts per task, then mark `BLOCKED` and escalate with evidence.
- `unknown` pane state is not completion and not failure: classify it from the mailbox and the pane read.
- Idempotence: reports carry `seq`; ignore a report with a lower `seq` than one already processed.
- Closure order: report persisted, master decision recorded, memory saved, then close the pane. Closing a pane never discards unreported work.
- If Herdr or the mailbox script is unavailable, say so and supervise from Git and pane reads; never claim a session reported when it did not.
