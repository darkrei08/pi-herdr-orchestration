---
name: dev-flow
description: Select one development route and execute the repository's ordered Chart, Spec, Implement, Verify, Review, Deliver and Close phases without combining competing SDD pipelines.
---

# Development Flow

Use this skill when a task needs an implementation flow rather than a single command.

## Route selection

Select exactly one route before implementation:

- **Matt ticket pipeline**: `triage` -> `to-spec` -> `to-tickets` -> `implement` -> `tdd` -> `code-review` -> `work-unit-commits`.
- **Engineering-excellence SDD**: `engineering-excellence` owns the SDD shape, then `tdd` -> `code-review` -> `work-unit-commits`.
- **Gentle SDD**: `gentle-ai` owns the SDD and review authority, then `tdd` -> `code-review` -> `work-unit-commits`.

These are alternatives. Never run two spec-to-code pipelines for one task. Capability-check every selected skill and skip unavailable optional skills rather than pretending they ran.

## Ordered phases

Run the phases in `scripts/flow-phases.json` order: Chart, Spec, Implement, Verify, Review, Deliver, Close. Each phase consumes the previous handoff and must produce the handoff named in the glossary. Practices in the glossary are operating rules, not skills to load.

Use `npm run flow:glossary` to rescan the installed roots. Use `npm run flow:glossary -- --write` only when the machine-maintained inventory should be regenerated. Use `npm run flow:sources:check` to validate the declared source pool.

## Guardrails

- Keep one owner per concern: one route, one review mechanism, one memory store.
- Use the smallest sufficient skill set for the selected route.
- Record commands and outputs as evidence.
- State every skipped or unverified item in the handoff.
