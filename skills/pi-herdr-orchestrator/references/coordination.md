# Master, chiefs and Pi sessions

Use a team model only when the host actually supports multiple Pi sessions, roles or PiWorkflow subagents. The hierarchy is:

```text
[MASTER] Pi Herdr Orchestrator
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
task evidence (orch_report / orch_evidence) → chief report → master decision → next directive
worker question (orch_ask) ↔ master answer (orch_reply)
```

Every report must identify the task, session/pane, branch, worktree, checks, result, risks, memory state and next action. A child cannot promote its own work, close a related Issue or discard a worktree merely because its local task is finished.

## Authority semantics and presentation boundaries

Aligned with upstream Herdsman (`boadij/pi-herdsman`) supervision semantics:

- **Presentation-only pane and agent labels:** Role-derived Herdr pane and agent labels (`Lead`, `Managed Lead`, `Manager`, `Chief`) are presentation only. They never grant authority, supersede assignment checks, or prove task ownership.
- **Manager/Chief boundaries on destructive operations:** Chiefs coordinate and normalize reports within their bounded department; they never perform destructive worktree operations (such as branch deletion, worktree pruning, or force resets) without explicit confirmation from the Master control plane.
- **Workflow evidence vs. terminal coordination:** Generic workflow evidence is stored durably as content-addressed records in the mailbox (`repo-orchestrator/v1` envelope and `ref:sha256:...` evidence files). Terminal coordination (Herdr panes, prompts, and the current tab) is ephemeral presentation and execution transport only. Pane liveness does not prove work completion.

A chief supervises its children with the loop in [supervision.md](supervision.md) and forwards only flagged or closed tasks. Use the compact envelope in [state-protocol.md](state-protocol.md) for these reports. The chief forwards a `chief_report`; the master returns a `decision`. This keeps communication machine-readable and avoids injecting transcripts into every parent session. In PiWorkflow environments, `orch_ask` and `orch_reply` seamlessly bridge asynchronous Herdr workers with workflow script checkpoints.

## Pane registry

Keep a small registry in the master context or an authorized workflow artifact:

| Pane | Role | Task | Branch | Worktree | Status |
| --- | --- | --- | --- | --- | --- |
| `[MASTER]` | control plane | repository | default/control | root or control worktree | active |
| `[CHIEF/BUILD]` | department chief | implementation queue | control | chief worktree | active |
| `[I#42]` | implementation | Config loading | `fix/42-config-loading` | `.worktrees/issue-42-config-loading` | working |

Keep tab and agent labels stable, numbered in dispatch order and understandable; close a child tab only after its session memory, report and master decision have been recorded. One named workflow run owns one Herdr workspace whose tabs are created in admission order, one tab per agent. Create a new workspace or cwd only on explicit user request.

PiWorkflow and `@piewf/herdr` provide the runtime implementation for workflow-owned tabs. The trusted project setting created by `init-repository.mjs` enables fully inspectable mode, so each agent gets its own workspace tab in admission order; a runtime that instead reports a sibling pane or local session transport keeps that identity and makes no ordering claim. Keep the `parallel` object keys and labels stable for deterministic launch order, but never treat a label, its number or a tab position as authority. A manual global setting is not required for initialized repositories.

## Unavailable upstream capabilities

Upstream Herdsman v0.55.0 exposes model-facing coordination tools and a federated peer transport that this repository does not implement. Do not cite, call or simulate them:

- **Role-specific messaging tools.** `notify_owner`, `await_owner`, `reply_agent`, `message_staff`, `message_manager` and `message_chief` do not exist here. The only channel is the mailbox (`scripts/mailbox.mjs report|ask|reply|status`, `orch_report`/`orch_ask`/`orch_reply`) plus an opaque `herdr agent prompt` wake-up nudge that carries no structured contract.
- **Manager project operations.** `delegate_work`, `resume_work`, `stop_lead`, `remove_worktree` and `integrate_branch` are not implemented. Branch based assignment, resume and integration remain master decisions executed through Git and explicit operator authorization; worktree removal stays manually confirmed.
- **Federated peer messaging.** There is no peer discovery, no cross-machine initiation or reply transport and no durable remote reply channel. Two orchestrator runs coordinate only through the local mailbox directory shared under `<git-common-dir>/orchestrator/<run>/`.
- **Upstream terminal projections.** Upstream `settling` and `lost` assignment states have no local equivalent: a lost or unreadable terminal liveness state is reported as `DECIDE`/`unverified` and requires master reconciliation against the mailbox and Git.

## Roster diagnosis

Before delegating, validate the roster the current host exposes. [`scripts/agent-roster-diagnostic.mjs`](../../../scripts/agent-roster-diagnostic.mjs) is read-only and injectable: `inspectAgentRoster({ definitions, errors })` validates names (including duplicate shadowing), `tools` arrays and delegation fields (`mode`, `thinking`), and `readAgentRoster({ root, readdir, readFile })` adds the filesystem without writing to it. A `healthy` roster reports `usable` and its `usableAgents`; `malformed` and `unavailable` report `blocked` with the exact definition path, field and error, an empty `usableAgents`, and no delegation. Pass a definition the host rejected as an `errors` entry to preserve the path `list_agents` reported, and never replace a blocked roster with a filename guess or a simulated delegation. `npm run test:roster` covers the healthy, malformed and unavailable states.

## Capability fallback

If PiWorkflow or Pi cannot create a real child session, preserve the hierarchy in one session with clearly labeled role sections and reports. When the host forbids nested subagents (for example the Gentle AI harness), the master dispatches task sessions directly and chiefs stay report roles. Do not simulate concurrent execution, pretend that panes were closed, or report a chief handoff that did not occur. The protocol describes coordination; the available tools determine which parts can be executed.
