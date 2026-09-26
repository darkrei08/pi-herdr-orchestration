# Project memory and continuity

Use the installed Gentle/Engram interface if available. Hydrate only decisions, constraints, previous attempts and conventions relevant to this task. Compare remembered status against Git, PRs, remote branches and CI.

Persist durable rationale, verified root causes and solutions, conventions, limitations and links to Issue/PR/commit. Do not store secrets, raw logs, ephemeral errors or Git-reconstructible facts. Handoff: task, goal, status, branch, worktree, Pi session/tab, chief, commits, touched files, checks, decisions, risks, blockers and one exact next action.

Before a child Pi session or tab closes, save its development memory and handoff first. Record whether the work is stable enough for the stable branch or must remain on development, what the chief decided, and what the master still needs to decide. The chief then forwards the normalized memory summary to `[MASTER] Pi Repository Orchestrator`. If persistence fails, keep the session open or write an authorized handoff artifact and report the failure; never close the session while its only useful context exists in the live transcript.

On another machine install the environment, clone the repository, restore accessible memory, rediscover tools, reconcile with Git, then resume. If persistent memory is unavailable, use an authorized project handoff and report its location; never pretend memory was saved.
