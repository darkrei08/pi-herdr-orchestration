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
- T1 | S1-S2 | Inspect lint config and match/aleme references | commit: TBD
- T2 | S3-S4 | Add zero-dependency lint script and wire npm/CI | commit: TBD
- T3 | S5-S7 | Fix all reported violations without behavior changes | commit: TBD
- T4 | S8 | Re-run lint, tests and checks; record evidence | commit: TBD

## Log
- L1: "Mposatlintu match aleme e risolvi"
- L2: "## Goal
Configura o esegui il linter in `pi-herdr-orchestration`.
Identifica gli errori o i riferimenti indicati ("match aleme") e risolvi tutti i problemi."
