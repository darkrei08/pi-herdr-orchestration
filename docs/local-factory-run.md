# Local factory run

One repeatable procedure that walks a ticket from dispatch readiness to final repository verification on the local host, and reports every gate separately.

```bash
npm run factory
npm run factory -- --json
```

Both forms are read-only. The runner spawns existing repository commands, writes nothing, and never pushes, merges, opens a pull request, edits host configuration, or removes anything outside OS temp artifacts created by the commands it runs.

## Gate order

| # | Gate | Exact command | Deterministic evidence |
| --- | --- | --- | --- |
| 1 | `capability-preflight` | `node scripts/check.mjs --strict` | Required capabilities and compaction owner are installed |
| 2 | `roster` | `node scripts/agent-roster-diagnostic.mjs` | Read-only host roster diagnostic; `FAIL` means the Agent definitions are malformed or unavailable |
| 3 | `fanout` | `npm run test:fanout` | Bounded retry, timeout classification and side-effect blocking resolve deterministically |
| 4 | `isolated-commit` | `npm run test:fixture` | A local-only candidate commit with no remote |
| 5 | `diff-check` | `git diff --check` | No whitespace errors in the working tree |
| 6 | `lint` | `npm run lint` | Repository source linter |
| 7 | `repo-tests` | `npm test` | Full unit suite |

## Status meanings

- `PASS`: the command exited 0.
- `FAIL`: the command exited non-zero; the first non-empty stderr/stdout line is recorded as detail.
- `BLOCKED`: the command could not be executed at all, for example a missing executable or a spawn error.
- `NOT RUN`: the gate was deliberately not executed by the runner. Live Herdr pane fan-out and live PiWorkflow agent dispatch are always `NOT RUN`; the runner never launches sessions.

The run exits non-zero only for `FAIL` or `BLOCKED`, and the JSON report (`schema: pi-herdr-orchestration/local-factory-report-v1`) carries `summary` counts plus `ok`.

Gate 2 is the only gate that reflects host state rather than repository state: it reports whether the installed Agent definitions form a usable roster. Gates 3, 4 and 7 are the repository's own deterministic tests, so their outcome is identical on any host with Node and Git.

## Artifacts and cleanup

The runner creates no worktree, pane, mailbox record, or background process, and reports `artifacts: []`. Gates 3 and 4 build their own repositories under the OS temp directory and remove them in a `finally` block. After a run:

```bash
git worktree list --porcelain
node scripts/mailbox.mjs status --run <run-id>
```

Neither may list a path or record created by the factory run. A pane list taken before and after the run must be identical, because the runner starts no session.

## What remains live

A green local factory run proves the deterministic gates, not a live dispatch. Record the live evidence separately, with the run id, pane, tab and session identity returned by Herdr and PiWorkflow, or state explicitly that live dispatch was `NOT RUN`.

## Report template

```text
Gates: capability-preflight PASS, roster PASS, fanout PASS, isolated-commit PASS,
diff-check PASS, lint PASS, repo-tests PASS
Live: live-fanout NOT RUN, live-dispatch NOT RUN
Artifacts: none (git worktree list and mailbox status unchanged)
Unverified: <live dispatch, hosted CI, release publication>
```
