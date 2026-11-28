# Task map verification evidence

Recorded on 2026-11-28 from `.worktrees/telegram-evidence-report` on `feat/telegram-evidence-report`.

## Local checks

```text
npm run test:taskmap: 72 tests, 72 pass, 0 fail, exit 0
npm test: 309 tests, 309 pass, 0 fail, exit 0
npm run lint: exit 0
npm run check:strict: Required failures 0, exit 0
git diff --check: exit 0
```

## Live local inventory

Commands:

```bash
node scripts/mailbox.mjs status --run default --json true > /tmp/mailbox-live.json
herdr agent list > /tmp/herdr-agents-live.json
herdr session list --json > /tmp/herdr-sessions-live.json
node scripts/herdr-inventory.mjs --agents /tmp/herdr-agents-live.json --sessions /tmp/herdr-sessions-live.json --mailbox /tmp/mailbox-live.json --output /tmp/herdr-inventory-live.json
```

Result: exit 0. Counts: `agents=9`, `sessions=1`, `mailbox=0`, `inventories=0`, `envelopes=0`, `duplicates=0`, `missing_identity=0`, `network=0`, `mutations=0`. All eight column counts are zero. The local default run has no mailbox rows, so zero envelopes is expected. No Herdr process was restarted, renamed or killed.

The earlier documented form `--json=true` is invalid for `scripts/mailbox.mjs`; the valid form is `--json true`. `docs/task-map-envelope.md` was corrected.

## Pi 1.7.0 compatibility

Authoritative release: https://github.com/earendil-works/pi/releases/tag/v1.7.0

Recorded changes: removed install telemetry APIs and `PI_TELEMETRY`; added OSC 7577 program resume, `--agent-dir <dir>`, resume flag preservation, image generation options and model/provider default changes.

Local runtime at verification time: `pi --version` = `1.6.0`. `pi --help` contains `--session`, `--session-id` and `--session-dir`, but no `--agent-dir`. Therefore Pi 1.7.0 runtime behavior is NOT VERIFIED locally. Ticket #114 owns the compatibility matrix.

Search for the removed telemetry names found only historical research text in an unrelated worktree, not active `pi-herdr-orchestration` code.
