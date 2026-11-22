Feature: Patch v1.3.1 defects and loop-graph research
Issue: local follow-up to v1.3.0 verification
Branch: fix/v1.3.1-defects

## Specs

1. **S1**: "la documentazione dentro npm `1.3.0` è obsoleta (`state-protocol.md:168` descrive ancora il digest con `.gga`)"
2. **S2**: "il digest non vincola più la configurazione del provider dopo la rimozione di `.gga`"
3. **S3**: "`validateEvidenceBinding` controlla solo la forma del digest"
4. **S4**: "il reclaim del lock ha un TOCTOU non riprodotto"
5. **S5**: "La verifica reale dei provider GGA/Engram non è mai stata eseguita."
6. **S6**: "Prepara la patch: commit, changelog, versione `1.3.1`."
7. **S7**: "Trascrivi le tracce audio, estrai commenti e link a repository e PDF da questi materiali:"
8. **S8**: "Per ogni fonte riporta: cosa propone sui loop graph, pro, contro, sovrapposizione con ciò che hai già risolto, cosa vale la pena adottare."
9. **S9**: "Ogni implementazione vive in un worktree dedicated; un solo writer per worktree."
10. **S10**: "Una release diventa `READY` o `CLOSED` solo dopo GGA PASS ed evidence binding coerente su task, run e candidate."
11. **S11**: "Le modifiche protette del checkout principale restano intatte: `.gitignore` modificato e `odd/tasks/open-source-stack-completion-20261119.md` non tracciato."
12. **S12**: "Ogni affermazione dell'analisi cita la fonte con link o timestamp."

## Tasks

- T1 (S1,S12): Test-first doc contract guard for state-protocol.md, then verify the corrected digest contract is included in npm 1.3.1. Route: `.worktrees/fix-v1.3.1`. Status: closed with RED/GREEN evidence; release package check pending T6. Commit: pending.
- T2 (S2,S12): Test-first restore of portable provider-config binding in the config digest without a machine-local `.gga` dependency; document the design decision. Route: `.worktrees/fix-v1.3.1`. Status: closed with RED/GREEN evidence; design = repository-tracked `skills/pi-herdr-orchestrator/reviewer-profile.gga`. Commit: pending.
- T3 (S3,S12): Test-first real comparison at the validateEvidenceBinding call sites, not only shape validation. Route: `.worktrees/fix-v1.3.1`. Status: closed with RED/GREEN evidence; shared `verifyBindingChain` now runs shape, stored evidence, and optional provider verification at every terminal call site. Commit: pending.
- T4 (S4,S12): Reproduce the lock reclaim TOCTOU with a deterministic test; fix it or close as "non riprodotto" with recorded evidence. Route: `.worktrees/fix-v1.3.1`. Commit: pending.
- T5 (S5,S10): Execute real GGA and Engram provider verification on the exact candidate and bind task, run, candidate, version, config digest, output digest, and file hashes. Route: `.worktrees/fix-v1.3.1`. Commit: pending.
- T6 (S6,S9,S10,S11): Prepare and publish v1.3.1 with checked code, changelog, clean worktree, GGA PASS, and protected checkout files untouched. Route: `.worktrees/fix-v1.3.1`. Commit: pending.
- T7 (S7,S12): Acquire and transcribe all listed X/YouTube material, extract comments and links, record access failures and alternatives. Route: research worktree. Commit: pending.
- T8 (S8,S12): Produce `reports/loop-graph-research.md` with index, transcripts, resources, pro/con table, overlaps already solved, recommendations, and source links/timestamps. Route: research worktree. Commit: pending.

## Log

- L1: "## Ruolo

Sei un ingegnere senior che lavora nel repository `/root/git/personale/pi.dev/pi-herdr-orchestration`. Conosci il flusso di release, il protocollo di stato e la skill di orchestrazione. Chiudi gli errori con prove, non con dichiarazioni.

## Contesto

`pi-herdr-orchestration` è il tuo fork di `pi-workflow-extensible`. La release `1.3.0` è pubblicata: `main` è a `ab207e4`, il tag `v1.3.0` è a `57b61f0`, il workflow `45002729129` è passato, npm mostra `latest=1.3.0` con provenance.

Restano errori aperti: la documentazione dentro npm `1.3.0` è obsoleta (`state-protocol.md:168` descrive ancora il digest con `.gga`), il digest non vincola più la configurazione del provider dopo la rimozione di `.gga`, `validateEvidenceBinding` controlla solo la forma del digest, il reclaim del lock ha un TOCTOU non riprodotto. La verifica reale dei provider GGA/Engram non è mai stata eseguita.

Nel checkout principale restano modifiche protette: `.gitignore` modificato e `odd/tasks/open-source-stack-completion-20261119.md` non tracciato.

## Obiettivo

Porta a termine due consegne.

1. Chiudi tutti gli errori ancora aperti, uno per ticket, implementando step by step. Poi pubblica la patch `v1.3.1`.
2. Analizza i materiali elencati sotto con la tua skill `repo data search stack` e con gli strumenti media del repo. Confronta i risultati con `pi-herdr-orchestration`, con l'upstream `pi-workflow-extensible` e con le guide ufficiali di Claude, Gemini e ChatGPT.

Fuori scope: riabilitare RDD, riscrivere l'architettura, toccare i file protetti del checkout principale.

## Fase 1 — Ticket e correzioni

