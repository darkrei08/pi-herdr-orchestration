# Master, chiefs and Pi sessions

Use a team model only when the host actually supports multiple Pi sessions, roles or PiWorkflow subagents. The hierarchy is:

```text
[MASTER] Pi Repository Orchestrator
            │
            ├── [CHIEF/SCOUT] discovery and triage
            ├── [CHIEF/BUILD] implementation and integration
            ├── [CHIEF/QUALITY] tests, grilling and review
            ├── [CHIEF/MEMORY] Gentle hydration and persistence
            └── [CHIEF/AUDIT] final audit
                         │
                         └── [I#…] / [PR#…] / [F] / [REV#…] sessions
```

## Responsibility chain

The master owns repository scope, task graph, priority, dependency order, conflict resolution, placement on the stable or development branch, integration, cleanup and the final stop decision. A chief owns a bounded department and may coordinate several related tasks. An implementation, review or audit session owns only its task contract.

The communication path is explicit:

```text
master directive → chief assignment → named task session
task evidence → chief report → master decision → next directive
```

Every report must identify the task, session/tab, branch, worktree, checks, result, risks, memory state and next action. A child cannot promote its own work, close a related Issue or discard a worktree merely because its local task is finished.

Use the compact envelope in [state-protocol.md](state-protocol.md) for these reports. The chief forwards a `chief_report`; the master returns a `decision`. This keeps communication machine-readable and avoids injecting transcripts into every parent session.

## Tab registry

Keep a small registry in the master context or an authorized workflow artifact:

| Tab | Role | Task | Branch | Worktree | Status |
| --- | --- | --- | --- | --- | --- |
| `[MASTER]` | control plane | repository | default/control | root or control worktree | active |
| `[CHIEF/BUILD]` | department chief | implementation queue | control | chief worktree | active |
| `[I#42]` | implementation | Config loading | `fix/42-config-loading` | `.worktrees/issue-42-config-loading` | working |

Rename each tab immediately after creation. Keep the ordering stable and understandable; close a child tab only after its session memory, report and master decision have been recorded.

## Capability fallback

If PiWorkflow or Pi cannot create a real child session, preserve the hierarchy in one session with clearly labeled role sections and reports. Do not simulate concurrent execution, pretend that tabs were closed, or report a chief handoff that did not occur. The protocol describes coordination; the available tools determine which parts can be executed.
