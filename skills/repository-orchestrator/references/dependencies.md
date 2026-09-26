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
| Pi VCC | `@adamjen/pi-vcc`, `pi-vcc-config.json`, `session_before_compact` registration | `pi install npm:@adamjen/pi-vcc` | user-selected context compaction and recall |
| Wizard-AI | `WIZARD_AI_DIR`, `wizard-ai`, `wizard-ai-context`, `@darkrei08/wizard-ai-cli` | `npx --no-cache -y @darkrei08/wizard-ai-cli@latest setup --verbose` | guided installation, registry and context tooling |
| TOON | `@toon-format/toon` import or Wizard-AI context utility | install through Wizard-AI or the project-local npm dependency | regular tabular context encoding |
| LEA | Wizard-AI `encodeLEA`/`wz-ai-context` and LEA files | project convention supplied by Wizard-AI; no universal package assumed | lossless evidence aliases |
| RTK / sqz / Serena / graphify | corresponding executable plus `--version`/`--help` | prefer Wizard-AI's guided setup; use each project's official installer only when documented | output reduction, semantic code navigation and graphs |
| Guardian Angel | `command -v gga`, `gga version` | Homebrew or the upstream `install.sh` from Gentleman Guardian Angel | commit/PR quality gate and hash cache |
| Gentle AI / gentle-pi / Engram | executable, package, MCP server or configured skill directory | use the installed project's instructions; do not guess a package name | durable memory, handoff and review workflows |
| Herdr | `command -v herdr` or runtime registration | use the installed Herdr instructions | panes, tabs and workspace layout |

Wizard-AI is the preferred installer for its own registry and helper tools. Do not independently install a second copy of a tool already managed by Wizard-AI; record the source and version instead. TOON and LEA are adapters at a context boundary, not replacements for the canonical JSON state.

## Status contract

For every capability, write a compact status record:

```json
{
  "id": "pi-vcc",
  "kind": "extension",
  "status": "installed",
  "version": "0.4.0",
  "source": "pi install npm:@adamjen/pi-vcc",
  "verified_by": "session_before_compact hook",
  "required_for": ["pi-context-compaction"],
  "config_ref": "~/.pi/agent/pi-vcc-config.json"
}
```

Allowed statuses are `installed`, `missing`, `incompatible`, `disabled`, `blocked` and `not_applicable`. Keep credentials, tokens and account databases out of this registry. A missing optional capability changes the workflow to a documented fallback; it does not silently fail.

## Installation policy

- Detection is read-only and can happen during every bootstrap.
- Installation requires the user request, an explicit setup mode or repository policy granting it.
- Before installation, show the package/repository, version, command, scope (project/user/global) and side effects.
- After installation, verify the executable/package, version and the integration hook; record failures as `blocked`.
- Do not install two competing compactors. If Pi VCC is enabled, use it as the compaction owner and let Pi core handle only the paths that VCC explicitly delegates. If Pi VCC is absent, use Pi's native compaction.

