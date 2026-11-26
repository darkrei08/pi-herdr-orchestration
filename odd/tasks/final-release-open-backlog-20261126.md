# Final release open backlog 2026-11-26

Resolve every open repository issue in dependency order, one ticket at a time, then publish the final Pi Herdr Orchestration release.

## Specs

S1. "Proseguiamo co i ticket aperti imed eseguiamoli in iridne facendo sviluppo commit locale e poi push non tifer are fibatnto che non hai finito di risolvereli tutti e dikole tarli per poi pubblicare la verisone defintiva di pi herder orchestration"

S2. "Prosegui immediatamente con i ticket aperti di pi herder orchestration. Risolvi tutti i ticket aperti in ordine. Poi pubblica la versione definitiva di pi herder orchestration. Lavora nella directory \"pi-herdr-orchestration\". Prima di modificare, leggi README, documentazione, configurazioni e fonte dei ticket. Determina l’ordine dei ticket aperti dalla fonte dei ticket. Esegui un ticket alla volta, seguendo l’ordine determinato. Sviluppa la soluzione nel repository per ogni ticket. Crea un commit locale per ogni ticket risolto. Esegui il push dopo ogni commit, seguendo il flusso git del progetto. Esegui i comandi di test o build già definiti nel progetto. Aggiorna e chiudi ogni ticket dopo il push e le verifiche. Non fermarti finché tutti i ticket aperti non sono risolti e chiusi. Pubblica la versione definitiva solo dopo la chiusura di tutti i ticket. Riporta i ticket risolti, i commit, i push, i test eseguiti, la versione pubblicata e eventuali elementi non verificati."

S3. Scope answer: "Tutte le 23 issue aperte".

S4. Blocker policy answer: "Autorizza azioni esterne".

## Tasks

- T01 (S1-S2): #14 Release workflow accepts unvalidated manual tags. Route: implement-repo. Commit: 698b5fd; PR #67 merged as 3ae9b5a; issue CLOSED.
- T02 (S1-S2): #6 Align mailbox evidence and lifecycle semantics with current Herdsman. Route: docs/test alignment. Commit: 9b2aace; PR #68 merged as b7cf543; issue CLOSED.
- T03 (S1-S2): #21 Routing names Matt Pocock flow skills that a session cannot select. Route: docs/test routing constraint. Commit: 70c9a2d; PR #69 merged as 25266d7; issue CLOSED.
- T04 (S1-S2): #62 [gentle-pi.exploration-budget] Research dispatch uses an unavailable web-search tool name. Route: restore task trace and verify-close. Commit: 208eebe; PR #70 merged as d5aac91; issue CLOSED.
- T05 (S1-S2): #64 Inject host-node Proxmox LXC/VM compatibility matrix guidance into skills. Route: verify documentation delivery and record evidence. Commit: e32b349; PR #71 merged as d37e497; issue CLOSED.
- T06 (S1-S2): #29 Add a persisted graph supervisor for resumable PiWorkflow orchestration. Route: verify implementation, add acceptance evidence. Commit: 535bb1f; PR #72 merged as 9c40a68; issue CLOSED.
- T07 (S1-S2): #20 Document deferred publication for isolated commit worktrees. Route: repository directive. Commit: 01c25c6; PR #73 merged as 7564b4b; issue CLOSED.
- T08 (S1-S2): #26 [feature] Propagate orchestration state into the pane title as a talking label. Route: extension feature. Commit: 5bef8a4; PR #74 merged as 4832f8e; issue CLOSED.
- T09 (S1-S2): #28 [feature] Record run budget and stop a loop that exceeds its ceiling. Route: mailbox/extension feature. Commit: f90b0ce; PR #75 merged as e664f33; issue CLOSED.
- T10 (S1-S2): #27 [feature] Add a deterministic PR-following workflow with zero-cost waiting phases. Route: registered workflow feature. Commit: ab92af9; PR #76 merged as 0dedd58; issue CLOSED. Slice boundary: 895 authored changed lines in one workflow unit, above the ~400-line target.
- T11 (S1-S2): #30 Herdr-dispatched workflow agents time out without a terminal report. Route: supervision contract and regression. Commit: 3e501ea; PR #77 merged as 28aaf29; issue CLOSED.
- T12 (S1-S2): #15 Orchestration cannot consume versioned model-fit evidence safely. Route: read-only versioned evidence boundary. Commit: a020b29; PR #78 merged as b9deb38; issue CLOSED.
- T13 (S1-S2): #13 Workflow agents do not consistently launch in ordered labeled Herdr tabs. Route: project settings and dispatch contract. Commit: 10e8199; PR #79 merged as 25b4eaf; issue CLOSED.
- T14 (S1-S2, S4): #42 Agent definition tools fields conform to the live schema. Route: external definition repair plus repository documentation. Commit: 757f9dd; PR #80 merged as 8e28f5a; issue CLOSED.
- T15 (S1-S2): #43 list_agents exposes a verifiable roster result. Blocked by #42. Route: read-only roster diagnostic. Commit: 1245ba6; PR #81 merged as 5985120; issue CLOSED.
- T16 (S1-S2, S4): #46 Fan-out preserves Herdr pane and session identity. Blocked by #44/#45 closed. Route: live read-only fan-out evidence. Commit: 2e6ea4d; PR #82 merged as a28b114; issue CLOSED.
- T17 (S1-S2): #47 Fan-out timeout and retry behavior is bounded and observable. Blocked by #46. Route: deterministic fan-out resolver and graph actions. Commit: 778d6db; PR #83 merged as 202948f; issue CLOSED. Slice boundary: 455 authored changed lines.
- T18 (S1-S2): #48 Isolated commit candidate is reproducible without publishing. Blocked by #47. Route: deterministic local Git fixture. Commit: 4431ff9; PR #84 merged as dbbdc14; issue CLOSED.
- T19 (S1-S2): #49 READY and CLOSED require candidate-bound evidence. Blocked by #48. Route: mailbox terminal gate. Commit: 07196ae; PR #85 merged as 952d90e; issue CLOSED.
- T20 (S1-S2): #50 Local factory run is repeatable from dispatch through final verification. Blocked by #43 and #49. Route: local factory runner. Commits: e5c840a, 2c22b63; PR #86 merged as 8e10146; issue CLOSED.
- T21 (S1-S2, S4): #63 PBS install on PVE 9.3 blocked by official script version gate. Route: external Proxmox/PBS resolution. Commit: bb08f32; PR #87 merged as 8b6b9f6; issue CLOSED and retitled.
- T22 (S1-S2): #39 Wayfinder: make Pair Orchestration a verified local factory. Route: map closure after children. Issue CLOSED with decisions appended.
- T23 (S1-S2): #52 Define a cross-platform Pi 1.6 tooling and Docker/LXC compatibility route. Route: map closure after children. PR #60 merged as 1495bd28; issue CLOSED with decisions appended.
- T24 (S1-S2): Final release. Route: version bump, checks, tag and publish after all issues closed. Commit: pending.

