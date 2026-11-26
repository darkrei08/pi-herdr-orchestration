# Herdr clients and ownership boundary

The orchestrator detects the Herdr runtime and its Heeler integration read-only. It never installs, updates, pairs, or reconfigures a client, and its capability records are the only integration contract this repository owns.

## Ownership boundary

| Component | Owner | This repository may |
| --- | --- | --- |
| Herdr CLI, server, socket API, plugins, desktop app | `herdrdev` upstream (`herdr`, `herdr-core`, `herdr-app`) | detect version, protocol and install paths |
| Heeler Swift app (iOS/macOS), Heeler Herdr plugin, Heeler host helper | `ZingerLittleBee/Heeler` upstream | read the installed plugin metadata and the host-helper version |
| Platform builds, signing, packaging, pairing flows | upstream projects and the operator | report `installed`, `missing`, `incompatible` or `blocked` |
| Orchestration, task graph, dispatch, capability gating | `pi-herdr-orchestration` | implement and test here |

Detection never proves functional support. A present binary is not a working transport, and no macOS, Windows or iOS row is claimed without a runtime run recorded in the task file.

## Detected capabilities

All probes are read-only and run from `check-environment.mjs`.

| Record | Probe | Evidence |
| --- | --- | --- |
| `herdr` | `herdr --version` | CLI version string, for example `herdr 0.9.5` |
| `herdr-core` | `herdr-core --version` and `hc --version` | core runtime; `hc` is the documented alias |
| `herdr-protocol` | `herdr api schema --json` | top-level `protocol` integer of the bundled socket-API schema; no socket call |
| `heeler-plugin` | `herdr plugin list --json` | `heeler` entry from the plugin list envelope: version, enabled flag, `min_herdr_version`, declared platforms, plugin root, source kind |
| `herdr-app` | documented install paths per platform | presence only, no version and no support claim |
| `heeler-host-helper` | `<host-helper root>/app/version.json` | helper version, for example `0.5.12` |

The Heeler plugin is only listed when the CLI exposes the read-only JSON list. When the list command fails, is unparsable, or the CLI is absent, the record is `blocked` or `missing`; nothing is inferred from a plugin directory that the CLI does not report.

The plugin record is the protocol gate. `min_herdr_version` is the only compatibility contract a plugin publishes, so a CLI older than that value reports `incompatible`, and an unrecognizable version pair reports `blocked` instead of `installed`.

## Status semantics

- `installed`: the probe answered with the expected evidence.
- `missing`: the probe ran and the capability is absent.
- `incompatible`: the capability exists but a declared version contract is not satisfied.
- `disabled`: the capability exists and is explicitly switched off, such as a disabled plugin.
- `blocked`: the probe could not produce trustworthy evidence; the error is recorded.
- `not_applicable`: the capability has no meaning on the host or platform.

## Non-actions

The detection layer is read-only by construction. It does not:

- install, update, link or enable a Herdr plugin or desktop app;
- start or stop a Herdr server or core;
- pair a device, read pairing state, or mint credentials;
- write Herdr or Heeler configuration, `settings.json`, or systemd units;
- run any command against iOS or a Windows/macOS host.

## Known gaps

- The Herdr desktop app is detected by path presence only; its version, window state and control socket are not probed.
- Only the bundled socket-API schema protocol is reported; the core JSON-RPC generation is owned by `herdr-core` upstream and is not queried.
- Cross-platform behavior is unverified unless a row in the task file names the host, image or device, the exact command and its output.
