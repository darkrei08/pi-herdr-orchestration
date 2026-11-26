# Master Chief, PiWorkflow, and Herdr transport contract

This feature documents and tests the separation between the Master Chief control plane, PiWorkflow execution, and Herdr presentation transport.
Read this document through `## Log` before acting.

## Specs

- **S1**: "Non ho capito come mai tu poi rimani in time out tu devi usare la filosofia di Pair Orchestration che esegue poi P workflow quindi P workflow rimane in attesa dell'esecuzione dei rispettivi sottoaggenti workflow i singoli sottagenti sono indipendenti, eseguono il lavoro ricevuto dalla direttiva del suo Master Chief, la eseguono e poi invino il risultato al Master Chief."
- **S2**: "Come fa effettivamente Veck Hex Asia? E che utilizza appunto PX Rules per utilizzare rispettivamente i rule il modello più adatto."
- **S3**: "Sistema il tutto, segui la filosofia di P Workflow Extensible di UX Asia, P Herder e un Master Chief per gestire al meglio le tabs e le pin di Herder per me utente che graficamente video il lavoro svolto dalla sessione del sottoagente perché ho la tabs o pain Herder aperta nella chat di Healer tramite iOS senza usare la shortcut slash workflow."
- **S4**: "Quella è la direttiva principale che devi iniettare in Peer d Orchestration e che quindi non si deve sovrapporre al più workflow extensible."

## Tasks

- T1 [S1-S4] Define the control-plane, execution-plane, and presentation-plane contract and correct the routed child loadout so inherited role defaults cannot select unavailable skills; commit: working tree.
- T2 [S1-S4] Add regression coverage for explicit skill reset, named workflow fan-out, result handoff, bounded waiting, and no duplicate Herdr scheduler; commit: working tree.
- T3 [S1-S4] Verify the contract with repository tests and a PiWorkflow capability smoke check; commit: working tree.
- T4 [S1-S4] Record unresolved runtime capability blockers and close only the sessions created by this task; commit: working tree.

## Log

- L1: "Non ho capito come mai tu poi rimani in time out tu devi usare la filosofia di Pair Orchestration che esegue poi P workflow quindi P workflow rimane in attesa dell'esecuzione dei rispettivi sottoaggenti workflow i singoli sottagenti sono indipendenti, eseguono il lavoro ricevuto dalla direttiva del suo Master Chief, la eseguono e poi invino il risultato al Master Chief. Come fa effettivamente Veck Hex Asia? E che utilizza appunto PX Rules per utilizzare rispettivamente i rule il modello più adatto. Che stai facendo? Qual è la logica che stai applicando? Sistema il tutto, segui la filosofia di P Workflow Extensible di UX Asia, P Herder e un Master Chief per gestire al meglio le tabs e le pin di Herder per me utente che graficamente video il lavoro svolto dalla sessione del sottoagente perché ho la tabs o pain Herder aperta nella chat di Healer tramite iOS senza usare la shortcut slash workflow. Quella è la direttiva principale che devi iniettare in Peer d Orchestration e che quindi non si deve sovrapporre al più workflow extensible."
- L2: Implemented the separation in `SKILL.md`, `references/routing.md`, `README.md`, and `scripts/dispatch.test.mjs`. The focused dispatch contract test and full `npm test` pass. PiWorkflow smoke `78bcba06-1037-446b-9526-cf901246706c` completed with one read-only child using `!*` resets and the required MCP bridge; the previous unavailable `design-taste` pre-dispatch failure did not recur. The fallback HA Herdr tab was closed after its report; no duplicate workflow scheduler was created.