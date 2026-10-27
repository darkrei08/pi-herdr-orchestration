# Canonical execution graph report

`execution-graph.mjs` is a read-only compatibility adapter for two existing sources:

- PiWorkflow trajectory/runtime snapshots (`trajectory`, `runtime`, publisher state, or run records).
- Orchestrator mailbox report entries (`mailbox` or `reports`).

PiWorkflow remains the execution owner. The mailbox remains the durable supervisory evidence store. The adapter does not schedule work, resolve roles, register sessions, write evidence, or mutate either source.

## Versioned contract

`buildExecutionGraph(input)` returns `repo-orchestrator/execution-graph/v1`:

```json
{
  "schema": "repo-orchestrator/execution-graph/v1",
  "version": 1,
  "readOnly": true,
  "generatedAt": "2026-10-27T20:00:00.000Z",
  "nodes": [],
  "edges": [],
  "events": []
}
```

Nodes use the canonical kinds `master`, `chief`, `workflow`, `subworkflow`, and `worker`. Workflow and worker nodes are derived only from supplied trajectory data. Master and chief nodes are included only when explicit supervisory metadata is supplied. Labels, agent names, and mailbox task identifiers are presentation and correlation data; they never grant authority.

Trajectory runs become `workflow` nodes, or `subworkflow` nodes when the source includes `parentRunId`. Trajectory agents and published subagents become `worker` nodes. Existing `parentId`, `parentRunId`, retry provenance, explicit dependency fields, worktree, repository, session and lifecycle fields are preserved as metadata or edges rather than reimplemented as runtime state.

Mailbox entries enrich a matching trajectory worker by agent name, label, session ID, or task. If no trajectory worker matches, the entry becomes a mailbox-only worker node. Evidence is referenced, not copied: `evidence_ref` values, checks, commit identifiers and artifact paths are retained under `node.evidence`.

Edges are explicit and read-only: `parent`, `retry_of`, `depends_on`, and `reports`. Unknown relationships are omitted rather than inferred from labels. Events are copied from supplied trajectory events and mailbox reports, then bounded to the most recent `maxEvents` entries (default 256).

`buildExecutionReport(input)` wraps the graph as `repo-orchestrator/execution-report/v1` and adds node state counts. `serializeExecutionReport(report)` emits machine-readable JSON. The `orch_execution_graph` Pi tool exposes the same projection for a caller that already has the public trajectory snapshot and mailbox evidence.

## Example

```js
const report = buildExecutionReport({
  trajectory: publisherState,
  mailbox: mailboxEntries,
  master: { id: "master-1", label: "[MASTER]" },
  chiefs: [{ id: "chief-1", label: "[CHIEF/BUILD]", parentId: "master-1" }],
  maxEvents: 128,
});
```

The report is suitable for JSON consumers and future read-only renderers. A renderer must consume this snapshot and must not call execution or mailbox mutation APIs implicitly.
