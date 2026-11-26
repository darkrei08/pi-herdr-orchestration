# PR-following workflow

Deterministic end-to-end follow of exactly one issue or pull request: validated
target, developer/reviewer cycles, verbatim external-bot findings, zero-agent
waiting, and a merge authorization that pauses the run until the master replies.
Implemented in [`workflows/pr-follow.mjs`](../workflows/pr-follow.mjs).

## Registration

The workflow uses the repository's existing PiWorkflow registration path and no
parallel registry:

- `package.json` lists `./workflows/pr-follow.mjs` under `pi.extensions`.
- The module's default export resolves `pi-extensible-workflows/registry` twice,
  matching `extensions/workflow-autostart.mjs`: first with `import.meta.resolve`,
  then with `createRequire` rooted at `~/.pi/agent/npm/package.json`. The second
  candidate is what makes registration work in the installed host layout, where
  PiWorkflow lives under `~/.pi/agent/npm/node_modules` and a repository checkout
  sees no copy in its own `node_modules`.
- It refuses to register when the registry is already frozen, and calls
  `registerWorkflowExtension` with one function, `prFollow`.
- A PiWorkflow script calls it as a global: `await prFollow({ target: "pr", id: 27 })`.

Registration is a no-op when `pi-extensible-workflows` is installed in neither
layout, matching `extensions/capability-preflight.mjs`.

## Function contract

Input (validated at the JSON boundary, `additionalProperties: false`):

| Field | Type | Meaning |
| --- | --- | --- |
| `target` | `"issue"` or `"pr"` | Kind of record the id names. |
| `id` | positive integer | Issue or pull-request number. |
| `merge` | `"human"` (default) or `"auto"` | `human` asks the master before the merge step; `auto` pre-authorizes it. |

Output: `{ status, reason, task, cycle, question_id }`, where `status` is one of
`REJECTED`, `BLOCKED`, `PAUSED`, `COMPLETED`. `task` is `I#<id>` or `PR#<id>`,
the mailbox task identity.

## Phases and reason codes

Every transition emits `orch_report` with the mailbox state, the derived
lifecycle, the phase, and `name=STATUS` checks, so `orch_status` shows the
current phase at any time. Unknown or mismatched targets are rejected before any
agent is launched.

| Phase | Agent | Reason codes | Checks written |
| --- | --- | --- | --- |
| `VALIDATE` | no | `ID_INVALID`, `ID_KIND_MISMATCH`, `ID_NOT_FOUND` | `id=PASS|FAIL` |
| `DEVELOP` | developer | - | `cycle_<n>_dev=NOT RUN|PASS` |
| `REVIEW` | reviewer | - | `cycle_<n>_review=NOT RUN|PASS|FAIL` |
| `BOT_REVIEW` | no | `BOT_REVIEW_PENDING`, `POLL_BOUND_EXCEEDED` | `bot_review=NOT RUN|PASS|FAIL|BLOCKED` |
| `CI` | no | `CI_PENDING`, `CI_FAILED`, `POLL_BOUND_EXCEEDED` | `ci=NOT RUN|PASS|FAIL|BLOCKED` |
| `APPROVAL` | no | `APPROVAL_PENDING`, `DECISION_REQUIRED`, `POLL_BOUND_EXCEEDED` | `approval=NOT RUN|PASS|BLOCKED` |
| `MERGE` | no | `MERGE_PENDING`, `MERGE_BLOCKED`, `DECISION_REQUIRED`, `POLL_BOUND_EXCEEDED` | `merge=NOT RUN|PASS|FAIL|BLOCKED` |
| cycle cap | - | `REVIEW_LOOP_CAP` | `bot_review=BLOCKED` |

`ID_INVALID` for a malformed id is raised as a `TypeError` before the function
writes any mailbox record; `ID_KIND_MISMATCH` and `ID_NOT_FOUND` are reported as
`FAILED` with `id=FAIL` and returned as `status: "REJECTED"`.

## Zero-cost waiting

`BOT_REVIEW`, `CI`, `APPROVAL` and `MERGE` only read GitHub state through `gh`
and emit a report per attempt. No agent is launched while waiting.

- Interval: `POLL_INTERVAL_MS` = 60000 ms (1 minute).
- Bound: `MAX_POLL_ATTEMPTS` = 30 attempts, so one phase gives up after 30
  minutes with `POLL_BOUND_EXCEEDED`.
- Each attempt reports `<REASON>: poll <n>/30 every 60s, no agent launched` and
  keeps the phase check at `NOT RUN` until it settles.

## Findings loop and cap

After the internal developer/reviewer cycles pass, the external bot findings are
read verbatim and handed to the next developer cycle unchanged. A finding is the
`body` of every review whose author is a Bot: the reviews are read through
`gh api repos/{owner}/{repo}/pulls/<n>/reviews`, whose `user.type` of `Bot`
identifies a Bot actor even when its login has no `[bot]` suffix, and a
`[bot]`-suffixed login is still accepted. Human reviews are never forwarded.
`BOT_REVIEW` waits until at least one review exists, so a pull request nobody has
reviewed yet keeps polling. `MAX_DEV_CYCLES`
= 3 cycles in total: the initial cycle plus two finding-driven reworks. A fourth
cycle request reports `REVIEW_LOOP_CAP` as `BLOCKED` and returns
`status: "BLOCKED"` with `cycle: 4`; the workflow never starts it.

## Pause and resume

With `merge: "human"` (default) the workflow asks for merge authorization once
CI, review and mergeability are clean:

1. `orch_ask` records the question with the deterministic id
   `ask:<task>:merge`, the task reports `BLOCKED`, and the function returns
   `status: "PAUSED"` with that `question_id`.
2. While the question is unanswered, re-entry re-reports `BLOCKED` and does not
   ask again.
3. `orch_reply` on that `question_id` persists the answer in the mailbox.
4. The next `prFollow` call reads the answer from `last_reply`, records
   `merge=PASS`, and returns `status: "COMPLETED"`.

Progress is persisted per target in
`<git-common-dir>/orchestrator/<run>/pr-follow/<task>.json`, so completed steps
(`validate`, `dev-<n>`, `review-<n>`, `bot-<n>`, `ci`, `approval`, `mergeability`,
`decision`) are skipped on resume: no developer or reviewer agent is relaunched
and no phase is polled again.

## Dry-run test

```bash
node --test workflows/pr-follow.test.mjs
# or: npm run test:pr-follow
```

The test injects the GitHub port, the agent launcher, the sleep function and the
storage directory, and uses the real mailbox for reports and the ask/reply pair.
It proves id validation without launches, zero-agent polling with the bounded
interval, verbatim findings with the loop cap, and pause/resume that repeats no
completed work, plus the two adapter edges: a Bot author without a `[bot]` login
is kept while a human review is dropped, and registration still resolves the
registry through the `~/.pi/agent/npm` fallback when the checkout has no local
`node_modules` copy. Nothing in the suite touches GitHub, Herdr, or a model.

## Non-goals

The workflow does not replace native code review, does not merge without the
master's policy decision, and does not change the mailbox schema. Merging and
closing stay with the master.
