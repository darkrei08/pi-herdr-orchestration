Feature: workflow-extensible-rust-gaps-20261123
Owner: pi-herdr-orchestration; JavaScript remains the host boundary and Rust is limited to repository-proven pure computation.
Status: discovery in progress

## Specs

S1. "Analizza le parti mancanti del workflow `pi workflow extensible`."

S2. "Implementa in Rust le sezioni necessarie, includendo `ext roles` quando il repository lo richiede."

S3. "Interpreta `fast anything` soltanto usando evidenze nel repository."

S4. "Non inventare funzionalità o requisiti non supportati dal codice."

S5. "Aggiungi alla lista dei stack anche list agents\n✗ /root/.pi/agent/agents/gentle-ai-verify.md agent gentle-ai-verify field\ntools: must be an array of non-empty strings"

## Tasks

- T1 | S1-S4 | Inventory workflow, pi-ext-roles, Rust and Fast Anything seams from repository evidence | commit: pending
- T2 | S2-S5 | Add only a verified capability/reporting or Rust change, with regression tests | commit: pending
- T3 | S1-S5 | Run focused/full checks and report unavailable runtime evidence | commit: pending

## Log

L1. Prosegui cn oo svkippo analizando le psrti mancanti dinpinherdernorchetatartne di pi worjflow extensible e po ext roles pe imomentare opportumanere weioni incodide in rusta con fast anything

L2. Ecco il testo operativo: "## Obiettivo\n\nProsegui lo sviluppo nella directory `pi-herdr-orchestration`.\n\nAnalizza le parti mancanti del workflow `pi workflow extensible`.\n\nImplementa in Rust le sezioni necessarie, includendo `ext roles` quando il repository lo richiede.\n\n## Analisi\n\nLeggi prima struttura, documentazione, codice, test, TODO e configurazioni esistenti.\n\nRicostruisci il comportamento previsto usando le implementazioni e i test presenti.\n\nInterpreta `fast anything` soltanto usando evidenze nel repository.\n\nNon inventare funzionalità o requisiti non supportati dal codice.\n\n## Implementazione\n\nMantieni l'architettura, le convenzioni e le API esistenti.\n\nCompleta solo le parti mancanti necessarie al workflow extensible.\n\nAggiungi o aggiorna test per ogni comportamento implementato.\n\nEsegui formatter, controlli statici, build e test pertinenti.\n\nCorreggi gli errori introdotti prima di concludere.\n\n## Output\n\nRiporta brevemente:\n\n- parti mancanti individuate;\n- implementazioni completate;\n- file modificati;\n- test e comandi eseguiti;\n- problemi o ambiguità rimasti."

L3. The reported `list_agents` failure is treated as a host capability/configuration blocker, not as evidence that a Rust implementation is required. The repository must not modify `/root/.pi/agent/agents/gentle-ai-verify.md` without an explicit separate authorization to edit that external file.

L4. Repository evidence: PiWorkflow and `@piewf/pi-ext-roles` already own workflow execution, role preparation, MCP loadouts, timeouts, and worktree routing in JavaScript. Fast Anything exists as `scripts/fast-anything.mjs` plus tests/report on its feature branch and has no Rust/Cargo source. The only justified Rust seam is the previously verified pure waits-for graph planner, integrated here from local commit `635401e` without replacing JavaScript host boundaries.

L5. Added the `list_agents` host roster to the documented stack and audit contract. A malformed Agent definition remains `BLOCKED`; no external agent-definition file was changed.