## Log

L1. "Proseguiamo co i ticket aperti imed eseguiamoli in iridne facendo sviluppo commit locale e poi push non tifer are fibatnto che non hai finito di risolvereli tutti e dikole tarli per poi pubblicare la verisone defintiva di pi herder orchestration"

L2. "Prosegui immediatamente con i ticket aperti di pi herder orchestration. Risolvi tutti i ticket aperti in ordine. Poi pubblica la versione definitiva di pi herder orchestration."

L3. User selected "Tutte le 23 issue aperte" and "Autorizza azioni esterne".

L4. T01 verified and delivered: focused test 4/4, npm test 144/144, node scripts/check.mjs Required failures 0, npm run lint 47 files clean, git diff --check PASS, CI ubuntu/macos/windows PASS, independent verifier PASS. Live workflow_dispatch NOT RUN.

L5. T02 verified and delivered: focused mailbox test 48/48, npm test 144/144, node scripts/check.mjs Required failures 0, npm run lint 47 files clean, git diff --check PASS, CI ubuntu/macos/windows PASS. Live Herdsman runtime NOT RUN.

L6. T03 verified and delivered: focused dispatch 9/9, npm test 145/145, npm run check Required failures 0, npm run lint 47 files clean, git diff --check PASS, CI ubuntu/macos/windows PASS. Live child dispatch with a disabled skill NOT RUN.

L7. T04 verified and delivered: focused dispatch 9/9, npm test 145/145, npm run lint 47 files clean, check:strict Required failures 0, check:context-window PASS, check:mcp PASS, git diff --check PASS, CI ubuntu/macos/windows PASS. Live web-search queries NOT RUN.

L8. T05 verified and delivered: npm test 145/145, node scripts/check.mjs Required failures 0, npm run lint 47 files clean, git diff --check PASS, CI ubuntu/macos/windows PASS. Live Proxmox guest execution NOT RUN.

L9. T06 verified and delivered: focused graph test 9/9, npm test 146/146, check:strict Required failures 0, flow:sources:check PASS, npm run lint 47 files clean, git diff --check PASS, CI ubuntu/macos/windows PASS. Live graph tools and real pane loss NOT RUN.

L10. T07 verified and delivered: git diff --check PASS, npm test 146/146, CI ubuntu/macos/windows PASS. No runtime behavior changed.

L11. T08 verified and delivered: focused pane-label test 9/9, npm test 155/155, npm run check Required failures 0, npm run lint 48 files clean, git diff --check PASS, CI ubuntu/macos/windows PASS, independent verifier PASS. Live pane rename NOT RUN.

