# Open-source stack completion
Branch: coordinated multi-repository work; repository-local branches remain authoritative.
Status: Planned; implementation is split into independent repository work units and delivery remains gated.

## Specs
1. **S1**: "Risolvi tutto apllica le correizoni amnca ti e le imolementaizoni e le api key e sorpaoutto deve esser eopensoirce e gratuito nulla a oagamento esegui test e ocmoelta incommit tets licale e poi puah esegui con pi herder orchetaretion e anche tute lenskill di sivluppo dingentle ai e di egnienrig exelelnce e ogg"
2. **S2**: The affected Data Research Stack, standalone Data Search skill, Media Distillation toolkit, and release coordination must be made as complete as the repository contracts permit, with tests and evidence; no paid provider may be required or silently invoked.
3. **S3**: API keys and secrets must never be invented or committed. Optional authenticated providers must have explicit environment contracts and a working open-source/keyless local fallback where the repository can support one; missing credentials remain a reported configuration blocker.
4. **S4**: Data Research Stack routing must preserve distinct provider ownership, fix only proven runtime/configuration blockers, and verify the documented Compose and smoke paths without weakening checks or deleting services based on superficial overlap.
5. **S5**: Media Distillation must preserve Pinchflat-NGX acquisition ownership, TrueNAS media-root compatibility, safe record states, captions-before-ASR ordering, and add only a justified open-source/free local-ASR implementation or integration boundary that is supported by the repository's dependency and platform contracts.
6. **S6**: Every changed repository receives its own bounded task, tests, local Conventional Commit, and explicit PASS/FAIL/BLOCKED/NOT RUN evidence. Cross-repository integration is coordinated through contracts and local commit SHAs; no repository is treated as one atomic commit.
7. **S7**: Use Pi Herdr orchestration and the applicable Gentle AI, Engineering Excellence, ODD, testing, container-matrix, issue/PR, and work-unit controls. Native review and delivery gates remain authoritative; no bypass, fake key, `--no-verify`, force-push, or unverified completion.

## Tasks
- T18 (S2-S3): Audit free/open-source provider and credential contracts across Data Research Stack and Data Search; return exact blockers and keyless alternatives. Route: read-only exploration. Commit: pending.
- T19 (S4): Repair and verify Data Research Stack runtime/configuration blockers in an isolated worktree, preserving provider boundaries and adding regression checks. Route: data-research-stack implementation. Commit: pending.
- T20 (S5): Audit and implement the smallest supported open-source/free local-ASR integration for Media Distillation, with tests and platform evidence. Route: media-distillation-toolkit implementation. Commit: pending.
- T21 (S2,S6): Reconcile standalone Data Search documentation/tests with the Data Stack contract and record cross-repository compatibility. Route: pi-data-search integration. Commit: pending.
- T22 (S6-S7): Run final cross-repository checks, native review, local commits, and delivery preparation. Route: master verification and ordinary repository delivery. Commit: pending.

## Log
- L1: 2026-11-19 user request verbatim: "Risolvi tutto apllica le correizoni amnca ti e le imolementaizoni e le api key e sorpaoutto deve esser eopensoirce e gratuito nulla a oagamento esegui test e ocmoelta incommit tets licale e poi puah esegui con pi herder orchetaretion e anche tute lenskill di sivluppo dingentle ai e di egnienrig exelelnce e ogg"
- L2: Existing evidence before this task: Data Stack routing commit `254d6f3` is local and clean but live checks are blocked by missing Crawl4AI token, BrowserOS port/config mismatch, and Scrape_01 data-directory state; standalone Data Search commit `d8d761e` has six focused tests passing; Media commit `637e4832d56422f57a7a0a5e21c931ad26505729` has 22 focused and 26 full tests plus Linux container checks passing, while Windows and live Pinchflat runtime remain unverified; no Whisper/local-ASR backend is implemented in the toolkit.
- L3: Delivery must not claim completion until the implementation, applicable tests, native review, and ordinary repository delivery gates each produce evidence. API keys supplied by a human may be configured only through ignored runtime environment files and must never be copied into Git, logs, tests, issues, or memory.
