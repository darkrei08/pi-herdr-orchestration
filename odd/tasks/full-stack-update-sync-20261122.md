Feature: full-stack-update-sync
Branch: fix/full-stack-update-sync (from origin/main b120fff)

## Specs
1. S1: "Completa il test e compatibilità e funzionamento complessivo ed aggiorna tutt ele skill i franeowr insifteaer pi e gentle shell oi e sync e"
2. S2: "Warning: Gentle AI: receipt-driven-development status is unavailable: native `gentle-ai review mode status` failed (package-local-binary-missing)".
3. S3: "Warning: promptimize: automatic rewrite failed; sending the original prompt. 400: MissingSessionID".
4. S4: "Pi 1.6.0 available; update Pi, extensions, skills and sync".

## Tasks
- T1 | S1-S3 | Fix promptimize sessionId plumbing and stale gentle-ai pin state | commit: TBD
- T2 | S1,S4 | Update skills, framework, Pi and gentle-shell safely | commit: TBD
- T3 | S1-S4 | Run full compatibility and functional test suite | commit: TBD

## Log
- L1: "Completa il test e compatibilità e funzionamento complessivo ed aggiorna tutt ele skill i franeowr insifteaer pi e gentle shell oi e sync e"
- L2: Discovery found: gentle-ai 5.0.0 binary exists; warning comes from pre-upgrade session state. Promptimize never passes sessionId to streamSimple, so OpenCode-family targets reject requests without x-opencode-session.
