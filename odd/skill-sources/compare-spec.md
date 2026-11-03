# Spec: discovering good sources, and reporting what is actually better

Type: spec
Status: draft
Scope: pi-herdr-orchestration
Related: `odd/skill-sources/spec.md` (the pool, the glossary, the sync that proposes)

## Problem Statement

The pool in the sibling spec answers "sweep the sources I already trust". It does not answer the harder question the operator keeps asking: **which sources should be trusted at all, and is any installed skill worse than what exists upstream?** Today that judgement happens in a chat, it is not reproducible, and it produces an opinion rather than a comparison. A skill that is newer is not automatically better, and a repository with more stars is not automatically relevant to this harness.

The operator also cannot see the reasoning. A recommendation without its dimensions, its evidence and its cost is unusable: it either gets followed blindly or ignored entirely.

## Solution

Two things, one command and one report.

**Source discovery.** A command sweeps the field for candidate sources rather than assuming them: skill collections, rule collections, registries, curated lists and the repositories behind them. Each candidate source is scored on evidence that can be checked from the outside, then the strongest ones are proposed for addition to the pool. The operator still approves; the command only ranks.

**Comparative report.** A command compares a candidate skill, framework or piece of software against what is installed, on a fixed rubric with editable weights, and writes one report where every verdict carries its advantages, its disadvantages, the cost of adopting it and the risk of doing so. The default verdict is "keep what is installed"; adopting something new has to earn its place.

## The rubric

The dimensions are fixed so reports stay comparable over time. The weights live in a committed file the operator edits (`flow-criteria.json`), so the ordering can be re-tuned without touching code.

| Dimension | What it measures | How it is evidenced |
|---|---|---|
| Relevance | does it cover a phase this harness actually runs | mapped to a phase id from the glossary, or unmapped |
| Maintenance | is it still alive | latest commit or release date, open-issue ratio, maintainer count |
| Evidence of use | do people outside its author use it | stars, dependents, independent mentions read from a page, not self-claimed |
| Compatibility | does it work in this harness | format compatibility: `SKILL.md` frontmatter, plain Markdown rules, or a workflow script |
| Licence | can it be used and redistributed here | licence file read, with the URL and the date |
| Overlap | what it would replace | the installed skill it competes with, named |
| Cost | what adopting it takes | files touched, migration, retraining of the operator's habits |
| Risk | what breaks if it is wrong | the blast radius, and whether a test would catch a regression |

A candidate wins only when its weighted total beats the installed alternative **and** it has no `high` risk finding. A tie keeps what is installed: migration is a cost, not a neutral act.

## The report

Markdown, one section per candidate, written under `docs/skill-comparisons/` with a date in the filename so two reports can be compared. Every section carries:

- what the candidate is, with its URL and the date it was read;
- the installed skill it competes with, or "nothing installed";
- the rubric table with the evidence for each dimension and its source;
- **advantages**: concrete, tied to a phase and to a practice from the glossary;
- **disadvantages**: the same, in the other direction, including what it does worse than what we already have;
- cost and risk, each with the thing that would have to change;
- a verdict: adopt, trial alongside, or keep what is installed, with the reason in one sentence.

## Commands

| Command | Deterministic | What it does |
|---|---|---|
| `npm run flow:sources:discover` | fetches, writes a report | finds candidate sources, scores them on the evidence dimensions, proposes pool additions; never edits the pool |
| `npm run flow:compare -- <candidate>` | fetches and reads, writes a report | compares one candidate against the installed alternative on the rubric and writes the report; never installs anything |
| `npm run flow:compare -- --all` | same | walks the candidates produced by the last discovery pass |

## Acceptance Criteria

- `flow:sources:discover` produces a ranked candidate list where every row carries the evidence that placed it, and leaves the pool file unmodified.
- `flow:compare` produces a report containing all eight dimensions with their evidence, both advantage and disadvantage lists, and a verdict, observed on one real candidate.
- A candidate with a `high` risk finding never receives an adopt verdict, observed with a fixture.
- A tie keeps the installed skill, observed with a fixture.
- The rubric weights come from the committed file; changing a weight changes the ordering of a fixture, observed.
- No network in the suite: the fetch layer is injected and tests run on fixtures.
- The report format is documented where the operator reads it, with one committed example.

## Test Seams

The CLI output and the written report. A test asserts the verdict, the presence of each dimension and the evidence line, never the parser internals. The fetch layer is one injectable function, as in the sibling spec.

## Out of Scope

- Installing, vendoring or updating anything. The command reports; the operator acts.
- Scoring people, repositories or projects on anything other than the dimensions above.
- Automatic pool edits, and any verdict that applies itself.
- Ranking by popularity alone. Stars are one evidence line among eight, and a repository with many stars that covers no phase of this harness scores zero on relevance.
