# Optional dependency and extension registry

The orchestrator is usable with plain Git, but its integrations are discovered as optional dependencies. Never assume a command exists because a repository name appears in a prompt. Resolve each capability as:

```text
detect → classify → propose install → explicit approval → install → verify → register
```

## Capability registry

| Capability | Detect | Installation/source | Used for |
| --- | --- | --- | --- |
| Pi coding agent | `command -v pi`, `pi --version` | pi.dev installer or the package manager documented by the installed Pi release | sessions, tools and native compaction |
| PiWorkflow | Pi extension/package inventory and `pi-extensible-workflows` files | `pi install npm:pi-extensible-workflows` | `parallel`, `pipeline`, checkpoints, agents and worktrees |
| Pi compaction | Active Pi settings plus the configured extension hook; common packages include `pi-codex-context`, `@sting8k/pi-vcc` and legacy `@adamjen/pi-vcc` | Use the installed package's official instructions; for pi-vcc, `pi install npm:@sting8k/pi-vcc` | one selected context-compaction owner and recall |
| Skills CLI | `command -v skills` or `npx skills --version` | `npm install --global skills@latest` or the documented `npx skills` invocation | cross-agent skill distribution |
| Wizard-AI | `WIZARD_AI_DIR`, `~/.wizard-ai/.wizard-ai.json`, `wizard-ai`, `wizard-ai-context`, `@darkrei08/wizard-ai-cli` | `npx --no-cache -y @darkrei08/wizard-ai-cli@latest setup --verbose` | guided installation, registry and context tooling |
| TOON | `@toon-format/toon` import or Wizard-AI context utility | install through Wizard-AI or the project-local npm dependency | regular tabular context encoding |
| LEA | Wizard-AI `encodeLEA`/`wz-ai-context` and LEA files | project convention supplied by Wizard-AI; no universal package assumed | lossless evidence aliases |
| RTK / sqz / Serena / graphify | corresponding executable plus `--version`/`--help`; Wizard-AI wrappers do not prove the underlying tool is installed | prefer Wizard-AI's guided setup; use each project's official installer only when documented | output reduction, semantic code navigation and graphs |
| Guardian Angel | `command -v gga`, `gga version` | Homebrew or the upstream `install.sh` from Gentleman Guardian Angel | commit/PR quality gate and hash cache |
| Gentle AI / gentle-pi / Engram | executable, package, MCP server or configured skill directory | use the installed project's instructions; do not guess a package name | durable memory, handoff and review workflows |
| Herdr | `command -v herdr` or runtime registration | use the installed Herdr instructions | panes, tabs and workspace layout |

Wizard-AI is the preferred installer for its own registry and helper tools. Do not independently install a second copy of a tool already managed by Wizard-AI; record the source and version instead. TOON and LEA are adapters at a context boundary, not replacements for the canonical JSON state.

## Status contract

For every capability, write a compact status record:

```json
{
  "id": "pi-compaction-owner",
  "kind": "extension",
  "status": "installed",
  "version": "detected from package.json",
  "source": "active Pi settings and extension configuration",
  "verified_by": "settings entry plus compaction hook/config inspection",
  "required_for": ["pi-context-compaction"],
  "config_ref": "~/.pi/agent/settings.json and optional pi-vcc-config.json"
}
```

Allowed statuses are `installed`, `missing`, `incompatible`, `disabled`, `blocked` and `not_applicable`. Keep credentials, tokens and account databases out of this registry. A missing optional capability changes the workflow to a documented fallback; it does not silently fail.

## Installation policy

The capability report is executable from a checkout:

```bash
node skills/repository-orchestrator/scripts/check-environment.mjs --json
node skills/repository-orchestrator/scripts/check-environment.mjs --strict
```

It is read-only. It reports installed, missing and incompatible capabilities, the four supported agent skill roots, and the selected Pi compaction owner. Optional tools remain optional; `--strict` fails only when the skill, Node, Git, or compaction ownership is unavailable or conflicting.

- Detection is read-only and can happen during every bootstrap.
- Installation requires the user request, an explicit setup mode or repository policy granting it.
- Before installation, show the package/repository, version, command, scope (project/user/global) and side effects.
- After installation, verify the executable/package, version and the integration hook; record failures as `blocked`.
- Do not install two competing compactors. If one third-party compactor is active, it is the sole owner for its managed paths; if multiple are active, report `incompatible` and stop. If none is active, use Pi's native compaction.

## Overlap guard

Gentle AI/gentle-pi and Engram remain the host's continuity, memory and review integration. PiWorkflow remains the workflow control plane. Do not install Wizard-AI's overlapping memory, workflow, proxy, or provider-routing components when those capabilities are already supplied by the installed Gentle/Pi stack. Keep Wizard-AI limited to explicitly requested, independently missing tools and use its official installer only when the dependency set is acceptable; otherwise record the capability as `blocked` or use the documented fallback. Do not install legacy `@adamjen/pi-vcc` while another compaction owner is active.

