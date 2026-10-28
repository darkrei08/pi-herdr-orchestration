Feature: anthropic-small-business-pi-support
Owner: Pi Agent compatibility bridge over PiWorkflow, @piewf/pi-ext-roles, and the existing Pi MCP bridge; Anthropic remains the upstream skill source.
Scope: expose Anthropic Small Business skills to Pi without replacing PiWorkflow orchestration or importing unauthenticated remote MCP servers.

## Specs

S1. "Sonontuli fare rieche anche per quetso nuovo task: Le 13 nuove skill di Claude per piccole imprese: in questo video scopri come installare il plugin Small Business di Anthropic e come usare davvero queste skill per trovare clienti, preparare preventivi, creare contenuti e gestire il lavoro quotidiano. Vedrai la differenza tra skill operative e skill di orchestrazione, e come Build Agent e Build Connector ti permettono di trasformare un lavoro ripetitivo in una skill e di collegare i tuoi strumenti senza essere un tecnico. Ti mostro poi le skill per vendite e marketing (Grow Pipeline, Speed to Lead, Content Strategy, Social Content Engine, Review Reputation) e quelle per preventivi e finanza (Proposal Builder, Plan Payroll), con esempi pratici e prompt da copiare. Chiudiamo con un metodo semplice per capire se una skill ti fa davvero risparmiare tempo e denaro e con il principio di lasciare all'umano l'approvazione finale prima di un invio o di un pagamento."

S2. "Analizza se è possibile implementarla in P Herder Orchestration, P workflow, eccetera. Altrimenti aggiorna le skill installate di Anthropic."

S3. "Attenzione però, devono essere abilitate e compatibili con P-Agence e quindi con la mia impostazione attuale che utilizzo."

S4. "La mia orchestrazione è che può avviare diverse sessioni di P-Agent o altri agenti, ma che può utilizzare le skill e le estensioni di P-Agen. le skill di antropy che hai analizzato ad oggi con il video precedente, devono essere supportate da P-Agence."

S5. The official Anthropic Small Business plugin is the source of truth for the current release. The installed version must be discoverable and Pi-compatible without silently replacing PiWorkflow, @piewf/pi-ext-roles, existing role models, or the current MCP bridge.

S6. Operational skills may run in Pi only through explicit Pi skill selectors and current Pi tools/extensions. Orchestration skills must route through named PiWorkflow direct `agent(...)` calls with a pi-ext-roles role, MCP-capable extensions, bounded timeout, and a named worktree for writes.

S7. Connector definitions from Anthropic are metadata and routing hints. The implementation must not import or enable unauthenticated/side-effecting remote MCP servers automatically. Missing connectors must use an explicit fallback or report BLOCKED.

S8. Actions that send, publish, pay, write to customer systems, or modify external data require an explicit approval checkpoint; Pi memory, artifacts, and mailbox reporting replace Claude-only session-memory, Cowork artifact, and slash-command assumptions.

## Tasks

- T1 | S1-S5 | Install/update the official Anthropic Small Business source and make one canonical copy of its 44 skills visible to Pi while preserving Claude plugin ownership | commit: 
- T2 | S2-S8 | Add the Pi compatibility contract for router/workflow skills, role loadouts, approvals, memory, artifacts, and connector fallbacks | commit: 
- T3 | S5-S7 | Add a deterministic compatibility checker and focused tests for skill inventory, frontmatter, MCP policy, and PiWorkflow routing invariants | commit: 
- T4 | S1-S8 | Run focused repository/runtime checks, review the diff, persist evidence, and report unavailable connector/platform proof | commit: 

## Log

L1. Sonontuli fare rieche anche per quetso nuovo task: Le 13 nuove skill di Claude per piccole imprese: in questo video scopri come installare il plugin Small Business di Anthropic e come usare davvero queste skill per trovare clienti, preparare preventivi, creare contenuti e gestire il lavoro quotidiano. Vedrai la differenza tra skill operative e skill di orchestrazione, e come Build Agent e Build Connector ti permettono di trasformare un lavoro ripetitivo in una skill e di collegare i tuoi strumenti senza essere un tecnico. Ti mostro poi le skill per vendite e marketing (Grow Pipeline, Speed to Lead, Content Strategy, Social Content Engine, Review Reputation) e quelle per preventivi e finanza (Proposal Builder, Plan Payroll), con esempi pratici e prompt da copiare. Chiudiamo con un metodo semplice per capire se una skill ti fa davvero risparmiare tempo e denaro e con il principio di lasciare all'umano l'approvazione finale prima di un invio o di un pagamento.

L2. https://youtu.be/80HqW9CEAeM

L3. Analizza se è possibile implementarla in P Herder Orchestration, P workflow, eccetera. Altrimenti aggiorna le skill installate di Anthropic.

L4. Attenzione però, devono essere abilitate e compatibili con P-Agence e quindi con la mia impostazione attuale che utilizzo.

L5. La mia orchestrazione è che può avviare diverse sessioni di P-Agent o altri agenti, ma che può utilizzare le skill e le estensioni di P-Agen. le skill di antropy che hai analizzato ad oggi con il video precedente, devono essere supportate da P-Agence.

L6. Verified official source: `anthropics/knowledge-work-plugins/small-business` version 1.35.1 contains 44 skills and 35 MCP connector definitions. The installed Claude plugin is enabled at `~/.claude/plugins/cache/knowledge-work-plugins/small-business/1.35.1`.

L7. Current Pi runtime: Pi 1.4.0, pi-extensible-workflows, @piewf/pi-ext-roles, @piewf/herdr, codemode/tool-search/MCP bridge, and local BrowserOS/CodeGraph/Context7/Engram/Firecrawl MCP registry. Remote Anthropic connector endpoints are not currently configured in Pi.

L8. Compatibility decision: reuse the official SKILL.md prompts through Pi's canonical skill root, add an explicit PiWorkflow adapter for orchestration/approval/connector semantics, and validate without blindly importing the 35 remote MCP servers.

L9. Implemented `skills/anthropic-small-business-pi/SKILL.md`, registered it in `package.json`, and documented its PiWorkflow routing contract in `skills/pi-herdr-orchestrator/SKILL.md`, `skills/pi-herdr-orchestrator/references/routing.md`, and `README.md`.

L10. Added `check:anthropic-small-business`, `test:anthropic-small-business`, the deterministic compatibility checker, and focused tests. The checker verifies 44/44 canonical skills, matching hashes, valid frontmatter, required Pi bridge markers, and metadata-only handling of 35 upstream MCP definitions.

L11. Verification evidence: host `npm test` passed 21 tests; `check:anthropic-small-business`, `check:mcp`, `check:strict`, syntax checks, and `npm pack --dry-run` passed. Debian Node 22, Alpine Node 22, Fedora Node 20, Arch Node 26, and openSUSE Node 24 passed the test/pack/syntax matrix. Windows and macOS were unavailable on this Linux host. Native Gentle review assessment was unassessable because untracked scope was not explicitly declared; no native review verdict was claimed.
