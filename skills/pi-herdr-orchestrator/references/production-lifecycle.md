# Production lifecycle

One ordered pipeline from change to production delivery. Read it only when a change reaches beta, staging, production, or a live runtime claim. The standards themselves stay in Engineering Excellence; this reference binds them into a single evidence-carrying sequence and defines the boundary between the three planes.

## Authority boundary

- **PiWorkflow is the only execution scheduler.** It owns child-agent lifetime, waits for every child result in a foreground run, and returns the normalized `workflow_result` to its parent. A completed foreground `workflow`, `workflow_retry` or `workflow_resume` resolves with the full value, so the parent waits on the result, not on a pane title, a terminal snapshot or a timer.
- **Pi Herdr Orchestration is the Master Chief control plane.** It owns the task graph, routing, reservation, approval gates, promotion decision, rollback decision and evidence audit. It never implements inside the master session and never delegates scheduling to a second engine.
- **Herdr tabs and panes are inspectable transport and presentation only.** They make a running child observable to the operator. They are not a scheduler, they do not prove completion, and they never replace mailbox, Git or artifact evidence. Do not manually create duplicate panes for a workflow-owned child.

If PiWorkflow is unavailable, use the documented single-session fallback and report workflow transport as `NOT APPLICABLE`. Never present a pane, a reload or a ready-looking terminal as a completed stage.

## Required stage order

Every implementation, commit and live delivery passes through these stages in this order. A stage cannot start until the previous stage has a non-red evidence result.

| # | Stage | Exit evidence | Owner |
| --- | --- | --- | --- |
| 1 | Chart / Spec | Bounded scope, acceptance criteria, affected paths, forbidden paths, exact verification commands | Master Chief |
| 2 | Isolated worktree implementation | Task branch, dedicated worktree, one writer, minimal diff | Workflow child |
| 3 | Local audit and diff review | Self-reviewed diff, no unrelated changes, no secrets, requirements traced to lines | Workflow child |
| 4 | Fast checks: tests, lint, typecheck | Focused test output, lint and typecheck exit codes with counts | Workflow child |
| 5 | Commit the work unit | Conventional Commit, code plus tests plus docs in one unit, clean `git status` | Workflow child |
| 6 | CI, matrix and security gates | Required CI, claimed-platform matrix rows, dependency and secret scanning, exact run IDs | CI provider |
| 7 | Artifact identity and provenance | Immutable version, commit SHA, artifact digest, SBOM and attestation/provenance reference | Release pipeline |
| 8 | Fresh runtime smoke | A fresh temporary session/worktree launches the exact candidate and records runtime proof | Master Chief + fresh child |
| 9 | Beta / staging gate | The promoted candidate passes the pre-production smoke, health and observability checks | Staging gate |
| 10 | Production approval gate | Named human approval bound to the candidate digest and the green gate set | Operator |
| 11 | Post-deploy smoke, health and observability | Deployed-artifact smoke, liveness/readiness, error rate, latency and log evidence | Production gate |
| 12 | Rollback decision | Rollback or continue, with the previous digest and irreversible migrations named | Master Chief + operator |
| 13 | Close with evidence | Evidence envelope, check statuses, approvals, release notes, retained resources | Master Chief |

A red stage stops the pipeline. Do not start stage `n+1` because stage `n` is "probably fine", because a previous run was green, or because the operator is waiting.

## Non-negotiable rules

### Immutable promotion

Build once, then promote the same artifact. The candidate tested in CI, tested in a fresh runtime and deployed to beta is deployed to production by the same immutable digest, with no rebuild between environments. A tag such as `latest` is a human convenience, never a deployment input. Rollback deploys the previous digest; it does not rebuild the previous tag.

### Fresh-runtime candidate identity

The runtime smoke uses a fresh temporary PiWorkflow/Herdr session in a separate worktree, launches the exact candidate, and records the identity it observed:

- the same commit SHA that passed stages 4-6;
- the same artifact digest and version produced in stage 7;
- the same configuration and environment contract promoted in stage 9.

A different build, a stale checkout, or a reloaded existing session is not runtime evidence. No reload claim is accepted without a fresh runtime proof: if the operator had to reload a session for the change to apply, the runtime was not verified. Report the fresh session, worktree and observed candidate identity.

### Explicit results

