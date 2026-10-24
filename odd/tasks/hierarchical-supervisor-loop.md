Feature: hierarchical-supervisor-loop
Issue: #6 (approved enhancement), extending the mailbox/lifecycle contract without replacing legacy states
Branch: feat/hierarchical-supervisor-loop

## Specs
1. S1: "Ma a questo punto trovo una soluzione, uno script, un qualcosa in TypeScript, come quello inizializzato da P. Erzman o da Vex Anxia con Porkflow che venga utilizzato dalla mia estensione P, Herder Orchestration. Che quindi abbia sempre in loop una direttiva che deve ricevere la direttiva inviata a un sottoagente P-Agen di un'altra tabs o un altro pennel di herder e questa sottoagenda la conclusione o invia una determinata richiesta di aiuto al master dove il master gli rinvia poi la direttiva e una volta che il sottoagente è terminato poi invia il risultato al master che deve riorganizzare. Una specie di grande azienda dove ci sono tanti capi-reparto e ogni capo reparto ha il proprio team ogni team ha le proprie competenze quindi analizza questa specifica da implementare all'interno di p hertz orchestrations in modo tale da avere il flusso di lavoro continuativo in loop e funzionante fin dal che non si riconcilano e funzionano tutte le richieste e le futures."
2. S2: "Prosegui con le tueuanalisi ediimplementazione e controlla altra sessione pi"
3. S3: "Solamente quando voglio commitare alla fine di tutti i workflow, alla fine di tutte le valutazioni se tutto è funzionante ed auditato, allora poi dobbiamo procedere mi devi inviare una notifica e quindi una nuova direttiva in PRD Orchestration e nei miei agen o nei file agenti md e così via. Che mi debba fare un report finale di tutti i comiti staged, step by step progressive che mi permettono appunto di decidere quale commit pushare o meno, oppure fare una pull request, oppure aprire una isio e così via."
4. S4: The existing approved issue #6 requires compatibility with current Herdsman supervision semantics, backward-compatible uppercase states, durable evidence references, non-blocking notification behavior, explicit destructive-operation boundaries, and the exact checks `npm test` and `git diff --check` plus applicable GGA/native checks.

## Tasks
- T1 | S1-S4 | Freeze the durable Master -> Chief -> Worker protocol and authority model | commit: pending
- T2 | S1-S4 | Add assignment, acknowledgement, decision, reassignment, and closure records without breaking legacy mailbox states | commit: pending
- T3 | S1-S4 | Implement a bounded, resumable supervisor reconcile loop using mailbox, Herdr liveness, Git evidence, waits/checkpoints, and retry limits | commit: pending
- T4 | S1-S4 | Expose native Pi tools/commands and document the hierarchy, lifecycle, precedence, and final delivery gate | commit: pending
- T5 | S1-S4 | Run RED-GREEN tests, repository checks, native review, O5 dependency reconciliation, and integration audit | commit: pending

## Log
- L1: "Prosegui con le tueuanalisi ediimplementazione e controlla altra sessione pi"
- L2: Existing repository inspection found mailbox atomic writes, evidence references, `orch_report`, `orch_status`, `orch_ask`, `orch_reply`, PiWorkflow/Herdr settings, and documented Master/Chief/Worker routing. The current base branch does not yet contain the blocked O5 supervision candidate.
- L3: Existing live-session inspection found `master-orchestration` active, `o5-supervision` idle with a delivered BLOCKED report awaiting native review consent, `o2-release` idle with an uncommitted candidate and no mailbox result, and two unrelated UNKNOWN Herdr workspaces retained without closure.
- L4: The smallest compatible implementation should use ESM `.mjs` plus JSON Schema and native Node tests before introducing a TypeScript build. PiWorkflow remains the deterministic execution engine; Herdr remains pane/liveness transport; the mailbox remains durable state; Engram remains memory only.
