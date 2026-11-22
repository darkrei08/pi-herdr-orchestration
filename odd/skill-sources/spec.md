# Spec: the skill flow, its best practices, and a source pool

Type: spec
Status: draft
Scope: pi-herdr-orchestration

## Problem Statement

A session that opens this repository has 139 skills installed and no reliable way to know which ones apply, in what order, and which of them consume another's output. The knowledge exists in each SKILL.md, but the sequence does not exist anywhere: it lives in whatever the operator remembers to say, so the quality of an implementation depends on the prompt rather than on the harness. Worse, the catalogue rots silently: a skill is renamed, a better collection appears upstream, and nothing in the repository notices.

There is also no place for the operator to say "these are the sources I trust and want swept". Today a deep search starts from whatever the model thinks of, which is neither reproducible nor reviewable.

## Solution

Three artefacts, each with one job.

1. **A phase glossary with best practices.** A machine-maintained data file lists development phases in chronological order; each phase carries its skills, which are mandatory and which optional, what it consumes, what it must hand to the next phase, the failure it prevents, and the **practices** that apply while the phase runs. Practices are the rules that are true regardless of which skill is loaded: a test asserts the observable effect and not the internal call; no speculative feature; a refusal names the cause and the next action; a change touching shared options runs one differential check. A practice is not a skill and must not be modelled as one.

2. **A user-editable source pool.** A committed file where the operator lists the places to sweep: skill collections, repositories, registries, sites, and the local skill roots, each with what to look for there, how much to trust it, and how often it should be revisited. It is the primary-source list for any refresh, so a sweep is reproducible and its omissions are visible. The analogy the operator named is a price-tracking proxy that keeps declared reference sources and syncs them; the mechanism here is the same shape, with a human approving the diff.

3. **A sync that proposes, never applies.** A mechanical pass fetches what each enabled source declares and writes a candidate report: new skills, removed skills, changed descriptions, upstream collections we do not have. A judgement pass classifies candidates into phases and writes a proposal. Nothing changes the glossary without an explicit approval step, because a catalogue that rewrites itself is a catalogue nobody can trust.

## The source pool file

Committed, reviewable, versioned with the repository.

```json
{
  "schema": "pi-herdr-orchestration/skill-sources/v1",
  "updated": "2026-11-03",
  "sources": [
    {
      "id": "matt-pocock-skills",
      "kind": "github",
      "url": "https://github.com/<owner>/<repo>",
      "ref": "main",
      "paths": ["skills/*/SKILL.md", "commands/*.md"],
      "look_for": "engineering flows: charting, specs, tickets, implementation, review",
      "trust": "primary",
      "cadence": "monthly",
      "enabled": true,
      "last_checked": null,
      "notes": "the collection this repository's flow is modelled on"
    },
    {
      "id": "installed-local",
      "kind": "local",
      "url": "file:///root/.agents/skills",
      "look_for": "what is actually installed on this machine",
      "trust": "primary",
      "cadence": "on demand",
      "enabled": true,
      "last_checked": null,
      "notes": "scanned by the glossary generator itself, listed here so the inventory has one source of truth"
    }
  ]
}
```

Rules the file obeys: `kind` is one of `local`, `github`, `site`, `registry`. `trust` is one of `primary`, `secondary`, `unsure`, and an `unsure` source never promotes a skill into the glossary without the operator saying so. `last_checked` is written only by the sync, never by hand. Disabling a source is the supported way to drop it: deleting the row loses the reason it was there.

## Commands

| Command | Deterministic | What it does |
|---|---|---|
| `npm run flow:glossary` | yes | rescans local skill roots, reports vanished, new and unclassified skills, and phases that lost their mandatory skills; `--write` regenerates the machine-maintained data |
| `npm run flow:sources:check` | yes | validates the pool file against the schema, reports stale sources past their cadence, and fails on an unknown `kind` or `trust` value |
| `npm run flow:sources:sync` | fetches, writes a report | walks every enabled source, produces the candidate list with provenance, and never edits the glossary |
| `npm run flow:research` | no | the deep pass: uses the pool as primary sources plus open search, then writes a proposal a human approves |

## Best practices per phase

Each phase in the data carries a `practices` array. The initial set, taken from what this project already enforces rather than invented:

- **Chart** — a decision ticket names the decision it closes, never a slice of work to execute.
- **Spec** — the seams are named before any code exists, and the highest existing seam wins.
- **Implement** — one observed red per rule; an existing behaviour that shares the changed code gets one test proving it still holds.
- **Verify** — the evidence is a recorded command and its output, not a green suite alone; a platform claim is run on that platform.
- **Review** — a finding carries its file and line, and a pre-existing issue is a follow-up, never a blocker dressed as the candidate's fault.
- **Deliver** — one work unit per commit, tests and docs with the behaviour.
- **Close** — every skipped or unverified item is stated, because an unmentioned gap is a false claim of completeness.

## Acceptance Criteria

- `npm run flow:glossary` reports, on the current machine, the 139 installed skills, naming any it cannot classify.
- `flow:sources:check` fails on a malformed source row and passes on the committed file, each observed.
- `flow:sources:sync` against one enabled source produces a candidate report with provenance for each candidate, and leaves the glossary and the pool file unmodified.
- The pool file, its schema and the approval step are documented where the operator can read them without opening the code.
- `docs/development-flow.md` shows the ordered phases, their skills, and their practices, and includes the copy-paste prompt block.
- No network in the test suite: the sync's fetch layer is injected, and tests run against fixtures committed in the repository.

## Test Seams

The CLI surface of the four commands, and the pool file as its input. A test asserts what a command prints and which files it writes, never how it parsed a SKILL.md. The fetch layer sits behind one function so the sync can be exercised from fixtures with no network.

## Out of Scope

- Installing or updating skills from upstream: this repository declares and proposes, it does not vendor or auto-update the operator's machine.
- Automatic approval of a proposal. A human approves, always.
- Ranking sources by quality. The file records trust as the operator's declaration, not as a computed score.
