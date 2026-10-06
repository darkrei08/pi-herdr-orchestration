# Isolated execution

Define problem, acceptance criteria, root cause if applicable, affected files, risks, dependencies and checks before coding. Reuse an existing valid task worktree. For substantial independent work keep task → branch → worktree → session traceable, following project conventions. Example: `fix/42-config-loading`, `.worktrees/issue-42-config-loading`, `[I#42] Config loading`.

## Branch, commit and publication

One branch and one worktree per independent task; never edit the default branch directly. Follow repository naming, else `fix/<scope>`, `feat/<scope>`, `refactor/<scope>`, `test/<scope>`, `docs/<scope>`. While work is unstable, commit locally as logical checkpoints and do not push intermediate commits. Publish (push, PR) only when the unit is coherent and verified, and only with authorization. Squash or reorder only when it improves reviewability without destroying useful history.

## Worker rules

1. Understand the task and its allowed scope; inspect the relevant existing code.
2. Reproduce the bug or record current behavior; define validation before substantial implementation.
3. Implement the smallest coherent solution. No unrelated refactors or cleanup.
4. Preserve public contracts unless explicitly authorized; a refactor needs behavior-preservation tests.
5. Update tests, and documentation when behavior changes.
6. Run the relevant validation, inspect your own diff, and hand off with evidence. Lifecycle: [dispatch.md](dispatch.md).

## Master and chiefs

When Pi and PiWorkflow support multiple sessions, keep one master session named `[MASTER] Pi Herdr Orchestrator`. It is the source of repository-level decisions. It may assign bounded coordination areas to chiefs, for example:

- `[CHIEF/SCOUT] Discovery and triage`
- `[CHIEF/BUILD] Implementation and integration`
- `[CHIEF/QUALITY] Tests, grilling and review`
- `[CHIEF/MEMORY] Gentle hydration, handoff and persistence`
- `[CHIEF/AUDIT] Final repository audit`

A chief may dispatch issue, PR or feature sessions, but it must return a concise report to the master. Child sessions do not issue competing repository-wide directives. The master decides priorities, conflict order, `main` versus development placement, retries, escalation and termination. If the host cannot create chiefs, model the same chain with named roles or a structured report; do not claim parallel sessions that do not exist.

## Ordered tabs and session startup

Open a task session only after the master or responsible chief has identified the task, checked dependencies and selected the branch/worktree. Rename the Pi tab immediately, before implementation, using a stable label such as `[I#42] Config loading`, `[PR#18] Parser fix`, `[F] Schema validation`, `[REV#42] Config review` or `[AUDIT] Final repository Audit`. Set the task worktree as that session's working directory. Keep the master tab visible and the child tabs ordered by chief, task type and identifier so the relationship is obvious at a glance.

Do not let two implementers use the same working directory. Do not create a tab for a trivial edit. A child session must send its completion or handoff report to its chief; the chief normalizes it and forwards it to the master.

Give each implementation session its own directory. Sequence dependent tasks. Parallelize only with host permission and little overlap in files, API and schema. Avoid worktrees/tabs for trivial edits.

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
8. close the Pi session and then close or archive its Pi tab only after the memory and report are confirmed.

The master remains open until all child reports are reconciled. Closing a tab must never be the mechanism used to discard uncommitted work or unpersisted context.
