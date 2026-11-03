# Skill-source reliability

Updated: 2026-11-03

## Decision in brief

The pool should compare the installed local skills with two upstream primary collections: `mattpocock/skills` and `obra/superpowers`. Matt's collection is the source this repository's flow is modelled on; the local root is the incumbent actually loaded on this machine. Obra is the strongest maintained primary comparison because the sweep found both a high-activity repository and CI that validates `SKILL.md` structure.

Stars are discovery context, not a trust decision. Maintenance is better evidenced by API release and commit data, PR closure ratio, CI, and local schema compatibility. A source that cannot be redistributed or cannot load as `SKILL.md` is eliminated before scoring.

## Evidence ledger

The following GitHub values were checked against the GitHub API on 2026-11-03 and are **VERIFIED**:

| Source | Licence | Stars | Open issues | Format or legal observation |
|---|---:|---:|---:|---|
| `mattpocock/skills` | MIT | 311015 | 208 | Candidate `SKILL.md` collection; primary |
| `obra/superpowers` | MIT | 311656 | 351 | Candidate `SKILL.md` collection; primary |
| `addyosmani/agent-skills` | MIT | 112967 | 126 | Candidate secondary collection |
| `vercel-labs/skills` | MIT | 37910 | not supplied | Candidate secondary collection |
| `anthropics/skills` | NONE | 187012 | 1466 | No root `LICENSE`; office-document skills carry source-available terms |
| `vercel-labs/agent-skills` | NONE | 33471 | 192 | README claims MIT, but no `LICENSE` file exists |
| `PatrickJS/awesome-cursorrules` | CC0-1.0 | 41092 | not supplied | Uses `.cursor/rules/*.mdc`, not `SKILL.md` |

The sweep also reported, but did not independently verify, these values and observations. They are **REPORTED**, not verified: `mattpocock/skills` and `obra/superpowers` have PR closure ratios around 89 percent; `anthropics/skills` has a PR closure ratio around 29 percent and roughly 1,037 open PRs; the tagged releases are `v1.3.2` and `v7.0.x`; Anthropic has zero releases; and Obra has CI validating `SKILL.md` structure.

## What is actually used and maintained

- **Used incumbent:** `/root/.agents/skills` is the local baseline. It is the only source that represents what the harness can load today.
- **Used upstream model:** `mattpocock/skills` is the collection this repository's development-flow design follows, so it is primary rather than merely popular.
- **Maintained primary comparison:** `obra/superpowers` combines a verified MIT licence and large API-visible activity with reported PR closure and `SKILL.md` validation CI.
- **Secondary breadth:** `addyosmani/agent-skills`, `vercel-labs/skills`, and `skills.sh` are useful discovery or comparison sources, but none displaces the incumbent without passing the same gates.
- **Observed, not trusted:** `anthropics/skills` remains enabled only as quarantine with `trust: unsure`, so a future sweep can record changes without promoting it.

## Blockers that disqualify a source

Licence and format are hard gates, not soft deductions. Redistribution is blocked when a repository has no licence, has only an unverified README claim, or contains source-available terms where the skills would be copied. That disqualifies `anthropics/skills` and `vercel-labs/agent-skills` from adoption. A collection in another loader format is also disqualified: `PatrickJS/awesome-cursorrules` is CC0-1.0, but `.cursor/rules/*.mdc` is not loadable `SKILL.md`. `cursor.directory` is a site listing rather than an auditable, committed `SKILL.md` collection and is therefore disabled.

The permitted licence set is `MIT`, `Apache-2.0`, `BSD-3-Clause`, and `CC0-1.0`. Licence and format are checked before any weighted comparison; quarantine is for observation, not an exception to adoption.

## Signals that predict maintenance

