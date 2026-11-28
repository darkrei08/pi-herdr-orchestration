# Windows matrix

`scripts/windows-matrix.mjs` is the local, read-only planning contract for the Windows host test matrix. It validates an explicit target and renders a deterministic plan. It never opens SSH, spawns a process, contacts a network or changes files.

The live matrix belongs to issue #113 and requires host, user, explicit scope, backup/snapshot target and approval before execution.

## Modes

- `plan`: default.
- `dry-run`: renders the same nine checks without execution.

Any other mode, `execute: true`, or `command: "execute"` fails locally.

## Target input

```json
{
  "mode": "plan",
  "target": {
    "host": "DESKTOP-05FH7VP",
    "user": "Ema-pc",
    "scope": "full-ssh+full-suite",
    "backup": "/tmp/windows-backup-snapshot",
    "approval": "operator approval"
  }
}
```

The scope must contain both `full-ssh` and `full-suite`. Destructive requests require a backup or snapshot target. Missing gates block all rows.

## Planned checks

- `herdr-app-version`
- `os`
- `session-inventory`
- `workspace-tab-pane`
- `ui`
- `screenshots`
- `connectivity`
- `full-ssh`
- `full-suite`

Statuses are `PASS`, `BLOCKED`, `FAIL` and `NOT RUN`. A valid local plan deterministically reports `not-run=9` with `network=0`, `ssh=0`, `spawn=0`, `changes=0` and `execution=0`.

## Commands

```bash
npm run taskmap:windows -- --input /tmp/windows-target.json --output /tmp/windows-plan.txt
node scripts/windows-matrix.mjs --help
```

Success prints the input path, output path and status counts. Invalid targets exit non-zero with a fail-closed report.

## Scope boundary

This command proves the contract, not the live host. Actual Herdr App version, OS, session, workspace/tab/pane, UI, screenshot, connectivity and destructive checks require the explicit target from #113.
