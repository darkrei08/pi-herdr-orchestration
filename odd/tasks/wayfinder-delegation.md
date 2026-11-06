Feature: wayfinder-delegation
Owner: pi-extensible-workflows (Herdr tab transport) and pi-herdr-orchestration (orchestrator routing contract).
Acceptance: a workflow agent never opens an empty sibling Herdr tab; the default session is documented as the delegating orchestrator that binds skill, role and model per dispatched unit.

## Specs

S1. "mi sono accorto che ogni qualvolta P Workflow Extensible esegue un nuovo workflow in un nuovo tabs o in di Herder si avvirono simultaneamente due tabs di Herder, una vuota e una invece con la sessione P-Agent che lavora"

S2. "una migliore implementazione è quella di usare un determinato ruolo di B-Extensible Workflow che esegua prima il WayFinder e quindi che associ la rispettiva skill, al rispettivo ruolo, e modello"

S3. "in modo tale che tu, come modello della sessione predefinita, con cui avvii la sessione vada semplicemente a orchestrare e a inviare le direttive ai sottoagenti con Pi extensible workflow e tu poi legga in ricezione i loro risultati"

S4. "Questa è una corretta direttiva che puoi implementare in agence MD in cui il modello predefinito all'avvio della sessione non è altro che il primo orchestratore che delega e riceve i risultati"

S5. "Esegui l'aggiornamento di tutte le estensioni di P-Agen"

S6. "Esegui anche una ricerca massiva"

S7. "una volta che hai stilato il piano di esecuzione, committa inizialmente tutto localmente individua appunto le future, le issue, le personalizzazioni, le ottimizzazioni e poi inizia a utilizzare gli altri skill di implementazione di Mad Pacot in maniera organizzata, ordinata, in base alle priorità dei ticket"

## Tasks

- T1 | S1 | Reuse the workspace root tab and pane for the first workflow agent so fully inspectable mode opens one tab per agent | commit: cb9dfba (pi-extensible-workflows)
- T2 | S1 | Pin the tab/pane contract with focused tests and confirm it against a live Herdr workspace | commit: cb9dfba (pi-extensible-workflows)
- T3 | S1 | Nest workflow agents as sibling panes in the caller tab and document the pane tree | commit: bee2715
- T4 | S2-S4 | Encode the root-orchestrator directive and the wayfinder routing step in the deployed Pi AGENTS.md | commit: 88d5cef (dotenv, branch feat/orchestrator-delegation)
- T5 | S5-S7 | Refresh installed extensions, record research evidence, file the follow-up issues, and commit the coherent work units locally | commit: pending

## Log

L1. "Esegui l'aggiornamento di tutte le estensioni di P-Agen: però soprattutto inizia ad analizzare tutte le memorie precedenti di questo repo. In modo tale da individuare attraverso anche skill opt attraverso data resemovable search per il mio stack di ricerca se ci sono delle possibili evidenze che possono andare a migliorare e a correggere il processo di delegazione di creazione dei sotto-workflow nei singoli work tree separati e nelle singole E. nelle singole tabs open di Herder, perché mi sono accorto che ogni qualvolta P Workflow Extensible esegue un nuovo workflow in un nuovo tabs o in di Herder si avvirono simultaneamente due tabs di Herder, una vuota e una invece con la sessione P-Agent che lavora, esegui anche una ricerca massiva. Esegui inoltre tutte le skill di Matt Paco per effettuare anche l'inizializzazione del triage e quant'altro e dopodiché inizia a effettuare il Way Finder in maniera autonoma, con soluzioni migliori consigliate, anche se sono quelle difficili, non consigliate, sarebbe forse la strada giusta. Esegui appunto delle ricerche, dopodiché, una volta che hai stilato il piano di esecuzione, committa inizialmente tutto localmente individua appunto le future, le issue, le personalizzazioni, le ottimizzazioni e poi inizia a utilizzare gli altri skill di implementazione di Mad Pacot in maniera organizzata, ordinata, in base alle priorità dei ticket che crego il Wayfinder e utilizza poi Grill Me, Grill Docks e tutte le altre skill necessarie."

L2. "Ovviamente una migliore implementazione è quella di usare un determinato ruolo di B-Extensible Workflow che esegua prima il WayFinder e quindi che associ la rispettiva skill, al rispettivo ruolo, e modello, in modo tale che tu, come modello della sessione predefinita, con cui avvii, appunto, la sessione vada semplicemente a orchestrare e a inviare le direttive ai sottoaggenti con Pi extensible workflow e tu poi legga in ricezione i loro risultati. Quindi è come se tu sei l'orchestratore principale che riceve le informazioni e deleghi le informazioni. Questa è una corretta direttiva che puoi implementare in agence MD in cui il modello predefinito all'avvio della sessione non è altro che il primo orchestratore che delega e riceve le informazioni dei risultati che ha delegato."

L3. Evidence: `pi update --extensions` refreshed the installed package set (one package changed). Installed `pi-extensible-workflows` 6.3.0 and `@piewf/herdr` 6.3.0; global `extensionSettings.herdr.enableFullyInspectableMode` is `true`, so every workflow agent takes the workspace path.

L4. Root cause: `packages/core/src/herdr.ts::openHerdrWorkspacePane` runs `workspace create`, which already returns one workspace, one tab and one root pane. The function then renames that root tab to the workspace label and calls `tab create` for the agent, leaving a permanently empty sibling tab. Seven live Herdr workspaces labelled "workflow subagents" are the leftovers of that root tab; `w60` still shows `tab_count: 2`.

L5. Verified against Herdr 0.9.5: `workspace create` returns `workspace_id`, `tab.tab_id` and `root_pane.pane_id`; `pane run` on that root pane starts a command; `tab rename` relabels it; closing the workspace's last tab removes the workspace, while closing a tab that still has siblings leaves them running. The same sequence exists in the local checkout `/root/git/personale/pi.dev/pi-extensible-workflows` and in the installed package, so the fix belongs upstream and is not a configuration toggle.

L6. Herdr has no nested tabs. Its hierarchy is session -> workspace -> tab -> pane tree, and the CLI exposes `pane split`, `pane move`, `pane zoom`, `pane resize` and `pane swap` but no tab nesting. The user's requirement (workflow runs in their own worktrees stacked under the same session tab, collapsible) therefore maps to sibling panes inside the caller's tab plus `herdr pane zoom --on|--off`. Verified on Herdr 0.9.5: splitting pane `w7D:p1` returned `w7D:p2` in tab `w7D:t1`, and zoom reported a `zoomed` flag on that tab layout.

L7. Installed extensions were refreshed with `pi update --extensions`. Matt Pocock skills are installed under `~/.agents/skills` but carry `disable-model-invocation: true`, so `wayfinder`, `triage`, `to-spec`, `to-tickets`, `implement`, `grill-me`, `grill-with-docs` and `handoff` are user-invoked and are not model-selectable; routing must therefore name them as explicit `skills` selectors for a dispatched role rather than assume the model can call them.

L8. Live proof of the fix: the built `openHerdrWorkspacePane` against Herdr 0.9.5 produced workspace `w7N` with `tab_count: 1` and tab label `#1 live-probe`, where the previous code produced an empty tab labelled `workflow <name>` next to the agent tab. Live proof of the nesting: `openHerdrPane` split `w7D:p1` into `w7D:p2` inside tab `w7D:t1`.
