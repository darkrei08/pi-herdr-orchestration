# Wayfinder second-brain integration
Owner: el Gentleman orchestrator
Status: reconnaissance complete; specification pending slice selection

## Specs

- **S1**: "Evita di installare l'aggiornamento di GLI Proxy Api. Dobbiamo aspettare che esca appunto la nuova immagine."
- **S2**: "vorrei capire se tutte le novità rilevanti di Gentle P, Gentle Shell, Gentle AI, Guardian Angel, Engram Plugin, Engram Core, Gentel Engram sia possibile integrare In insieme a P. Erzman nella mia estensione Pi herder orchestration o dare o creare nuove pull request per P-Workflow"
- **S3**: "se possibile, utilizzare anche in un repo che perta di comprimere al volo le interazioni e i risultati tra gli ati o i risultati di sviluppo all'interno della stessa sessione agentica"
- **S4**: "devi creare poi queste features in work tree separati nei rispettivi repo di interesse per poi applicare localmente i commit e in futuro effettuare le pull request"
- **S5**: "analizzare attraverso il WayFinder e gli altri skill di implementazione"
- **S6**: "se sono necessari l'implementazione, implementa li e soprattutto se sono utili al mio setup AI del mio repo allora devi integrarli nell'installazione nella rispettiva gerarchia di installazione"
- **S7**: "integ rale utili zzando le skill di cross repo, committa tutto localmente la matrice se effettivamente funziona"
- **S8**: "Eseguendo appunto anche più workflow, PRD orchestration, i work tre singoli per ogni ticket generato dal WiFinder. completa poi in autonomia tutti i progetti, analizzando singolarmente tutti gli errori fino al compimento"
- **S9**: "/wayfinder\n/to-spec\n/implement"

Supplied sources to classify and verify:

- https://github.com/Panniantong/Agent-Reach
- https://github.com/bigskysoftware/htmx
- https://github.com/jakubkrehel/skills
- https://github.com/mikevillarroel/buildbox-ios
- https://github.com/neuron-core/neuron-ai
- https://github.com/Tencent/teamai-cli
- https://github.com/AltanS/collie
- https://www.typingmind.com/
- https://github.com/INSANE0777/Awwwards-mcp
- https://github.com/herdrdev/herdr-app
- https://github.com/Nutlope/hallmark
- https://github.com/elie222/rakazc
- https://github.com/android/skills
- https://github.com/leonardo-mais/Spark
- https://github.com/augelloantonio/codex-cookie-gdpr-audit
- https://github.com/D4Vinci/Scrapling
- https://github.com/floci-io/floci
- https://github.com/vercel-labs/skills
- https://github.com/affaan-m/ecc
- https://github.com/lz4/lz4

## Tasks

- T1 (S1): Keep CLIProxyAPI image update deferred; no pull, compose edit, or restart. Commit: n/a.
- T2 (S2, S5): Produce evidence-backed ownership and integration map for Gentle/Pi/Engram/GGA/Workflow. Route: local and upstream research. Commit: pending.
- T3 (S3): Decide whether deterministic schema projection or cold-storage compression is useful; reject byte/LLM compression in the live prompt path unless replay and security proofs exist. Route: pi-extensible-workflows proposal. Commit: pending.
- T4 (S4, S6, S7): Implement only approved, bounded slices in isolated repository worktrees with local commits and tests. Route: cross-repository workflow. Commit: pending.
- T5 (S8, S9): Verify each slice, reconcile local repositories, and prepare authorized future PRs without bypassing host safety gates. Route: cross-repository validation. Commit: pending.

## Proposed slices

- **P1, orchestrator liveness parity**: make `extensions/index.mjs` use the existing identity-aware `classifyLiveness` result already used by `mailbox.mjs`; preserve legacy flags while exposing `state` and `reason` in JSON only. Owner: `pi-herdr-orchestration`. No upstream Workflow change.
- **P2, effective capability preflight**: distinguish installed package inventory from live role/model/skill/extension capability selectors before dispatch. Owner: `pi-herdr-orchestration`, consuming existing Pi Workflow preparation capabilities and pi-ext-roles hooks. No duplicate resolver.
- **P3, bounded review and memory evidence**: bind GGA/Gentle review evidence and Engram observation references to the exact task/candidate identity; unavailable or uncertain outcomes remain blocked/unverified. Owner: `pi-herdr-orchestration`. Do not create a second reviewer or memory store.
- **P4, deterministic context projection**: do not add LZ4 or LLM summarization to the live prompt path. Use typed `outputSchema`/`workflow_result` projection for inter-agent payloads; evaluate cold-storage compression separately only if a concrete retention problem is demonstrated. Owner: `pi-extensible-workflows` only if a missing contract is reproduced; otherwise documentation/tests in the orchestrator.
- **P5, optional UI projection**: defer Gentle Pi/Shell or Herdr app changes until a concrete status-display acceptance test exists. No third-party skill installation from the supplied list in this slice; unlicensed or unrelated projects remain excluded.

## Log

- L1: "Evita di installare l'aggiornamento di GLI Proxy Api. Dobbiamo aspettare che esca appunto la nuova immagine. Dopodiché vorrei capire se tutte le novità rilevanti di Gentle P, Gentle Shell, Gentle AI, Guardian Angel, Engram Plugin, Engram Core, Gentel Engram sia possibile integrare In insieme a P. Erzman nella mia estensione Pi herder orchestration o dare o creare nuove pull request per P-Workflow che integrino queste nuove features. Pertanto, se per quel determinato reboot vogliamo applicare determinate futures migliorative che puoi analizzare cercando anche online effettivi riscontri deterministici, soprattutto, e se possibile, utilizzare anche in un repo che perta di comprimere al volo le interazioni e i risultati tra gli ati o i risultati di sviluppo all'interno della stessa sessione agentica, devi creare poi queste features in work tree separati nei rispettivi repo di interesse per poi applicare localmente i commit e in futuro effettuare le pull request, ora ti mando questo link che potrebbe essere utile per effettuare la compressione in runtime dei risultati tra gli agenti."
- L2: "Eseguendo appunto anche più workflow, PRD orchestration, i work tre singoli per ogni ticket generato dal WiFinder. completa poi in autonomia tutti i progetti, analizzando singolarmente tutti gli errori fino al compimento e a permettere a me di avere un sistema perfettamente funzionante"
- L3: "Se è opportuno comparando le necessità di progettazione del second brain abilità che questi link di questi software offrono. Se poi sono necessari l'implementazione, implementa li e soprattutto se sono utili al mio setup AI del mio repo allora devi integrarli nell'installazione nella rispettiva gerarchia di installazione"
- L4: "Emanuele Andrisani ~ ITConsulting, [5 Nov 2026 alle 15:49] https://github.com/floci-io/floci"
- L5: "Acortech.it - channel, [5 Nov 2026 alle 22:04] find-skills — vercel-labs/skills https://www.skills.sh/vercel-labs/skills/find-skills"
- L6: "Emanuele Andrisani ~ ITConsulting, [5 Nov 2026 alle 22:08] https://github.com/lz4/lz4"
