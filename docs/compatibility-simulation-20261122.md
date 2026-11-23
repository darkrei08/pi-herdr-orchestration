# Compatibility simulation (2026-11-22)

Read-only probe. No package, lockfile or runtime version was upgraded.

## Installed baseline

| Component | Observed version | Evidence |
| --- | --- | --- |
| Pi CLI | 1.5.2 | `pi --version` |
| `@earendil-works/pi-coding-agent` in extension tree | 1.4.0 | `/root/.pi/agent/extensions/node_modules/@earendil-works/pi-coding-agent/package.json` |
| `pi-extensible-workflows` in extension tree | 6.3.0 | `/root/.pi/agent/extensions/package.json` |
| `pi-extensible-workflows` in npm tree | 6.4.0 | `/root/.pi/agent/npm/node_modules/pi-extensible-workflows/package.json` |
| Node | v22.23.4 | `node -v` |

## Candidate updates

`npm view <spec> version peerDependencies dependencies engines --json` returned:

| Candidate | Result | Compatibility verdict |
| --- | --- | --- |
| Pi 1.6.0 (`@earendil-works/pi-coding-agent@1.6.0`, `pi-ai@1.6.0`) | Published; requires Node `>=22.19.0`; pins the 1.6.0 Pi family and bundles `typebox@1.3.27`, `proper-lockfile@4.1.2` | Compatible with local Node v22.23.4. Would require a coordinated Pi-family upgrade; not applied. |
| `@sting8k/pi-vcc@0.12.0` | Peers: `typebox >=1.1.24 <2.0.0`, `@earendil-works/pi-coding-agent >=0.74.0 <2.0.0` | Compatible with installed 0.11.2 peer surface. No upgrade applied. |
| `ponytail@1.0.57` | No peers or dependencies declared | Compatible as an installed skill. No upgrade applied. |
| `@narumitw/pi-goal@0.55.4` | Peers: `typebox *`, `pi-ai *`, `pi-tui *`, `pi-coding-agent *`; dependency `@narumitw/pi-tui-kit ^0.71.0` | Peer range is open, but `typebox` is unresolved from `/root/.pi/agent/npm/package.json`. Startup check reports this. No upgrade applied. |

## `MissingSessionID` / `x-opencode-session`

The installed Pi 1.5.2 core already contains the fix:

- `install/releases/1.5.2/node_modules/@earendil-works/pi-ai/dist/providers/opencode-headers.js:1-20` defines `OPENCODE_SESSION_HEADER = "x-opencode-session"` and `withOpenCodeSessionHeader`.
- `install/releases/1.5.2/node_modules/@earendil-works/pi-coding-agent/dist/core/model-runtime.js:473-476` derives `sessionId` from `providerOptions` and merges `getOpenCodeSessionHeaders(requestModel, sessionId)` before dispatch.
- `node_modules/@earendil-works/.ignored_pi-coding-agent/CHANGELOG.md:542` records upstream issue #9326.

No extra header configuration was applied: adding a second source for the same header risks duplicate/conflicting routing values. The startup integrity check now reports unresolved critical modules instead of mutating provider headers.

## Integrity check added

`/root/.pi/agent/extensions/model-preflight.mjs` and the matching dotenv source now export `checkExtensionIntegrity()`. At `session_start` it warns (without blocking) on:

- missing local extension paths referenced by `settings.json`;
- unresolved `proper-lockfile` from the extension root;
- unresolved `typebox` from the npm root.

Live result at implementation time: `{"ok":false,"issues":["unresolved critical module: typebox"]}`. This is the expected warning until the npm peer is installed; it does not block routing.
