# Isolated execution

Define problem, acceptance criteria, root cause if applicable, affected files, risks, dependencies and checks before coding. Reuse an existing valid task worktree. For substantial independent work keep task → branch → worktree → session traceable, following project conventions. Example: `fix/42-config-loading`, `.worktrees/issue-42-config-loading`, `[I#42] Config loading`.

CodeGraph indexes are worktree-local: a worktree without its own `.codegraph` falls back to another checkout, so cross-worktree results are suspect for symbol truth. Index a working worktree once with `codegraph init -i`; do not index an ephemeral test worktree. The initializer never runs CodeGraph or installs sqz project hooks unless the caller explicitly passes `--codegraph` or `--sqz`.

## Branch, commit and publication

One branch and one worktree per independent task; never edit the default branch directly. Follow repository naming, else `fix/<scope>`, `feat/<scope>`, `refactor/<scope>`, `test/<scope>`, `docs/<scope>`. While work is unstable, preserve logical checkpoints locally when authorized and do not push intermediate commits. Publish (push, PR) only when the unit is coherent and verified, and only with authorization. Squash or reorder only when it improves reviewability without destroying useful history.

## Worker rules

1. Understand the task and its allowed scope; inspect the relevant existing code.
2. Reproduce the bug or record current behavior; define validation before substantial implementation.
3. Implement the smallest coherent solution. No unrelated refactors or cleanup.
4. Preserve public contracts unless explicitly authorized; a refactor needs behavior-preservation tests.
5. Update tests, and documentation when behavior changes.
6. Run the relevant validation, inspect your own diff, and hand off with evidence. Lifecycle: [dispatch.md](dispatch.md).
7. Treat a terminal Pi execution failure as a failed result, not a completed assignment. Preserve the exact session and assignment, inspect possible external effects, and continue only through the existing authorized path. Never replay tools or automatically create a second writer. After a provider or workflow package update, restart Pi before treating a model-preflight failure as a transport fault, because the running process still holds the previous modules and provider registry.
8. Report through the mailbox (`scripts/mailbox.mjs report`) at every phase change, at least every 10 minutes, immediately when blocked, and as the last action with all checks. Silence is a defect. See [supervision.md](supervision.md).

## Bounded research phases

Read-only scouts and researchers stay bounded only when each phase carries a contract the child cannot widen:

| Field | Contract |
| --- | --- |
| Scope | One question per phase, plus explicit allowed paths/globs and the exact resolved tool names the phase may use |
| Budget | A cap on tool calls and a phase deadline shorter than the run deadline; a phase that hits either cap returns what it has |
| Terminal result | A compact report: answer, evidence references, files read, tools used, and what is unverified. Never a transcript |
| Memory | Engram or Gentle calls pass an explicit `project` and cwd, or are omitted in a read-only scout, to avoid `project_transition_conflict` |

Report each phase result through the mailbox as it lands, so a later timeout loses one phase instead of the whole investigation. A scout that browses and synthesizes indefinitely turns a bounded deadline into a missing terminal report for every sibling that waited on it; classify that outcome with the envelope in [supervision.md](supervision.md).

## Master and chiefs

When Pi and PiWorkflow support multiple sessions, keep one master session named `[MASTER] Pi Herdr Orchestrator`. It is the source of repository-level decisions. It may assign bounded coordination areas to chiefs, for example:

- `[CHIEF/SCOUT] Discovery and triage`
- `[CHIEF/BUILD] Implementation and integration`
- `[CHIEF/QUALITY] Tests, grilling and review`
- `[CHIEF/MEMORY] Gentle hydration, handoff and persistence`
- `[CHIEF/AUDIT] Final repository audit`

A chief may dispatch issue, PR or feature sessions, but it must return a concise report to the master. Child sessions do not issue competing repository-wide directives. The master decides priorities, conflict order, `main` versus development placement, retries, escalation and termination. If the host cannot create chiefs, model the same chain with named roles or a structured report; do not claim parallel sessions that do not exist.

## Ordered tabs and session startup

Open a task session only after the master or responsible chief has identified the task, checked dependencies and selected the branch/worktree. Every workflow agent launches into the workflow's Herdr workspace as its own tab, created in `parallel`/`pipeline` admission order and titled with a stable, numbered label such as `#1 [I#42] Config loading`, `#2 [PR#18] Parser fix`, `#3 [F] Schema validation`, `#4 [REV#42] Config review` or `#5 [AUDIT] Final repository Audit`. Set the task worktree as that tab's working directory and keep the master tab visible. Verify the returned transport identity before claiming an ordered tab; a label, its number or a tab position is never authority.

For PiWorkflow dispatch, invoke a non-empty named workflow with `foreground: true` and no budget, and use direct `agent(...)` or `agent.create(...)` calls inside a named `parallel(...)` or `pipeline(...)` operation. Every call carries a `pi-ext-roles` `role`, a `label` numbered by dispatch position, `extensions: ["builtin:codemode", "builtin:tool-search", "builtin:mcp"]`, and must omit timeoutMs entirely; omitted or null installs no timer in Vekexasia's runner. `builtin:codemode` is the stable bridge to MCP tools. Native `subagents_run` is forbidden for orchestration. The trusted `.pi/pi-extensible-workflows/settings.json` created by repository initialization sets `extensionSettings.herdr.enableFullyInspectableMode` to `true`, so workflow agents launch as ordered numbered tabs instead of staying local. Do not manually create duplicate tabs, and do not infer a tab from a label. Herdr unavailable means the child keeps its session and worktree while the tab transport is `NOT APPLICABLE`. If PiWorkflow is genuinely unavailable, use the direct fallback and report that workflow transport was `NOT APPLICABLE`; do not use that fallback merely because a child timed out.

Do not let two implementers use the same working directory. Do not create a tab for a trivial edit. A child session must send its completion or handoff report to its chief; the chief normalizes it and forwards it to the master.

Give each implementation session its own directory. Sequence dependent tasks. Parallelize only with host permission and little overlap in files, API and schema. Avoid worktrees/panes for trivial edits.

A session returns task/status, branch/worktree/session, commits/files, check outcomes, review findings, decisions/risks, memory changes, `READY`/`NOT READY`/`BLOCKED`, and next action. The controller independently judges readiness. Triage unrelated findings before expanding scope.

## Child-session closure and return to master

Do not close a child session as soon as its code appears to work. The chief must first require the child to:

1. finish the relevant tests, verification and review;
2. classify the result as stable, development, experimental or blocked;
3. persist durable development knowledge and the exact handoff through Gentle/Engram when available;
4. commit or preserve uncommitted work with its branch and worktree recorded;
5. return the session report to the chief;
6. let the chief forward the normalized report and recommendation to `[MASTER] Pi Herdr Orchestrator`;
7. receive the master's decision about integration, follow-up, retry or block;
8. close the Pi session and then close its pane only after the memory and report are confirmed.

The master remains open until all child reports are reconciled. Closing a pane must never be the mechanism used to discard uncommitted work or unpersisted context.
