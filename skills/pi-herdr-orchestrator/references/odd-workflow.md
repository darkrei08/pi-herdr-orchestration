# Organic-Driven Development (ODD) Orchestration

Organic-Driven Development (ODD) is the primary development workflow of this orchestrator. Rather than imposing monolithic upfront plans, ODD operates adaptively: explore existing code, clarify real ambiguities, right-size the task, track large work with verbatim specifications, and implement incrementally using test-first discipline and reviewable slices.

## The 7-Step ODD Lifecycle

```text
1. Authorize ➔ 2. Explore ➔ 3. Resolve Uncertainty ➔ 4. Classify ➔ 5. Track ➔ 6. Implement ➔ 7. Close
```

| Step | Phase | Key Action |
| --- | --- | --- |
| 1 | **Authorize** | Investigation, review, and proposals stay read-only. Clarify ambiguous intent once; stop and wait. Hedged delivery wording asks for resumable notes and separate commits, not a stop. |
| 2 | **Explore** | Explore existing code, interfaces, and call paths first, proportionately to the request, within an evidence budget before writing code. |
| 3 | **Resolve Uncertainty** | Recommend optional research only for named uncertainties; ask one focused question only for open product decisions; run at most one scoped assumption challenge for high-consequence premises. |
| 4 | **Classify** | Size the task: **Small** (understood, contained risk, resumable from diff) ➔ inline, no feature document or ceremony; **Large** (multi-session, external waits, deliverables separated) ➔ tracked ODD path. |
| 5 | **Track** | For large work, automatically create `odd/tasks/<feature>.md` and its Engram mirror `odd/<feature>/tasks` before the first write. Sync the visible `todo` list. |
| 6 | **Implement** | Test-first development by default (RED ➔ GREEN ➔ REFACTOR). Bounded subagents receive tasks by reference (`Spec: odd/tasks/<feature>.md, T#, S#`) and report covered `S#`. Prepare reviewable slices of ≤ ~400 authored lines; commit only when explicitly authorized by the operator. |
| 7 | **Close** | Verify observable criteria for every `S#` across public interfaces. Report verified outcomes, skipped checks, and next actions. |

## Feature Document Structure (`odd/tasks/<feature>.md`)

For large tasks, the feature document acts as the immutable specification contract:
1. **Header**: 2-3 lines specifying owner, status, and target scope.
2. **`## Specs`**: Numbered `S#` requirements quoting the operator's exact strings, error messages, and examples verbatim. Never summarized or paraphrased.
3. **`## Tasks`**: One line per task with ID (`T#`), linked `S#`, execution route, and resulting commit hash or pending status.
4. **`## Log`**: Chronological event log. `L1` records the original request verbatim; subsequent entries append user corrections, evidence, and architectural decisions.

## Herdr Multi-Agent Mapping

Within Herdr terminal workspaces, ODD coordinates master, chief, and worker sessions:

- **Caller-Tab Topology**: Workflow sub-agents are spawned as sibling or child panes within the caller's active tab, avoiding window clutter and orphan workspaces.
- **Handoff by Reference**: The master passes tasks by reference (`odd/tasks/<feature>.md, T#, S#`). Workers read the document up to `## Log` and report covered `S#` without duplicating prompt text.
- **Mailbox Envelope**: Workers report progress via `scripts/mailbox.mjs report` or native tool `orch_report`. Large test traces, build outputs, and multi-file diffs are offloaded to disk via `storeEvidence` (`orch_evidence`) as full SHA-256 references (`ref:sha256:...`).
- **Supervision & Liveness**: The master observes worker panes via `orch_status`, which joins mailbox state with live Herdr agent status. Unknown liveness fails closed to `DECIDE`.
- **Reviewable Work Units**: Changes are organized into reviewable slices of ~400 authored changed lines, keeping tests and documentation alongside the behavior. Commits occur only upon explicit operator authorization. Slices are assessed with `gentle_review` `assess` (`committedOnly: true`); discrete slices remain under context budgets (`reviewDue: false`) and pass Guardian Angel validation.
