# Task map envelope

`scripts/task-map-envelope.mjs` is the local canonical envelope for tickets, sessions, worktrees, repository ownership and follow-up state.

The envelope is intentionally local and dependency-free. It does not make TaskView the source of truth and does not contact Herdr App, Telegram or any remote service.

## Version

```text
task-map-envelope/v1
```

## Required fields

- `subject`
- `source`
- `ticket`

Identity and follow-up fields are nullable when unavailable:

- `org`, `team`, `project`, `repo`
- `session_name`, `pi_session_id`, `workspace_id`, `tab_id`, `pane_id`
- `worktree`, `branch`
- `state`
- `evidence`, `blockers`, `waiting`, `next`
- `summary`
- `revision`
- `events`

`revision` starts at `0`. Each entry in `events` uses the twenty-field schema exported as `EVENT_FIELDS` by `scripts/task-map-envelope.mjs`. Legacy envelopes without `events` are migrated with `events: []` plus one `migrated` event. Corrections increment `revision` and add a corrective event with `correlation_id`. Logical history is unbounded; `scripts/task-board.mjs` caps only rendered head and tail events.

## Commands

```bash
node scripts/mailbox.mjs status --run default --json=true > /tmp/mailbox.json
herdr agent list > /tmp/herdr-agents.json
npm run taskmap:envelope -- --mailbox /tmp/mailbox.json --herdr /tmp/herdr-agents.json --repo pi-herdr-orchestration --subject "Session evidence" --source mailbox
```

To produce input for the Telegram bot:

```bash
npm run taskmap:envelope -- --mailbox /tmp/mailbox.json --herdr /tmp/herdr-agents.json --repo pi-herdr-orchestration --subject "Session evidence" --source mailbox --telegram-input > /tmp/telegram-report-input.json
npm run telegram:report -- --input /tmp/telegram-report-input.json --dry-run
```

## Mapping rules

- `ticket` comes from the mailbox `task` field.
- `state` comes from the mailbox `state` field.
- `session_name` comes from the matching Herdr agent name.
- `pi_session_id` is extracted from the Herdr `agent_session.value` transcript path when it contains a UUID.
- `workspace_id`, `tab_id` and `pane_id` come from the matching Herdr agent.
- Missing Herdr identity is recorded in `waiting` as `Herdr identity unavailable`.
- A pending mailbox question becomes a blocker.
- `evidence` ignores `-` and empty values.
- `--telegram-input` only maps the envelope to the existing Telegram report input shape. It does not change the Telegram formatter.

## Scope boundary

TaskView, Herdr App integration and remote session migration require a configured instance, credentials or an explicit app target. None are assumed here. See [`docs/task-board.md`](task-board.md) for the local board workflow and blocked writeback integrations.
