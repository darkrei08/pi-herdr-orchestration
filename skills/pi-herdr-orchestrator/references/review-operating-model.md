# Review operating model

Use this reference when orchestrating agent-written changes across repositories. It adapts the evidence-backed review pattern described in Anthropic's *How the Claude Code team does code review* without assuming a specific provider, CI service, merge queue, feature-flag system, or telemetry backend.

## Layered path

The master owns the ordered path and records each layer as `PASS`, `FAIL`, `BLOCKED`, or `NOT RUN`:

1. **Before PR**: the task owner runs the relevant checks and a fresh-context verifier inspects the diff against the requirement.
2. **Required checks**: each affected repository runs its lint, types, tests, build, packaging, platform, and security checks.
3. **Independent review**: bug correctness, security, and operational risks are separate findings when their owners or evidence differ. Findings include file/line evidence, severity, causality, and disposition.
4. **Risk decision**: classify from changed paths and behavior. Low-risk changes may follow automated evidence; medium-risk changes need one human; high-risk or protected paths need the required human owners. Agent output never fills a human approval slot.
5. **Integration check**: re-run checks against the current integration target or merge queue when available. If unavailable, say so; a branch-local pass is not merge-queue evidence.
6. **Recovery**: document feature flags, staged rollout, monitoring, revert, or rollback when the change can affect users. If no recovery mechanism exists, record the residual risk.

The master does not advance a repository because a different repository passed. Cross-repository contracts and compatibility evidence are explicit dependencies.

## Convergence and bounded retries

- Verify reviewer findings before forwarding them as blockers; discard style-only noise unless repository policy makes it blocking.
- Require a fix or written disposition for each actionable finding.
- Cap repeated fix/review rounds at three. After the cap, stop and ask the owner to reconsider the approach.
- After the initial passes, re-review only the new diff and do not repeat already-resolved findings.
- Bind approval to the exact commit or candidate. Any unverified commit invalidates that approval.
- A worker model failure is nonterminal, but unchanged replay is not progress: inspect assignment, filesystem effects, and mailbox state before deciding whether to retry.

## Human attention and evaluator feedback

When the repository can measure them, record human approvals, comments, wait time, review rounds, revert rate, and incident rate. Do not invent values. Use revert and incident rates as safety guardrails for reducing human review.

Turn confirmed incidents, reverts, and harmful false positives into expert-checked evaluator cases. When a reviewer prompt, tool set, model, or policy changes, run the relevant corpus before accepting the change. Record whether the evaluator improved recall, noise, or convergence; if no evaluator or metric exists, report `NOT RUN`/`UNVERIFIED` and keep the stricter path.

## Ownership and handoff

The person directing an agent remains accountable for the outcome. Every repository handoff includes `Testing`, `Risk`, `How to revert`, exact local commit(s), remote delivery state, cross-repository dependencies, and open blockers. Small commits and reversible operations reduce blast radius; they do not transfer responsibility to the agent.