1. Leggi prima `AGENTS.md`, la skill `pi-herdr-orchestrator`, `skills/pi-herdr-orchestrator/references/state-protocol.md` e la convenzione dei ticket in `odd/tasks/`.
2. Apri un ticket per ogni errore aperto, con passi di riproduzione e criterio di chiusura esplicito.
3. Implementa un ticket alla volta. Per ogni ticket scrivi prima il test che fallisce, poi la correzione che lo fa passare.
4. Per il TOCTOU del lock scrivi un test che lo riproduce. Se non riesci a riprodurlo, chiudi il ticket come "non riprodotto" e annota l'evidenza raccolta.
5. Per `validateEvidenceBinding` aggiungi il confronto reale nei call site, non solo il controllo di forma.
6. Per il digest valuta come ripristinare il binding della configurazione del provider senza reintrodurre la dipendenza dalla macchina locale. Documenta la scelta nel ticket.

## Fase 2 — Patch e ripubblicazione

1. Prepara la patch: commit, changelog, versione `1.3.1`.
2. Verifica con `npm test`, `node scripts/check.mjs`, `npm pack --dry-run` e `git diff --check`.
3. Esegui GGA e ottieni PASS sul candidato esatto. Registra in `checks` stato, versione, digest di configurazione e hash dei file revisionati.
4. Crea il tag `v1.3.1`, fai push e `npm publish` con provenance. Controlla che npm `latest` mostri `1.3.1` con provenance.

## Fase 3 — Acquisizione materiali

Trascrivi le tracce audio, estrai commenti e link a repository e PDF da questi materiali:
- https://x.com/0xwhrrari/status/2118327478250840140?a=G3Li1W3JJ0d8i1liHuQ&s=46
- https://youtu.be/DQBqh6gcx7U
- https://youtu.be/g_NgCLTibiM
- https://youtu.be/opjRguwyqYM
- https://youtu.be/6loAUS0TXOc
- https://youtu.be/zWPvnt8MDjk
- https://youtu.be/TwUa5XeeJyo

Se un materiale non è accessibile, registra il motivo e cerca una fonte alternativa.

## Fase 4 — Analisi comparativa

Per ogni fonte riporta: cosa propone sui loop graph, pro, contro, sovrapposizione con ciò che hai già risolto, cosa vale la pena adottare. Cerca anche guide online, best practice e corsi ufficiali di Claude, Gemini e ChatGPT sull'uso di tutti i tipi di loop graph.

## Vincoli

- Ogni implementazione vive in un worktree dedicato; un solo writer per worktree.
- Una release diventa `READY` o `CLOSED` solo dopo GGA PASS ed evidence binding coerente su task, run e candidate.
- Le modifiche protette del checkout principale restano intatte.
- Fuori scope: riabilitare RDD, riscrivere l'architettura.
- Controlli finali: tutti i test passano, nessuno disattivato; la documentazione dentro il pacchetto `1.3.1` descrive il contratto del digest corretto; ogni link del report è raggiungibile; ogni ticket è chiuso con la sua evidenza.

## Output

1. Ticket aggiornati e codice pushato su `main`, patch `v1.3.1` pubblicata su npm con provenance.
2. Un file Markdown in `reports/loop-graph-research.md` con: indice, trascrizioni, link utili a risorse, repository e PDF, tabella pro/contro, sovrapposizioni già risolte, raccomandazioni.
3. Un rapporto finale breve in chat: cosa è cambiato, comandi eseguiti con esito, versione pubblicata, cosa non hai potuto verificare."
- L2: Scouting evidence: config digest at `skills/pi-herdr-orchestrator/scripts/mailbox.mjs:266-268`; real verifier invocation at `:275-377`; validate call sites at `:437` and `:800`; stale-lock TOCTOU window at `skills/pi-herdr-orchestrator/scripts/lock.mjs:92-94`; GGA/Engram CLI commands derived from `:295-355`; "repo data search stack" not installed, closest `reusable-data-search`; `yt-dlp` and local ASR unavailable; media-use skill offers `npx hyperframes transcribe`.
- L3: Implementation worktree: `/root/git/personale/pi.dev/pi-herdr-orchestration/.worktrees/fix-v1.3.1` on branch `fix/v1.3.1-defects`, based on `origin/main` `ab207e4`. Protected main-checkout files are outside this surface and must remain untouched.
- L4: T1 RED evidence: copied `review-contract.test.mjs` into a scratch extraction of tag `v1.3.0`; `node --test skills/pi-herdr-orchestrator/scripts/review-contract.test.mjs` exited 1 because the doc still said `AGENTS.md plus the current project .gga bytes`. GREEN evidence in the worktree: focused test 1/1 PASS and `npm test` 75/75 PASS. The test is included in the `test` script; npm 1.3.1 package verification remains a T6 closure condition.
- L5: T2 design decision: bind the config digest to candidate `AGENTS.md` plus repository-tracked `skills/pi-herdr-orchestrator/reviewer-profile.gga`. This restores provider-config binding from a candidate-controlled profile while excluding machine-local `.gga` bytes. RED evidence: `review-digest.test.mjs` returned `BLOCKED !== READY` before the implementation. GREEN evidence: focused `review-digest` and updated `review-contract` tests 2/2 PASS. T1's contract guard was updated to the final profile-inclusive wording.
- L6: T3 RED evidence: importing `verifyBindingChain` before implementation failed the test module. GREEN evidence: `review-digest.test.mjs` 3/3 PASS, including shape-only `validateEvidenceBinding` returning `verified` for a forged digest while `verifyBindingChain` returns `blocked`. GGA also flagged pre-existing duplicated report replay branches at `mailbox.mjs:~750`; the shared helper removes that duplication.
