# Rust graph planning core

`rust/orchestrator-core` is an optional, dependency-free Rust implementation of the graph supervisor's deterministic `waits-for` planning step.

## Why this seam

The graph supervisor already has a versioned state model and pure dependency planning. That logic is independent of Pi, Herdr, Node extension hooks, and filesystem locking, so it can be implemented and tested in Rust without replacing the JavaScript runtime boundary.

Rust is intentionally not used for:

- Pi or PiWorkflow extension loading;
- Herdr pane/session transport;
- mailbox process/liveness integration;
- filesystem locking and evidence persistence.

Those paths depend on JavaScript host APIs or platform-specific process behavior and have no repository evidence of a performance bottleneck.

## Local interface

The bridge accepts the graph supervisor JSON state on stdin and emits a JSON plan:

```bash
npm run graph:plan:rust < graph.json
```

The output has three arrays:

```json
{"ready":["task-b"],"blocked":[],"pending":["task-c"]}
```

The Rust helper is an optional verifier/accelerator. JavaScript remains the authoritative runtime and public contract. If Cargo is unavailable, normal Pi orchestration continues unchanged.

## Verification

```bash
cargo test --manifest-path rust/orchestrator-core/Cargo.toml
npm run graph:plan:rust < fixture.json
```

No external Rust crates are required. The bridge uses the repository's existing JSON state format and translates it into a bounded line protocol for the Rust core.
