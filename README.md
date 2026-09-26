# Repository Orchestrator

Una skill modulare per gestire lavoro complesso in repository: discovery, task graph, PiWorkflow, memoria Gentle/Engram, branch e worktree, verifiche, integrazione e audit finale.

## Installazione

Dopo aver pubblicato questo repository su GitHub:

```bash
npx skills add darkrei08/repository-orchestrator --skill repository-orchestrator
```

Per l'installazione globale in Codex, quando supportata dalla versione della CLI:

```bash
npx skills add darkrei08/repository-orchestrator --skill repository-orchestrator --agent codex --global
```

`npx` avvia la CLI `skills`: questo repository non richiede un pacchetto npm proprio. Prima della pubblicazione si può provare la sorgente locale con `npx skills add ./repository-orchestrator --skill repository-orchestrator` dalla directory che la contiene.

## Struttura

- `skills/repository-orchestrator/SKILL.md`: indice e contratto operativo essenziale.
- `references/bootstrap.md`: discovery delle capacità installate.
- `references/wizard-ai.md`: compatibilità con Wizard-AI, TOON/LEA, RTK/sqz, Serena, graphify e Pi.dev.
- `references/discovery.md`: inventario Git, Issue/PR e grafo dei task.
- `references/memory.md`: memoria selettiva e handoff tra macchine.
- `references/routing.md`: scelta dinamica delle skill.
- `references/coordination.md`: gerarchia master, chief, sessioni e tab ordinate.
- `references/state-protocol.md`: contratto JSON compatto per directive, progress, result, chief report e decisioni master.
- `references/execution.md`: branch, worktree e sessioni.
- `references/quality.md`: test, critica e review.
- `references/integration.md`: destinazione, PR e cleanup.
- `references/audit.md`: rescan, recupero e audit finale.

La skill non installa automaticamente PiWorkflow, Gentle AI o altre skill. Rileva ciò che esiste e usa le istruzioni locali effettive. PiWorkflow resta l'orchestratore quando disponibile; la suite Gentle AI (inclusi gentle-pi, Engram, skill, workflow e integrazioni effettivamente installati) conserva conoscenza e continuità senza sostituire Git. Il modello operativo usa una sessione `[MASTER] Pi Repository Orchestrator`, chief di reparto e sessioni figlie con tab ordinate e rinominate. Il passaggio di stato usa un envelope JSON compatto; il Markdown viene generato per la lettura umana. Prima di chiudere una sessione figlia salva la memoria di sviluppo, trasmette il report al chief e al master, decide se pubblicare sul ramo stabile o mantenere il lavoro sul ramo di sviluppo, poi chiude sessione e tab. Le operazioni remote rispettano l'autorizzazione e le convenzioni del repository.

## Esempi

- «Usa repository-orchestrator per esaminare Issue e PR aperte e risolvere il lavoro autorizzato.»
- «Riprendi questo progetto dopo la reinstallazione: ricostruisci lo stato da Git e dalla memoria disponibile.»
- «Esegui l'audit finale del repository e segnala lavoro dimenticato e controlli mancanti.»

## Progetti collegati

- [PiWorkflow](https://github.com/vekexasia/pi-extensible-workflows)
- [Gentle AI](https://github.com/Gentleman-Programming/gentle-ai)
- [Engineering Excellence](https://github.com/micio86dev/Engineering-Excellence)

Questa skill è autonoma e non incorpora il codice né le skill dei progetti collegati.