Report `PASS`, `FAIL`, `BLOCKED` or `NOT RUN` for every stage. `NOT RUN` is never treated as passing, and `BLOCKED` names the exact missing capability or command. A stage with no captured evidence is `NOT RUN`, not `PASS`.

### No delivery from a red gate

Never deliver to beta, staging or production from a red gate, a skipped matrix row, a missing approval or an unverified candidate. If a required gate cannot run, the pipeline is `BLOCKED`; the fix is to restore the gate, not to downgrade the claim.

### Separate proof from promotion

The fresh runtime smoke proves the candidate works in a live runtime. It does not authorize production delivery; stage 10 requires explicit human approval bound to the same candidate. The Master Chief collects the evidence and recommends; the operator approves.

## Evidence envelope

Return one compact record with the result. Markdown is a rendering of this record, never the source of truth.

```json
{
  "v": "pi-herdr-orchestration/production-lifecycle/v1",
  "candidate": {
    "commit": "<full-sha>",
    "version": "<immutable-version>",
    "artifactDigest": "<sha256:...>",
    "provenance": "<attestation-ref>"
  },
  "stages": [
    { "id": "chart-spec", "status": "PASS", "evidence": "ref:sha256:<...>" },
    { "id": "fresh-runtime-smoke", "status": "PASS", "evidence": "ref:sha256:<...>" }
  ],
  "runtime": {
    "session": "<fresh-session-id>",
    "worktree": "<fresh-worktree>",
    "candidateMatch": true,
    "result": "PASS"
  },
  "approvals": {
    "beta": "<approver-or-gate>",
    "production": "<named-human>"
  },
  "rollback": {
    "decision": "continue",
    "previousDigest": "<sha256:...>"
  }
}
```

Use `candidateMatch: false` plus `BLOCKED` when the runtime observed a different commit or digest. Use `previousDigest: null` and an explicit note when no previous artifact exists, for example a first release.

## Delegated standards

Do not duplicate these rules here. They are the authoritative Engineering Excellence references, and this pipeline only orders them:

| Concern | Reference |
| --- | --- |
| Gate tiers, thresholds and no-bypass rule | Engineering Excellence `references/quality-gates.md` |
| Test pyramid, determinism and assertion quality | Engineering Excellence `references/testing.md` |
| Health probes, observability, zero-downtime and rollback | Engineering Excellence `references/production-readiness.md` |
| Build once, pinned digests, provenance, publish and deploy gates | Engineering Excellence `references/ci-cd-and-publishing.md` |
| Commit units, branches, PR evidence and "what was NOT run" | Engineering Excellence `references/git-and-pull-requests.md` |
| Development, preview, staging and production parity | Engineering Excellence `references/environments.md` |

## Applying it to this repository

For a documentation or contract change that never deploys, stages 7-11 are `NOT APPLICABLE` with a one-line reason; stages 1-6 and 12-13 still apply. For a change that alters runtime behavior, the full pipeline applies. The Master Chief records which stages were applicable, and `NOT RUN` never stands in for a required stage.

## Sources

- GitHub Docs, [Deployment environments](https://docs.github.com/en/actions/concepts/workflows-and-actions/deployment-environments): environment protection rules, required reviewers and environment-scoped approvals for the production gate.
- GitHub Docs, [Concurrency](https://docs.github.com/en/actions/concepts/workflows-and-actions/concurrency): one in-flight deployment per environment and cancellation of superseded runs without cancelling a deploying run.
- GitHub Docs, [Artifact attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations): provenance that ties the promoted artifact to the commit and the pipeline run.
- DORA, [Deployment automation](https://dora.dev/capabilities/deployment-automation/): repeatable, low-risk delivery as a capability, and the reason the pipeline is automated rather than remembered.
- Google Cloud, [Canary deployment strategy](https://docs.cloud.google.com/deploy/docs/deployment-strategies/canary): staged traffic promotion with health checks and a rollback trigger.
- [Pi Extensible Workflows](https://github.com/vekexasia/pi-extensible-workflows) and its [changelog](https://github.com/vekexasia/pi-extensible-workflows/blob/main/CHANGELOG.md): `workflow_result` as the child result contract (5.8.0), Herdr lifecycle state aligned with workflow transitions (5.11.1), and completed foreground runs resolving with the full value through `outputSchema`/`structuredContent` (5.19.0).
