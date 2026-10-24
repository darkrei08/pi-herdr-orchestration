# Durable hierarchical supervisor loop

The orchestrator uses a durable Master -> Chief -> Worker loop. PiWorkflow owns deterministic execution and checkpoints, Herdr owns panes and liveness, the mailbox owns durable reports, and Engram stores memory. A pane label is presentation only and never grants authority.

## Directive lifecycle

Each directive is stored under `<git-common-dir>/orchestrator/<run>/directives/<assignment_id>.json` and carries:

- `parent`, `supervisor`, and `worker` identity anchors;
- task, branch, worktree, and narrow `allowed_paths`;
- dependencies and bounded retry budget;
- a SHA-256 `directive_digest`;
- monotonic `sequence`, worker state, parent decision, and parent receipt.

The lifecycle is:

```text
ASSIGNED -> ACKNOWLEDGED -> WORKING -> READY -> ACCEPTED -> CLOSED
                         \-> BLOCKED / FAILED -> REASSIGNED
```

A worker may acknowledge and report only as the exact assigned worker. A parent may decide only for its own child directive. A directive is not closed when the worker says `READY`; it closes only after the parent accepts the matching result and writes a parent receipt.

## Supervision cycle

`runSupervisorLoop` is bounded and resumable. It never owns an unbounded timer or busy-polls:

1. load directives, mailbox reports, Herdr liveness, and Git evidence;
2. produce a deterministic plan;
3. apply only the plan actions through injected adapters;
4. await an external wakeup or checkpoint;
5. repeat for the configured cycle budget.

The planner fails closed for identity drift, missing agents, stale reports after bounded nudges, failed checks, dirty or mismatched Git evidence, and blocked worker questions. It never answers a worker question automatically and never closes work without a parent receipt.

## Native Pi controls

The extension exposes:

- `orch_assign`
- `orch_directive_ack`
- `orch_directive_state`
- `orch_directive_decide`
- `orch_directive_reassign`
- `orch_directive_receipt`
- `orch_supervise`

`orch_supervise` returns a plan only. Workflow code or the Master applies decisions through the directive tools after reconciling the evidence.

## Delivery boundary

Workers may implement, test, review, and prepare local candidates. The Master emits the final delivery report and asks for the human decision before commit, push, PR, merge, issue creation, or deploy. No directive operation grants remote delivery authority.
