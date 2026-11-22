Feature: full-stack-update-sync
Branch: fix/full-stack-update-sync (from origin/main b120fff)

## Specs
1. S1: "Completa il test e compatibilità e funzionamento complessivo ed aggiorna tutt ele skill i franeowr insifteaer pi e gentle shell oi e sync e"
2. S2: "Warning: Gentle AI: receipt-driven-development status is unavailable: native `gentle-ai review mode status` failed (package-local-binary-missing)".
3. S3: "Warning: promptimize: automatic rewrite failed; sending the original prompt. 400: MissingSessionID".
4. S4: "Pi 1.6.0 available; update Pi, extensions, skills and sync".

## Tasks
- T1 | S1-S3 | Fix promptimize sessionId plumbing and stale gentle-ai pin state | commit: local installed checkout, uncommitted
- T2 | S1,S4 | Update skills, framework, Pi and gentle-shell safely | commit: dotenv af7fde2, ODD e6f7285
- T3 | S1-S4 | Run full compatibility and functional test suite | commit: ODD evidence below

## Log
- L1: "Completa il test e compatibilità e funzionamento complessivo ed aggiorna tutt ele skill i franeowr insifteaer pi e gentle shell oi e sync e"
- L2: Discovery found: gentle-ai 5.0.0 binary exists; warning comes from pre-upgrade session state. Promptimize never passes sessionId to streamSimple, so OpenCode-family targets reject requests without x-opencode-session.
- L3: Promptimize fix added sessionId to Llm, forwarded it in complete(), and populated it from ctx.sessionManager.getSessionId() in llmFor(). Focused test proves forwarding; npm test 12/12 PASS.
- L4: Removed 11 retired sdd-* entries from dotenv agents/skills.manifest.json. link-skills verify OK with 103 links. Applied link-skills and refreshed registry with pinned gentle-ai 5.0.0: 164 skills.
- L5: Updated 6 tracked skill suites with bunx skills@latest update -g -y. Their local-source skills pi-herdr-orchestrator and pi-skill-fit require explicit re-add from path and remain managed by repo setup.
- L6: Ran pinned gentle-ai 5.0.0 sync. doctor: 10 passed, 0 failed, 2 PATH duplicate warnings for gentle-ai and gga. Installed assets match 5.0.0.
- L7: Full checks PASS: npm run lint, npm test 96/96, check:strict 0 required failures, check:anthropic-small-business, flow:sources:check, git diff --check. Startup smoke READY. Promptimize smoke: no MissingSessionID, no automatic rewrite failure, no package-local-binary-missing warning.
