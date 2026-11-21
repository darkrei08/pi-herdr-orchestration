# Prompt transport without `.txt`
Branch: `feat/herdr-pane-nesting`; target commit before this feature: `c2615f2e`.
Scope: target orchestration contract, the `pi-extensible-workflows` fork/runtime transport, and evidence-based `pi-herdsman` comparison.

## Specs

1. **S1**: "Porta il trasporto delle direttive senza file `.txt` su `pi-herdr-orchestration`, su `pi-extensible-workflows` e sul runtime installato: inline come default, fallback su file `.md` 0600."
2. **S2**: "Definisci la metodologia JSON/XML/Markdown e porta solo le innovazioni utili di `pi-herdsman`."
3. **S3**: "Includi codice, test, documentazione, commit, push sul fork e PR verso upstream. Escludi bump di versione, pubblicazione npm e redesign della mailbox JSON."
4. **S4**: "Il fallback `.md` 0600 resta obbligatorio. XML non sostituisce JSON. Usa copie sicure o worktree dedicati. Documenta il rischio del prompt inline visibile negli argomenti di processo."
5. **S5**: "Non toccare `.gitignore` e `odd/tasks/open-source-stack-completion-20261119.md`; backup in `/tmp/pi-herdr-orchestration-protection-20261121`."
6. **S6**: "Controlla l'ultima release di `pi-herdsman` (`https://github.com/boadij/pi-herdsman`) e porta gli snapshot 0600 in directory 0700 solo se coprono un rischio reale; motiva."

## Tasks

- T1 (S1-S5): Add direct `notifyAgent` regression coverage without changing its argv transport; document JSON/XML/Markdown boundaries and the current lack of an XML runtime consumer. Route: target repository. Commit: pending.
- T2 (S1,S3,S4): Create a clean fork branch from upstream `main` 6.4.0 and forward-port only the inline-safe Herdr transport, `.md` fallback, permissions, and focused tests. Route: `pi-extensible-workflows` fork. Commit: pending.
- T3 (S1,S3,S4): Build and link the patched fork runtime without publishing or version bumping; verify inline and every fallback condition with a fake Herdr runner and real package tests. Route: runtime verification. Commit: not applicable.
- T4 (S2,S6): Inspect latest `pi-herdsman` release and decide whether private extensionless 0600 snapshots add a necessary safety property beyond the inline transport. Route: read-only comparison. Commit: not applicable unless a separately authorized patch is proven necessary.
- T5 (S1-S6): Run target and fork checks, preserve unrelated local changes, commit coherent work units, push authorized fork branches, prepare/open upstream PRs if credentials and repository policy allow, and record exact blockers otherwise. Route: integration and delivery. Commit: pending.

## Log

- L1: "## Obiettivo\nPorta il trasporto delle direttive senza file `.txt` su `pi-herdr-orchestration`, su `pi-extensible-workflows` e sul runtime installato: inline come default, fallback su file `.md` 0600. Definisci la metodologia JSON/XML/Markdown e porta solo le innovazioni utili di `pi-herdsman`. Includi codice, test, documentazione, commit, push sul fork e PR verso upstream. Escludi bump di versione, pubblicazione npm e redesign della mailbox JSON."
- L2: Baseline observed before implementation: target `npm test` passed 72/72; target has pre-existing `.gitignore` and `odd/tasks/open-source-stack-completion-20261119.md` changes; fork inline fix is on `feat/herdr-inline-prompt` commit `639f0a8`, while upstream `main` 6.4.0 still writes `.txt` artifacts.
- L3: Safe external repository work must use dedicated branches/worktrees and must not overwrite existing checkout state. Runtime installation must be reversible and must not publish to npm or bump versions.
- L4: `boadij/pi-herdsman` latest release observed through authenticated GitHub metadata is `v0.52.1` (2026-11-21). Its existing `writePrivatePromptSnapshots` implementation already uses extensionless `0600` files under `0700` private directories, exclusive creation, and cleanup on failure; no pi-herdsman patch is necessary. The useful boundary was carried into the Herdr extension fallback while retaining the requested `.md` extension.
