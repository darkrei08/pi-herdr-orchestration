Feature: runtime-context-governance
Branch: fix/runtime-context-governance (from origin/main 7c2ab53)
Scope: pi-herdr-orchestration, pi-workflow-extensible, dotenv, /root/.pi/agent/extensions

## Specs
1. S1: "Ispeziona `model-preflight.mjs` e gli hook di runtime in `/root/.pi/agent/extensions/`."
2. S2: "Simula la compatibilità per Pi 1.6.0, `@sting8k/pi-vcc`, `ponytail` e `@narumitw/pi-goal`. Non applicare modifiche distruttive."
3. S3: "Risolvi l'errore HTTP 400 `MissingSessionID` configurando l'header `x-opencode-session`."
4. S4: "Implementa un controllo all'avvio per verificare l'integrità delle estensioni."
5. S5: "Imposta il limite massimo tra 256.000 e 300.000 token per l'orchestratore principale e per i sottomodelli child."
6. S6: "Applica questo vincolo in `pi-herdr-orchestration`, in `pi-workflow-extensible` e nei file dotenv."
7. S7: "Ispeziona i git worktree e rimuovi in sicurezza quelli inattivi privi di commit pendenti."
8. S8: "Definisci linee guida operative per isolare ogni sessione in un worktree derivato da `main`."
9. S9: "Inietta la direttiva operativa per usare `@sting8k/pi-vcc` per compattazione, recall, engram e codemode."
10. S10: "Valida la registrazione di `agentPreparationHooks` in assenza del peer `typebox`."
11. S11: "Esegui uno spawn reale di un child workflow e verifica la corretta consegna dei prompt nella Pi TUI."
12. S12: "Verifica la consegna dei prompt nella TUI di Pi." 
13. S13: "Esegui `npm test` e `git diff --check`."

## Tasks
- T1 | S1-S4 | Inspect extensions, simulate compatibility, verify/fix session header, add startup integrity check | commit: TBD
- T2 | S5-S6 | Enforce 256k-300k context ceiling for parent and child models across repos and dotenv | commit: TBD
- T3 | S7-S8 | Audit and safely remove obsolete worktrees, document factory rules | commit: TBD
- T4 | S9-S13 | Wire pi-vcc directive, validate hook/typebox and real child prompt delivery, run final checks | commit: TBD

## Log
- L1: "## Goal
Risolvi le anomalie di runtime, standardizza il ciclo di vita dei worktree e limita la context window a 300.000 token.

## Context
Lavora nel repository `pi-herdr-orchestration`. Consulta `odd.md`, `sdd.md`, `tdd.md` e `gentle-ai`. Ispeziona le estensioni in `/root/.pi/agent/extensions/` e le configurazioni in `pi-workflow-extensible`. Usa esclusivamente skill installate localmente.

## Requirements

### Ticket 1: Ambiente ed Estensioni
- Ispeziona `model-preflight.mjs` e gli hook di runtime in `/root/.pi/agent/extensions/`.
- Simula la compatibilità per Pi 1.6.0, `@sting8k/pi-vcc`, `ponytail` e `@narumitw/pi-goal`. Non applicare modifiche distruttive.
- Risolvi l'errore HTTP 400 `MissingSessionID` configurando l'header `x-opencode-session`.
- Implementa un controllo all'avvio per verificare l'integrità delle estensioni.

### Ticket 2: Limite Context Window
- Imposta il limite massimo tra 256.000 e 300.000 token per l'orchestratore principale e per i sottomodelli child.
- Applica questo vincolo in `pi-herdr-orchestration`, in `pi-workflow-extensible` e nei file dotenv.

### Ticket 3: Governance Worktree
- Ispeziona i git worktree e rimuovi in sicurezza quelli inattivi privi di commit pendenti.
- Definisci linee guida operative per isolare ogni sessione in un worktree derivato da `main`.

### Ticket 4: Orchestrazione E2E e Verifiche
- Inietta la direttiva operativa per usare `@sting8k/pi-vcc` per compattazione, recall, engram e codemode.
- Valida la registrazione di `agentPreparationHooks` in assenza del peer `typebox`.
- Esegui uno spawn reale di un child workflow e verifica la corretta consegna dei prompt nella Pi TUI.
- Verifica la consegna dei prompt nella TUI di Pi.
- Esegui `npm test` e `git diff --check`.

## Output
Fornisci un report suddiviso per ticket con:
- File modificati ed esito delle simulazioni di compatibilità delle estensioni.
- Stato dell'header `x-opencode-session` e dei controlli automatici di avvio.
- Elenco dei worktree rimossi e regole operative stabilite.
- Log di esecuzione di `@sting8k/pi-vcc`, verifica del system prompt child ed esito dei test."
- L2: Read-only discovery delegated to one configured explorer workflow (f84607f4-bcf6-413c-b2e7-240447cc4978); findings reconciled with direct reads and git worktree audit before any write.
