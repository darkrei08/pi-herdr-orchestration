# Development flow

This repository separates the development flow into seven chronological phases. The machine contract is [`scripts/flow-phases.json`](../scripts/flow-phases.json); this page explains how to use it.

## Choose one route

Choose the smallest route that fits the task before loading phase skills:

- **Matt ticket pipeline** for issue-first work or work that needs a spec and ticket graph: `triage`, `to-spec`, `to-tickets`, `implement`, `tdd`, `code-review`, `work-unit-commits`.
- **Engineering-excellence SDD** when Engineering Excellence owns the design cycle: `engineering-excellence`, `tdd`, `code-review`, `work-unit-commits`.
- **Gentle SDD** when Gentle owns the SDD and review authority: `gentle-ai`, `tdd`, `code-review`, `work-unit-commits`.

These routes are alternatives, not a checklist. A task uses one spec-to-code pipeline. Shared skills such as `tdd`, `code-review`, and `work-unit-commits` may appear in each route, but Matt ticket pipeline, Engineering-excellence SDD, and Gentle SDD must not be run together as competing owners.

## The phases

### Chart

Choose the route and bound the decision. Load `ask-matt`, `find-skills`, `grill-me`, `grill-with-docs`, `triage`, `wayfinder`, or the other chart skills only when their trigger fits. The phase consumes the request, repository instructions, Git state, and capability report; it hands on one decision ticket or implementation brief.

Practice: a decision ticket names the decision it closes, never a slice of work to execute.

### Spec

Name the observable behavior, seams, constraints, and acceptance evidence. Matt's route uses `to-spec` and `to-tickets`; Engineering-excellence SDD uses `engineering-excellence`; Gentle SDD uses `gentle-ai`. Supporting skills include `codebase-design`, `domain-modeling`, `research`, `project-memory`, and `writing-for-agents`.

Practice: the seams are named before any code exists, and the highest existing seam wins.

### Implement

Make the smallest change at the highest existing seam. The route owners are `implement` for Matt, `engineering-excellence` for Engineering Excellence SDD, and `gentle-ai` for Gentle SDD; `tdd` is shared. UI and language-specific skills are optional phase skills, selected only when the change needs them.

Practice: one observed red per rule; an existing behaviour that shares the changed code gets one test proving it still holds.

### Verify

Run focused checks and any claimed platform checks. Use `container-test-matrix`, `browseros-neo`, `lightpanda`, `security-audit`, `herdr`, or other verification skills only when the target requires them. The result is recorded commands and outputs.

Practice: the evidence is a recorded command and its output, not a green suite alone; a platform claim is run on that platform.

### Review

Review the exact candidate against its spec and repository standards with `code-review`. Use `diagnosing-bugs`, `judgment-day`, `rdd-defect-workflow`, or architecture review skills only when the risk calls for them.

Practice: a finding carries its file and line, and a pre-existing issue is a follow-up, never a blocker dressed as the candidate's fault.

### Deliver

Package one coherent work unit. `work-unit-commits` is shared by all routes; `branch-pr`, `chained-pr`, `pr`, `handoff`, and `claude-handoff` are selected by the delivery target.

Practice: one work unit per commit, tests and docs with the behaviour.

### Close

Use `retro` and `project-memory` when the work produced a decision, fix, convention, or durable discovery. `show-me`, `wait-what`, and `writing-for-agents` are optional communication aids.

Practice: every skipped or unverified item is stated, because an unmentioned gap is a false claim of completeness.

## Universal, conditional, and out of scope

A phase carries three different things and they must not be read as one list.

- **Universal skills** apply whenever the phase runs, whatever the change touches.
- **Conditional skills** apply only when their condition holds. The Implement phase names nine user-interface skills under `only when the change touches a user interface`: loading them for a database migration is noise, and noise is what makes a session ignore the list.
- **Out of development** lists skills that are installed but have no place in a development phase, each with its reason. Four skills sit there for toolchain reasons: three are TypeScript-only and this product contains zero TypeScript files, so a JavaScript repository loading one of them follows an instruction written for another language, and the fourth, `scaffold-exercises`, builds teaching exercise trees rather than product code.

The generator reports which of the three a skill falls into, so a session can tell "not in the flow" from "in the flow but not for this change".

## Combinations that work

- One route plus shared `tdd`, `code-review`, and `work-unit-commits`.
- Any route plus task-specific verification, UI, security, platform, or documentation skills.
- Matt ticket pipeline plus `container-test-matrix` when the ticket changes a script or packaging path.
- Engineering-excellence SDD or Gentle SDD plus `judgment-day` only when an independent dual review is explicitly warranted.

## Combinations that conflict

- Matt ticket pipeline plus Engineering-excellence SDD or Gentle SDD as simultaneous spec owners.
- Engineering-excellence SDD plus Gentle SDD as simultaneous SDD owners.
- Two review owners for the same candidate, unless the task explicitly requests a dual review.
- Treating practices such as "no speculative feature" or "record evidence" as skills to load.
- Loading every installed skill because it exists; business, marketing, finance, media, and SMB skills are listed out of development in the glossary.

## Copy-paste start prompt

```text
Use the repository development flow in scripts/flow-phases.json.

1. Read AGENTS.md and inspect Git state.
2. Run the capability check and select exactly one route:
   - Matt ticket pipeline: triage -> to-spec -> to-tickets -> implement.
   - Engineering-excellence SDD: engineering-excellence owns the SDD.
   - Gentle SDD: gentle-ai owns the SDD.
3. State the selected route and why the alternatives do not apply.
4. Run Chart, Spec, Implement, Verify, Review, Deliver, and Close in order.
5. Load only skills present in the capability report and needed by the selected route.
6. Follow the phase practices. Test observable behavior, avoid speculative work, record commands and outputs, and state skipped or unverified items.
7. Return the phase handoffs, verification evidence, review disposition, and final commit or handoff.
```

## Source pool and refresh boundary

The declared source pool is [`odd/skill-sources/sources.json`](../odd/skill-sources/sources.json). It is user-editable and checked with `npm run flow:sources:check`; a future sync may propose candidates but must not silently rewrite the glossary. The glossary generator only rescans installed local roots and reports changes.

## Verified source landscape

These are the fixed comparison points checked against the GitHub API today:

| Source | Stars | Licence |
| --- | ---: | --- |
| `mattpocock/skills` | 311002 | MIT |
| `obra/superpowers` | 311646 | MIT |
| `github/spec-kit` | 146332 | MIT |
| `vercel-labs/skills` | 37910 | MIT |
| `PatrickJS/awesome-cursorrules` | 41092 | CC0-1.0 |
| `Gentleman-Programming/gentle-ai` | 8193 | MIT |

Popularity is evidence of use, not a substitute for relevance, compatibility, maintenance, licence, overlap, cost, and risk.
