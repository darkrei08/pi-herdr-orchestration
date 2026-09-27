# Optional dependency and extension registry

The orchestrator is usable with plain Git, but its integrations are discovered as optional dependencies. Never assume a command exists because a repository name appears in a prompt. Resolve each capability as:

```text
detect → classify → propose install → explicit approval → install → verify → register
```

## Capability registry

| Capability | Detect | Installation/source | Used for |
| --- | --- | --- | --- |
| Pi coding agent | `command -v pi`, `pi --version` | `npm install --global @mariozechner/pi-coding-agent` or the package manager documented by the installed Pi release | sessions, tools and native compaction |
| PiWorkflow | Pi extension/package inventory and `pi-extensible-workflows` files | Existing package/config is manager-owned; otherwise `pi install npm:pi-extensible-workflows` | `parallel`, `pipeline`, checkpoints, agents and worktrees |
| Pi compaction | Active Pi settings plus `~/.pi/agent/packages/pi-codex-context` and configured extension hooks | `pi-codex-context` is the Vekexasia dotenv owner; never install `@sting8k/pi-vcc` | one selected context-compaction owner and recall |
| Skills CLI | `command -v skills` or `npx skills --version` | `npm install --global skills@latest` or the documented `npx skills` invocation | cross-agent skill distribution |
| Wizard-AI | `WIZARD_AI_DIR`, `~/.wizard-ai/.wizard-ai.json`, `wizard-ai`, `wizard-ai-context`, `@darkrei08/wizard-ai-cli` | `npx --no-cache -y @darkrei08/wizard-ai-cli@latest setup --verbose` | guided installation, registry and context tooling |
| TOON / LEA | Wizard-AI `wz-ai-context` and format utilities | Wizard-AI-managed only; no standalone LEA installer | tabular context encoding and lossless evidence aliases |
| graphify / graphifyy | command or Wizard-AI venv import | `uv tool install --force 'graphifyy[all]'` when Wizard-AI remains present | optional architecture graphs |
| LLMLingua | import from the detected Wizard-AI venv | `uv pip install --python <Wizard-AI-venv-python> llmlingua` | Wizard-AI context reduction |
| RTK | `rtk --version` | POSIX: `curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/master/install.sh | sh`; Windows: `winget install rtk-ai.rtk`; then `rtk init --global` or `rtk init -g` | output reduction |
| sqz | `sqz --version` | POSIX: `curl -fsSL https://raw.githubusercontent.com/ojuschugh1/sqz/main/install.sh | sh`; Windows: `irm https://raw.githubusercontent.com/ojuschugh1/sqz/main/install.ps1 | iex`; then `sqz init --global` | output compression |
| Serena | `serena --version` | `uv tool install -p 3.13 serena-agent`, then `serena init` | semantic navigation |
| Guardian Angel | `command -v gga`, successful `gga version` | POSIX: existing Homebrew `brew install gentleman-programming/tap/gga`, otherwise clone `https://github.com/Gentleman-Programming/gentleman-guardian-angel` and run `./install.sh`; Windows is blocked without an official compatible path | commit/PR quality gate and hash cache |
| Gentle AI / gentle-pi / Engram | `gentle-ai --version`, package/config detection for `gentle-pi` and `gentle-engram`, or `engram --version` | POSIX only: `curl -fsSL https://raw.githubusercontent.com/Gentleman-Programming/gentle-ai/main/scripts/install.sh | bash`, then `gentle-ai install --agent pi` only when the Gentle Pi integration is missing; skip when an existing Gentle or PiWorkflow owner would be duplicated | durable memory, handoff and review workflows |
| Herdr | `command -v herdr` and `herdr --version` | POSIX: `curl -fsSL https://herdr.dev/install.sh | sh`; Windows: `irm https://herdr.dev/install.ps1 | iex`; integrations/plugins are not installed automatically | panes, tabs and workspace layout |

The user-facing command matrix is in the repository README; keep this registry and the README synchronized. `skills add` installs skill files only and has no third-party postinstall hook; run `node scripts/bootstrap-dependencies.mjs` for a dry run and add `--apply` for mutations. The bootstrap never runs GGA `init` or `install`, which mutate repository hooks/config. Wizard-AI is the manager for TOON/LEA and its graphifyy/LLMLingua context stack. Do not independently install a second copy of a tool already managed by Wizard-AI; record the source and version instead. TOON and LEA are adapters at a context boundary, not replacements for the canonical JSON state.

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
- Do not install two competing compactors. Under the Vekexasia dotenv ownership model, `pi-codex-context` is the sole third-party owner and `@sting8k/pi-vcc` is intentionally skipped. If multiple owners are active, report `incompatible` and stop. If none is active, use Pi's native compaction.

## Overlap guard

Gentle AI/gentle-pi and Engram remain the host's continuity, memory and review integration. PiWorkflow remains the workflow control plane. Do not install Wizard-AI's overlapping memory, workflow, proxy, or provider-routing components when those capabilities are already supplied by the installed Gentle/Pi stack. Keep Wizard-AI limited to explicitly requested, independently missing tools and use its official installer only when the dependency set is acceptable; otherwise record the capability as `blocked` or use the documented fallback. Do not install legacy `@adamjen/pi-vcc` while another compaction owner is active.

