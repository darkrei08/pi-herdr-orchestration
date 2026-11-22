Feature: lint-match-aleme
Branch: fix/lint-match-aleme (from origin/main 391037f)

## Specs
1. S1: "Prima di intervenire, controlla la configurazione del linter nel repository (`package.json`, file di configurazione lint)."
2. S2: "Cerca nella base di codice riferimenti ai termini "match" e "aleme" per chiarire eventuali contesti specifici."
3. S3: "Esegui il comando di lint previsto per il progetto."
4. S4: "Se la configurazione del linter non è presente o non funziona, configurala correttamente."
5. S5: "Ispeziona tutte le violazioni segnalate dal linter o dai pattern indicati."
6. S6: "Modifica i file necessari per correggere ogni errore e warning."
7. S7: "Mantieni inalterata la logica applicativa e le funzionalità esistenti."
8. S8: "Esegui di nuovo il linter e accertati che l'analisi termini senza errori."

## Tasks
- T1 | S1-S2 | Inspect lint config and match/aleme references | commit: 765b14c
- T2 | S3-S4 | Add zero-dependency lint script and wire npm/CI | commit: 765b14c
- T3 | S5-S7 | Fix all reported violations without behavior changes | commit: 765b14c
- T4 | S8 | Re-run lint, tests and checks; record evidence | commit: 765b14c

## Log
- L1: "Mposatlintu match aleme e risolvi"
- L2: "## Goal
Configura o esegui il linter in `pi-herdr-orchestration`.
Identifica gli errori o i riferimenti indicati ("match aleme") e risolvi tutti i problemi."
- L3: No tracked or historical `aleme` references found; `match` occurs only as ordinary assertions/string matching. Interpreted the request as configuring lint and fixing all lint findings.
- L4: Added `scripts/lint.mjs` with syntax checks plus textual rules for trailing whitespace, tabs, CRLF, duplicate consecutive lines, multiple statements, work markers and loose equality. Wired `npm run lint`, `npm run lint:json`, CI step and focused tests.
- L5: Fixed two real violations: split two statements on one line in `scripts/flow-glossary.mjs:109` and `skills/pi-herdr-orchestrator/scripts/mailbox.mjs:1049`; added suppression directives for linter's own intentional pattern literals and fixture strings.
- L6: Final checks: lint 37 files clean, npm test 95/95 PASS, check:strict PASS, git diff --check PASS. GGA hook ran but its configured patterns exclude .mjs, so no file matched.
