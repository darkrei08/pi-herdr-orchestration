# Guardian Angel quality gate

`Gentleman-Programming/gentleman-guardian-angel` (GGA) is an optional review gate, not the master orchestrator. It is provider-agnostic, runs from Git hooks or CI and checks staged/PR changes against the repository's `AGENTS.md` and `.gga` configuration.

## Responsibility boundary

```text
repository-orchestrator → scope, master/chief routing, branch and worktree decisions
PiWorkflow/Pi.dev       → scheduling, sessions and tool execution
Engineering Excellence  → specification, TDD, security, performance and accessibility gates
GGA                     → provider-agnostic commit/PR review gate
Gentle/Engram           → durable decisions and verified project memory
Herdr                   → panes, terminals and workspace layout
```

Use GGA after a task session has produced a candidate result and before the chief reports `READY`. In CI, use the repository's configured GGA mode and treat a failed review as `BLOCKED`, not as a successful result. GGA's cache is useful for token and latency control: invalidate it when the file content, `AGENTS.md` or `.gga` changes; never use a cached `PASSED` result for a different content hash.

Recommended sequence:

1. Run tests, build and security checks.
2. Run `gga run` on the staged or PR diff.
3. Record the review result, GGA version, configuration hash and reviewed file hashes in `checks`.
4. Let the chief normalize the evidence and let the master decide stable integration or development branch.
5. Persist the decision and review references before closing the Pi session and tab.

Do not put provider credentials, OAuth tokens or full review transcripts in the state envelope or durable memory. Store long output as a CI/file artifact and pass its path and digest.

