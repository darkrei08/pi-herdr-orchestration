# Agent startup and GGA source patterns

## Startup ownership

A Pi session must load exactly one Herdr workflow extension. The repository-owned source is
`npm:@piewf/herdr`; a second local fork extension registering the same
`fullyInspectable` agent setup hook prevents the TUI from reaching `READY`.

The repository marker `.pi/workflow-owner.json` selects
`pi-herdr-orchestrator` as the workflow owner, so `workflow-intent` does not inject a
second directive.

## Live extension resolution

The npm-backed workflow registry needs `typebox` and
`@earendil-works/pi-coding-agent` resolvable from `/root/.pi/agent/npm`. Missing peers
make `capability-preflight.mjs` fail extension loading before the first turn.

`model-preflight` is advisory: stale or unavailable evidence produces one warning and
the session continues without failover. A blocked group with `selected: null` is valid
producer output.

## GGA source patterns

The effective Guardian Angel configuration is `/root/.config/gga/config`, not the inert
`.gga.local` file. Its `FILE_PATTERNS` must include `*.mjs` and `*.cjs` so MJS-only
commits are reviewed in worktrees that do not carry a project-local `.gga`.

## Verification

```bash
npm run check:strict
npm run lint
npm test
python3 /tmp/pi-startup-smoke.py
grep -n '^FILE_PATTERNS' /root/.config/gga/config
```