L12. T09 verified and delivered: focused mailbox test 51/51, npm test 158/158, npm run check Required failures 0, npm run lint 48 files clean, git diff --check PASS, CI ubuntu/macos/windows PASS. Long-running session NOT RUN.

L13. T10 verified and delivered: focused PR-follow test 12/12, npm test 170/170, check:strict Required failures 0, flow:sources:check PASS, lint 50 files clean, git diff --check PASS, CI ubuntu/macos/windows PASS, independent verifier PASS. Live GitHub/PiWorkflow/Herdr execution NOT RUN. Slice is 895 authored changed lines in one deterministic workflow unit.

L14. T11 verified and delivered: focused dispatch test 10/10, npm test 171/171, check:strict Required failures 0, flow:sources:check PASS, lint 50 files clean, git diff --check PASS, CI ubuntu/macos/windows PASS. Live Herdr timeout reproduction NOT RUN.

L15. T12 verified and delivered: focused model-fit test 9/9, npm test 180/180, node scripts/check.mjs Required failures 0, lint 52 files clean, git diff --check PASS, CI ubuntu/macos/windows PASS, independent verifier PASS. Live pi-model-fit output and SkillOpt operations NOT RUN.

L16. T13 verified and delivered: focused dispatch/init tests 26/26, npm test 187/187, npm run check Required failures 0, lint 52 files clean, git diff --check PASS, CI ubuntu/macos/windows PASS. Live tab launch/model invocation NOT RUN; @piewf/herdr absent on host.

L17. T14 verified and delivered: nine external Agent definition frontmatter fields repaired to arrays of non-empty strings with backups in /tmp/*.bak-20261126; list_agents then reported a valid roster. Repository commit documents the repair path; npm test 187/187, git diff --check PASS, CI ubuntu/macos/windows PASS. Live Agent dispatch NOT RUN.

L18. T15 verified and delivered: focused roster test 11/11, npm test 198/198, npm run check Required failures 0, npm run lint 54 files clean, git diff --check PASS, CI ubuntu/macos/windows PASS, live read-only host roster diagnostic healthy/usable. Live Agent dispatch NOT RUN.

L19. T16 verified and delivered: live run f9ee44ef-52ae-465a-a3b6-b1a2d0d4883c with two read-only children produced distinct panes wS4:p2/wS4:p3, tabs wS4:t2/wS4:t3, sessions 01a215d9-cc89.../01a215d9-ccba..., and two identity-correlated mailbox records. npm test 198/198, git diff --check PASS, CI ubuntu/macos/windows PASS. Runtime pane retention after completion NOT VERIFIED.

L20. T17 verified and delivered: focused fan-out test 3/3, npm test 204/204, npm run check Required failures 0, npm run lint 57 files clean, flow:sources:check PASS, git diff --check PASS, CI ubuntu/macos/windows PASS. Live Herdr timeout/stale reproduction and quota failover NOT RUN. Slice is 455 authored changed lines.

L21. T18 verified and delivered: focused fixture test 1/1, npm test 205/205, check:strict Required failures 0, lint 59 files clean, git diff --check PASS, CI ubuntu/macos/windows PASS. No real push/PR/merge was performed by the fixture.

L22. T19 verified and delivered: focused mailbox test 55/55, npm test 209/209, npm run check Required failures 0, lint 59 files clean, git diff --check PASS, fixture test 1/1, CI ubuntu/macos/windows PASS, independent verifier PASS. Live GGA/Engram end-to-end NOT RUN.

L23. T20 verified and delivered on baseline 952d90e: factory report PASS 7, FAIL 0, BLOCKED 0, NOT RUN 2; focused factory test 4/4, npm test 213/213, npm run check Required failures 0, lint 61 files clean, git diff --check PASS, CI ubuntu/macos/windows PASS after platform-aware npm command fix. Live Herdr/PiWorkflow dispatch and publication NOT RUN by the runner.

L24. T21 verified and delivered: PBS installed in privileged LXC 108 with current official core (no bypass), datastore pbs-nfs created, PVE storage pbs-nfs active, enabled 02:00 snapshot backup job with zstd and exclusions, and CT 132 test backup exited 0 with visible snapshot pbs-nfs:backup/ct/132/2026-11-26T05:28:33Z. npm test 213/213, git diff --check PASS, CI ubuntu/macos/windows PASS. Full restore test and all scheduled guest backups NOT RUN. External evidence in odd/tasks/pbs-install-verification-20261126.md.

L25. T22 and T23 completed: all 23 open issues were closed. Map #39 decisions appended for #42/#43/#46/#47/#48/#49/#50. PR #60 conflict with current main was resolved, merged as 1495bd28, and map #52 decisions appended for #55/#59/#57/#64/#63 with explicit BLOCKED/NOT RUN caveats. Open issue count is 0.
