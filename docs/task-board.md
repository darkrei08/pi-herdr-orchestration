# Task board

`scripts/task-board.mjs` renders a self-contained interactive Kanban board from `task-map-envelope/v1` evidence. It is a local view: GitHub remains authoritative for ticket state and blockers, while the envelope owns Pi session, worktree and evidence identity.

The envelope schema stays in [`docs/task-map-envelope.md`](task-map-envelope.md). This document covers the board workflow only.

## Pull and render

Generate an envelope file with the existing envelope CLI, then render it:

```bash
npm run taskmap:envelope -- --mailbox /tmp/mailbox.json --herdr /tmp/herdr-agents.json --repo pi-herdr-orchestration --subject "Session evidence" --source mailbox > /tmp/task-map-envelopes.json
npm run taskmap:board -- --input /tmp/task-map-envelopes.json --output /tmp/task-board.html
```

`--input` is a file path. Stdin is ignored and `-` is rejected. On success the CLI prints the output path on the first stdout line and per-column counts on the second line, for example `Intake=1 Spec=0 Ready=0 In Progress=0 Review=0 Ready to Merge=0 Blocked/Waiting=0 Closed=0`. Errors print one message to stderr and exit non-zero. The same path and counts pattern is used by the PR and factory adapters, which also print `duplicates`, `blocked`, `mode` and `enabled` where applicable.

The command is intentionally on-demand. There is no watcher and no implicit refresh loop. Re-run it after an envelope or adapter update.

## Columns and cards

The board uses the eight columns from Wayfinder #95: `Intake`, `Spec`, `Ready`, `In Progress`, `Review`, `Ready to Merge`, `Blocked/Waiting` and `Closed`.

Column precedence:

1. Any `blockers` or `waiting` entry forces `Blocked/Waiting`.
2. `state` selects the column.
3. Evidence may select `Spec`, `Review`, `Ready to Merge` or `Closed` when the state alone is insufficient.
4. Unknown state lands in `Blocked/Waiting` with an explicit reason.

Cards show all envelope fields and untruncated evidence. Legacy envelopes gain `events: []` and one `migrated` event. Events are rendered with a head/tail cap; the omission line states the cap and total count, while the logical event list is never truncated.

Cards are deduplicated by `org/repo/ticket/source/pi_session_id/workspace_id/tab_id/pane_id` and sorted by `org`, `repo`, `ticket` and `created_at`. Missing session identity is shown as `session unavailable`, not invented.

## Push and writeback

The local adapters produce dry-run projections. They do not call GitHub, TaskView, Herdr, webhooks or any remote service unless an approved audit and explicit configuration are supplied.

```bash
npm run taskmap:pr -- --input /tmp/pr-events.json --output /tmp/pr-projection.json
npm run taskmap:factory -- --input /tmp/factory-jobs.json --output /tmp/factory-projection.json
```

PR events are `opened`, `ready_for_review`, `review`, `checks`, `changes_requested`, `approved`, `merged` and `closed`. Their idempotency key is `org/repo/PR/event/id`. Open PRs project to `Review`, `checks PASS` plus approval to `Ready to Merge`, and verified merge to `Closed`.

Factory `intake` and `spec` project to `Intake`. Gate outcomes are `PASS`, `FAIL` and `BLOCKED`. ODD task docs and logs remain the local authority; the adapter only projects evidence.

Writeback remains blocked until the integration tickets supply an explicit target:

- TaskView instance URL, token and webhook secret (issue #110).
- Provider URLs and one master token per enabled provider (issue #111).
- Herdr App migration target and inventory approval (issue #112).
- Windows host, user, scope and backup target (issue #113).

Domain authority is never replaced by timestamps or UI overwrites. Every transition carries a timestamp, source, previous column, new column and reason in the envelope `events` array. Forward-only transitions are implicit; a reopen requires an explicit reason.

## Verification

Run all local checks from the worktree:

```bash
npm run test:taskmap
npm test
npm run lint
npm run check:strict
git diff --check
```

For HTML verification, open `/tmp/task-board.html` in a browser and check keyboard filtering, column collapse, long evidence wrapping and `prefers-reduced-motion`. The generated HTML has inline CSS/JS, no external assets, escaped field values and eight `data-column` sections.

Live verification is NOT RUN: no TaskView HTTP round trip, signed webhook delivery, GitHub writeback, Herdr App projection or Windows SSH test was performed. Those checks belong to issues #110-#113.
