# Compact state protocol

Use one small, versioned state envelope for communication between the master, chiefs and task sessions. PiWorkflow should pass the envelope as a workflow return value or tool result; Herdr can display the same envelope in a pane or status view. Do not pass full transcripts between sessions.

## Format selection

Choose the representation by boundary rather than using one format everywhere:

| Boundary | Preferred format | Reason |
| --- | --- | --- |
| Agent/tool result and workflow state | Strict JSON Schema | Deterministic validation, enums, required fields and machine routing |
| MCP tool result | `structuredContent` JSON plus a short text fallback | Native structured result with schema validation and resource references |
| Repeated homogeneous rows in an LLM prompt | TOON, encoded from canonical JSON | Lower token cost for uniform arrays; convert back to JSON before validation |
| Append-only event or audit stream | JSONL | One independently parseable event per line and easy replay |
| Long mixed prompt for a model that benefits from delimiters | XML tags around instructions, context and examples | Boundary markers; XML is not the result schema |
| Human handoff or review | Markdown generated from the envelope | Readable rendering without becoming a second source of truth |

Use JSON as the canonical durable representation even when TOON or XML is used at a prompt boundary. TOON is a useful optimization for regular tabular data, but its own project describes it as an evolving format and recommends JSON for deeply nested or irregular data. XML tags improve prompt separation for Claude-style prompts; they do not provide schema-constrained output. Binary encodings such as CBOR or MessagePack belong between trusted programs, not in an LLM prompt.

## Canonical envelope

```json
{
  "v": "repo-orchestrator/v1",
  "kind": "result",
  "id": "r_20260927_001",
  "parent": "chief-build-01",
  "run": "repo-run-42",
  "sender": {"role": "implementer", "session": "pi-i42", "tab": "[I#42] Config loading", "worktree": ".worktrees/issue-42-config-loading"},
  "task": {"id": "I#42", "type": "issue", "goal": "Fix config loading"},
  "state": "READY",
  "branch": "fix/42-config-loading",
  "summary": "Config precedence now follows repository rules.",
  "checks": [{"name": "unit", "status": "PASS", "ref": "test-run-884"}],
  "decisions": ["Keep environment values ahead of defaults."],
  "risks": [],
  "blockers": [],
  "memory": {"status": "persisted", "ref": "engram:repo-run-42:i42"},
  "next": "chief-review"
}
```

Required fields are `v`, `kind`, `id`, `parent`, `sender`, `task`, `state`, `summary`, `checks`, `memory` and `next`. Add fields only when they carry decision value. Use stable IDs and references instead of embedding logs, diffs or transcript text. Allowed states include `WORKING`, `READY`, `DEVELOPMENT`, `BLOCKED`, `FAILED` and `CLOSED`; checks use `PASS`, `FAIL`, `BLOCKED` or `NOT RUN`.

## Message directions

| Message | From → to | Purpose |
| --- | --- | --- |
| `directive` | master → chief/session | task, scope, acceptance criteria, constraints |
| `progress` | session → chief | compact progress and current blocker |
| `result` | session → chief | checks, branch state, memory reference and recommendation |
| `chief_report` | chief → master | normalized results from one department |
| `decision` | master → chief/session | integrate, continue development, retry, escalate or stop |
| `handoff` | any → successor | exact resume point and durable memory reference |

The chief may summarize several child results, but must preserve child IDs and evidence references. The master consumes `chief_report`, reconciles it with current Git and CI, then emits a `decision`. A Markdown report can be rendered from the JSON for people; it is not a second source of truth.

## Token and reliability rules

- Keep `summary`, `decisions`, `risks` and `next` short and factual.
- Put long logs, diffs and test output in files or CI artifacts and reference them by ID/path.
- Never copy a child transcript into the master prompt.
- Validate the envelope before accepting it; malformed or missing evidence is `BLOCKED`, not `READY`.
- Make messages idempotent using `id` and `run`; duplicate delivery must not create a second merge or close a task twice.
- Treat Git, CI and verified files as authoritative when a message conflicts with current state.
- Use controlled redundancy: repeat only the identity anchors (`run`, `task.id`, `sender.session`, `branch`, `worktree`, `state`, `next`) in every hop. Keep the full payload in one canonical record and pass references plus a digest (`sha256`) instead of duplicating logs or prose.
- Include a `schema` or protocol version, monotonic `seq` per parent, `created_at`, and `expires_at` when messages can be delayed or replayed. Reject stale or out-of-order decisions unless the master explicitly reconciles them.

## PiWorkflow and Herdr mapping

In PiWorkflow, return the envelope from an agent/workflow step and feed only the compact object to the next step. Use `parallel` for independent chiefs or review tasks, `pipeline` for ordered phases, `withWorktree` for isolated implementation, and a persistent agent handle when a chief must continue across turns. In Herdr, use one workspace per repository, one master pane, chief panes grouped by department and child panes named after their task. Multiple panes may observe or coordinate inside a worktree; only one writer may modify a given worktree at a time. Give every implementation a dedicated linked worktree.

For OpenAI Structured Outputs or equivalent strict tool schemas, request the envelope directly as a schema-constrained object. For providers without schema-constrained generation, require one JSON object delimited by a unique marker, parse it, validate it, and retry once with the validation error; never pass unvalidated prose upstream as a successful result. MCP tools should expose an `outputSchema` and return `structuredContent`; the short serialized JSON fallback exists for clients that do not yet consume structured results.

Do not confuse a Herdr pane with a Pi session. Herdr owns and restores terminal layout; Pi owns conversation/session state; PiWorkflow owns task orchestration; Gentle/Engram owns durable project knowledge. The envelope is the narrow contract between these layers.
