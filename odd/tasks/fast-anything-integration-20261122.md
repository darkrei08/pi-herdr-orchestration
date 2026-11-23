# Feature: integrate fast-anything profiling into orchestration workflow
Branch: `feat/fast-anything-integration` (isolated worktree from `origin/main` b120fff)
Delivery strategy: add a bounded read-only profiling command, tests, docs and a dated scan report; no automatic Rust port or source mutation
Test runner: `npm test`, `npm run check`, `npm run lint`, `git diff --check`, `fast-anything doctor`, `fast-anything scan -- node <script>`
Risk: item 5 (new host toolchain and MCP configuration) and item 1 (port/enable would rewrite tracked source, explicitly excluded)

## Specs

S1. User request verbatim: "Puoi anche instalalre https://github.com/EL4CTEO/fast-anything su questo host iniettarlo nella pipilinendis viluppo ed in e ginerinexelelnxe e in setup mio dotenv e procedere ad applicarala adnogni repo per capire dove poter ottmizzare il lavoror e orocesso (sociro serve pe rpinmdoel fit che per pi herder orhcegstarion)"

S2. Delegation instruction verbatim: "Delega sviluppo e parti con pi herder orchestration".

S3. Verified tool facts: `fast-anything` v0.7.0 is installed globally through Bun at `/root/.bun/bin/fast-anything`; Rust 1.88.0 is installed; `fast-anything doctor` exits 0 and reports ready; global Pi MCP server `fast-anything` is connected with all eight tools. `port`, `verify`, `enable`, `disable` and `bench` can modify tracked source or require generated Rust crates, so this work unit uses only `doctor` and `scan` plus reported candidates.

S4. Repository baseline: worktree from `origin/main` b120fff at version 1.5.0. The primary checkout has unrelated dirty files and must not be touched.

## Tasks

T1 | S1,S2 | parent inline | done | install toolchain, register MCP, isolate worktree and open ledger
T2 | S1,S3,S4 | delegated developer | done | add a deterministic scan wrapper, npm script, tests and docs in the isolated worktree
T3 | S1,S3 | delegated developer | done | run focused scans on safe repo scripts and write a dated optimization report
T4 | S1-S4 | parent inline + verifier | done | checks passed; work-unit commit 9647013 recorded; PR #35 opened

## Log

L1. User request verbatim:

Puoi anche instalalre https://github.com/EL4CTEO/fast-anything su questo host iniettarlo nella pipilinendis viluppo ed in e ginerinexelelnxe e in setup mio dotenv e procedere ad applicarala adnogni repo per capire dove poter ottmizzare il lavoror e orocesso (sociro serve pe rpinmdoel fit che per pi herder orhcegstarion)

L2. Delegation instruction verbatim: "Delega sviluppo e parti con pi herder orchestration".

L3. 2026-11-22: toolchain install completed with pinned `fast-anything@0.7.0`, Rust 1.88.0, and connected global MCP server. Worktree `feat/fast-anything-integration` isolates the work from unrelated dirty files in the primary checkout. No tracked source has been modified yet in this worktree.

L4. 2026-11-22: added `scripts/fast-anything.mjs` (ESM, Node standard library, `spawn` argument arrays, subcommands limited to `doctor`, `scan`, `list-candidates`), `scripts/fast-anything.test.mjs`, the `perf:scan` npm script, a Verify-phase note in `docs/development-flow.md`, and a README tooling note. `scan` refuses scripts outside a one-entry allowlist and writes bounded Markdown to `reports/<date>-fast-anything-scan.md`.

L5. 2026-11-22: candidate inspection selected `scripts/flow-sources-check.mjs` only. `fast-anything scan -- node scripts/flow-sources-check.mjs` exited 0 in 31 ms and sampled `isIsoDate` at 1.0%, with blockers `lives in the entry script` and `not deterministic: new Date`. No speedup is claimed; `port`, `verify`, `enable`, `disable`, and `bench` were not run. Details are in `reports/2026-11-22-fast-anything-scan.md`.

L6. 2026-11-22: `scripts/lint.mjs` was rejected as a candidate. fast-anything writes `.fast/runner.mjs` inside the repository root, `lint.mjs` does not skip `.fast`, so a first scan exits 0 but every repeat scan exits 1 on the generated runner. Follow-up outside this work unit: add `.fast/` to `.gitignore` and to `SKIP_DIRS` in `scripts/lint.mjs`.

L7. 2026-11-22: verification passed: `node --test scripts/fast-anything.test.mjs` (14/14), `npm test` (96/96), `npm run check` (exit 0), `npm run lint` (41 files clean), `git diff --check` (exit 0), `fast-anything doctor` (exit 0), and the CLI refusal paths (exit 2). The new test file was not wired into the `npm test` script because the allowed package.json surface was one added script (`perf:scan`).

L8. 2026-11-22: closed both gaps from L6 and L7. `scripts/fast-anything.test.mjs` is now part of the `npm test` script, `.fast/` is git-ignored in `.gitignore`, and `.fast` is in `SKIP_DIRS` in `scripts/lint.mjs`. Follow-up note corrected in `reports/2026-11-22-fast-anything-scan.md`. No production code, allowlist or provider inference touched; `port`, `verify`, `enable`, `disable` and `bench` were still not run.

L9. 2026-11-22: verification of the gap fixes, all in this worktree. Red first: after a real scan, `node scripts/lint.mjs` exited 1 with two `loose-equality` findings in `.fast/runner.mjs`. After the fix: `npm test` exit 0 (110/110, includes `scripts/fast-anything.test.mjs`), `npm run check` exit 0, `npm run lint` before the scan exit 0 (41 files clean), `node scripts/fast-anything.mjs scan --date 2026-11-22 scripts/flow-sources-check.mjs` exit 0 (25 ms), `npm run lint` after the scan exit 0 (41 files clean), `git diff --check` exit 0, `git check-ignore -v .fast` exit 0 (`.gitignore:12:.fast/`), and `git status --short` shows no `.fast` entry. `node --test scripts/lint.test.mjs` was left unchanged because it does not cover `SKIP_DIRS`. Remaining risk: the explanatory comment above `CANDIDATES` in `scripts/fast-anything.mjs` still says `lint.mjs` does not skip `.fast`; that file was outside this task's edit surface.

L10. 2026-11-22: work-unit commit `96470133d2f057d3c90dfe7e28ee463c2773436d` passed GGA: read-only profiling wrapper, 110/110 tests, check PASS, lint PASS before and after a real scan, `git diff --check` PASS. Verification run measured 24-25 ms with `isIsoDate` at about 1.3%; no portable hot path and no speedup claim.
L11. 2026-11-23: branch pushed and PR #35 opened after the dependency blocker was resolved. CI passed on Ubuntu, macOS and Windows. No source-rewriting port was enabled.
