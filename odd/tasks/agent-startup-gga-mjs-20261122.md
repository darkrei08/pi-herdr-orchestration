Feature: agent-startup-gga-mjs
Branch: fix/agent-startup-gga-mjs (from origin/main 5890282)

## Specs
1. S1: "Ispeziona i log recenti e gli script di orchestrazione per identificare la causa del blocco all'avvio."
2. S2: "Correggi l'errore che impedisce l'avvio della sessione."
3. S3: "Aggiorna le regole e configurazioni GGA affinché includano ed esaminino i file `.mjs`."
4. S4: "Verifica lo stato di Git e l'ambito delle issue aperte (#30, #29, #28, #27, #26)."
5. S5: "Rispetta lo scope del repository: non chiudere issue estranee all'unità di lavoro corrente."
6. S6: "Esegui la verifica con `node scripts/check-environment.mjs --strict` o il comando equivalente."

## Tasks
- T1 | S1,S4 | Inspect logs, extension hooks, GGA config and issue scope | commit: TBD
- T2 | S2 | Make model preflight non-blocking and accept null selected routes | commit: TBD
- T3 | S3 | Add GGA .mjs coverage and workflow owner marker | commit: TBD
- T4 | S6 | Run strict environment, lint, tests and startup smoke check | commit: TBD

## Log
- L1: "Ho provato ad avviare nuova sessone di oibagent ma non si avvia ruotot qualcosa e ppi compelta con Risk: le issue aperte pre-esistenti, tra cui #30, #29, #28, #27, #26 e altre, non sono state chiuse perché non appartenevano a questo work unit; GGA non ha revisionato il commit perché i suoi pattern escludono .mjs."
- L2: Startup smoke showed two hard extension-load errors: duplicate `fullyInspectable` agent setup hook from a local Herdr fork extension plus `npm:@piewf/herdr`, and missing `typebox` for `pi-extensible-workflows/registry`. After removing the duplicate local extension source and making `typebox`/`@earendil-works/pi-coding-agent` resolvable from the npm root, Pi reached READY.
- L3: `model-preflight` was a third startup hazard: `before_agent_start` threw on stale/unavailable evidence and the parser rejected valid `selected: null`. It now parses null selected routes and degrades open with one warning. 23/23 extension tests PASS in both live and dotenv source copies.
- L4: GGA effective config was `/root/.config/gga/config` with `FILE_PATTERNS` missing `.mjs`; `.gga.local` was inert. Updated the global pattern to `*.ts,*.tsx,*.mjs,*.cjs,*.js,*.jsx,*.py,*.go` and kept a backup at `/root/.config/gga/config.pre-mjs`.
- L5: Open issues #30 timeout, #29 graph supervisor, #28 run budget, #27 PR-following workflow and #26 pane title were read-only verified. None were closed as they are outside this unit.
- L6: Verification: `npm run check:strict` PASS with 0 required failures, lint 37 files clean, tests 96/96 PASS, startup smoke READY with no preflight-block or selected-route errors.
