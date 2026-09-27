# Wizard-AI compatibility

Wizard-AI is a provider-agnostic setup and context-engineering layer. When it is present, integrate its capabilities by discovery instead of treating its README claims as guarantees.

## Detected components

The `darkrei08/Wizard-AI` repository currently documents and packages:

- `pi-extensible-workflows`: JavaScript workflow execution with YAML role/routing metadata, parallel fan-out, checkpoints and worktree helpers;
- five numbered loops: plan/spec, develop/TDD, debug/verify, refactor/token squeezing, release/memory sync;
- `wz-ai-context` and `wz-ai-context-formats.js`: TOON conversion, LEA evidence aliases, Markdown tables, compression and token estimates;
- `sqz`, `RTK`, `headroom` and optional `LLMLingua`: CLI/context reduction;
- `Serena` and `graphify`: semantic code navigation and architecture graphing;
- `MarkItDown`, `repodocs` and wiki tooling: source-oriented context extraction;
- `LiteLLM` and the Cockpit proxy: provider routing and quota rotation for Pi;
- `Engram`, vector stores and knowledge-graph tools: optional durable/project memory;
- an indexed skill registry spanning Pi, Claude, Gemini, Codex and other agents.

## Integration contract

Keep responsibilities separate:

```text
Wizard-AI discovery/compression → prepares evidence
PiWorkflow/vekexasia            → schedules and gates work
Pi / pi.dev                     → executes sessions and tools
Engineering Excellence          → supplies engineering quality methods
Gentle/gentle-pi + Engram       → hydrates and persists durable knowledge
Herdr                           → owns panes, workspaces and runtime layout
Guardian Angel (GGA)            → runs provider-agnostic commit/PR quality review
repository-orchestrator         → defines the master/chief/task protocol
```

At bootstrap, detect `WIZARD_AI_DIR`, `wz-ai`, `wizard-ai`, `wizard-ai-context`, `@darkrei08/wizard-ai-cli`, the Wizard-AI venv imports, installed Pi extensions, the active compaction owner (`pi-codex-context` under Vekexasia's dotenv model, Pi VCC only as an existing conflict, or Pi core), and the actual `pi-extensible-workflows` version. Use the installed documentation, package exports and active Pi settings as the source of truth. The same orchestration contract must work with Pi.dev even when Wizard-AI's Cockpit proxy is absent; provider routing is an optional infrastructure capability, not a workflow dependency. If Wizard-AI is missing and the user asks for setup, use `npx --no-cache -y @darkrei08/wizard-ai-cli@latest setup --verbose`. Wizard-AI manages TOON/LEA, graphifyy and LLMLingua; do not invent a standalone LEA installer. The explicit dependency bootstrap also covers Gentle AI/Engram, GGA and Herdr; `skills add` only installs skill files and must be followed by `bootstrap-dependencies.mjs --apply` for mutations.

## Recommended flow

1. Query `Serena`, `graphify`, the project wiki or RAG layer to locate relevant code and decisions.
2. Filter command output through `RTK` or `sqz`; rank or prune evidence with the installed tool that fits the task.
3. Build the canonical state envelope from [state-protocol.md](state-protocol.md).
4. Encode regular evidence arrays as TOON for model input, or LEA when the main saving comes from repeated source and evidence labels. Keep canonical JSON for validation and storage.
5. Send only the compact result to the next PiWorkflow stage. Keep logs, diffs, raw test output and graph artifacts behind file/CI references.
6. Let `pi-codex-context` own transcript compaction under the Vekexasia dotenv model; never install `@sting8k/pi-vcc`. Use TOON/LEA/sqz only for bounded evidence and handoff preparation.
7. Let Gentle/Engram persist only durable decisions and verified facts after the master accepts the result.
8. Run GGA on the staged/PR diff before the chief reports `READY`; retain only its status, version, config digest and artifact reference in the envelope.
9. Do not enable Wizard-AI memory, workflow, proxy, or provider-routing components when Gentle/Engram/PiWorkflow already provide the same responsibility. If Wizard-AI remains present but graphify or LLMLingua is missing, use `uv tool install --force 'graphifyy[all]'` and `uv pip install --python <Wizard-AI-venv-python> llmlingua`; do not guess another package.

## Claims and compatibility limits

Treat README percentages such as `78% fewer tokens`, `94% context reduction` or `5x faster` as project benchmarks to reproduce, not universal properties. `estimateTokens()` in the current Wizard-AI utility is a character heuristic, not a model tokenizer. TOON is best for uniform arrays and is still evolving; LEA is a project-specific convention. JSON Schema validation must happen after any TOON/LEA round trip.

Pin or record the actual versions. The Wizard-AI package and PiWorkflow documentation can drift independently. If a workflow primitive, role, command or file path is missing, downgrade gracefully and report `BLOCKED` or `NOT APPLICABLE`; never infer compatibility from a repository name.

Never place OAuth refresh tokens, account databases, proxy credentials or model API keys in a state envelope, Markdown handoff or Gentle memory. The Cockpit proxy may alter Pi `auth.json` and `models.json`; inspect and back up configuration before enabling it, and keep secrets outside Git.