1. **API-observable activity:** release and latest-commit data show whether the repository is receiving maintained changes, without relying on a README claim.
2. **PR closure ratio:** it measures whether proposed work is processed rather than merely accumulated. It is a signal, not a quality guarantee.
3. **CI presence:** checks that the project continuously validates the artifact shape. Obra's reported `SKILL.md` structure check is especially relevant to this harness.
4. **Local schema compatibility:** the final trust boundary is whether the files can be loaded by this harness, with the expected frontmatter and paths.

Stars do not predict these properties. They measure attention accumulated over time, not current maintenance, legal permission, relevant coverage, loader compatibility, or whether issues and pull requests are handled. A very popular repository can still be unlicensed, stale, irrelevant, or in the wrong format. Forks and releases are useful API evidence, but they also need the phase, compatibility, licence, cost, and risk dimensions.

## How candidates should be compared

Engineering literature supports a two-stage decision:

- **Hard elimination first:** remove candidates that fail a non-negotiable constraint. For this pool those constraints are the permitted licence set and loadable `SKILL.md` format. This prevents a high popularity score from rescuing a legal or operational blocker.
- **Soft scoring second:** compare the survivors on relevance, maintenance, use evidence, compatibility, licence, overlap, cost, and risk. A tie keeps the incumbent because migration has a cost.

ISO/IEC 25010 provides a useful quality vocabulary rather than a popularity ranking: assess the relevant axes such as functional suitability, compatibility, reliability, maintainability, security, and flexibility. For this pool, compatibility and maintainability are especially important because a skill must load correctly and remain reviewable.

ATAM adds the missing trade-off step: identify quality-attribute scenarios, risks, sensitivity points, and trade-offs before choosing a candidate. For example, more coverage may increase migration cost; a highly popular source may still create a licence risk; stricter CI may improve reliability while reducing format flexibility.

The vanity-metric failure mode is treating stars, forks, issue counts, or a single release tag as the decision. Those values are easy to quote but do not establish relevance, legal permission, current maintenance, or local compatibility. They remain evidence lines, never the verdict.

## Ranked pool

| Rank | Source | Evidence summary | Pool verdict |
|---:|---|---|---|
| 1 | `mattpocock/skills` | **VERIFIED:** MIT, 311015 stars, 208 open issues. Flow-model incumbent; **REPORTED:** about 89 percent PR closure and `v1.3.2`. | **primary** |
| 2 | `obra/superpowers` | **VERIFIED:** MIT, 311656 stars, 351 open issues. **REPORTED:** about 89 percent PR closure, `v7.0.x`, and CI for `SKILL.md`. | **primary** |
| 3 | `/root/.agents/skills` | Local incumbent and the actual installed loader boundary; no GitHub popularity claim is needed. | **primary** |
| 4 | `addyosmani/agent-skills` | **VERIFIED:** MIT, 112967 stars, 126 open issues; useful maintained breadth, pending local comparison. | **secondary** |
| 5 | `vercel-labs/skills` | **VERIFIED:** MIT and 37910 stars; useful current ecosystem coverage, pending local comparison. | **secondary** |
| 6 | `skills.sh` | Registry discovery source; candidates still require provenance, licence, and local format checks. | **secondary** |
| 7 | `anthropics/skills` | **VERIFIED:** no licence, no root `LICENSE`, 187012 stars, 1466 open issues; **REPORTED:** about 29 percent PR closure, roughly 1,037 open PRs, zero releases. | **quarantine** |
| 8 | `PatrickJS/awesome-cursorrules` | **VERIFIED:** CC0-1.0 and 41092 stars, but `.mdc` format fails the `SKILL.md` gate. | **skip** |
| 9 | `vercel-labs/agent-skills` | **VERIFIED:** no licence, 33471 stars, 192 open issues; README MIT claim is not backed by a `LICENSE` file. | **skip** |
| 10 | `cursor.directory` | Site listing without an auditable committed `SKILL.md` source. | **skip** |

The committed pool therefore contains 3 primary rows, 3 secondary rows, 1 quarantine row, and 3 skip rows. Skip rows remain present but disabled so their exclusion reason is reviewable; the quarantine row remains enabled but has `trust: unsure`.
