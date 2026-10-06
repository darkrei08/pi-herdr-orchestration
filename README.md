# Pi Herdr Orchestrator

Deterministic multi-agent repository orchestration for issues, pull requests, development, testing, integration and cleanup. Dynamically coordinates available coding agents, skills, worktrees and development environments while preserving clear ownership, evidence-based validation and safe merge workflows.

The skill is provider-agnostic. It can run with plain Git and a single agent. PiWorkflow, Gentle/Engram, Herdr, Guardian Angel, Wizard-AI, and context tools are optional integrations discovered at runtime.

## Install

This repository does not require an npm package. Install the skill with the official Vercel Skills CLI:

```bash
# From GitHub, for all supported agent targets
npx skills add darkrei08/repository-orchestrator \
  --skill pi-herdr-orchestrator \
  --agent codex claude-code antigravity antigravity-cli pi \
  --global
```

For a local checkout:

```bash
npx skills add . \
  --skill pi-herdr-orchestrator \
  --agent codex claude-code antigravity antigravity-cli pi \
  --global
```

`skills add` installs skill files only. It deliberately does not execute arbitrary third-party installers or provide automatic postinstall hooks. After `skills add`, run the bootstrap; use `--apply` when missing dependencies should be installed:

```bash
node skills/pi-herdr-orchestrator/scripts/bootstrap-dependencies.mjs
node skills/pi-herdr-orchestrator/scripts/bootstrap-dependencies.mjs --apply
```

The first command is a read-only plan; `--apply` is required for mutations. The bootstrap detects installed commands and configuration before each action, reports blocked prerequisites, and rechecks required postconditions. It covers Gentle AI/Engram, Guardian Angel and Herdr as well as the existing Wizard-AI, PiWorkflow, context and reduction tools. It refuses the full Wizard-AI setup when Gentle or PiWorkflow already owns overlapping responsibilities; install only the non-overlapping context tools in that case.

## Install managed dependencies

The skill is usable with plain Git. The integrations below are optional, but every supported installer and verification command is explicit. Do not run an overlapping row: Gentle AI owns its Pi integrations, Engram owns durable memory, PiWorkflow owns workflow orchestration, and exactly one Pi compaction owner may be active. The bootstrap never installs `@sting8k/pi-vcc`: under Vekexasia's dotenv model, `pi-codex-context` is the sole compaction owner. An existing PiWorkflow package or configuration remains manager-owned; otherwise the bootstrap uses the official `pi install npm:pi-extensible-workflows` command.

### Base runtimes and distribution

```bash
# Pi coding agent, if `pi --version` is missing
npm install --global @mariozechner/pi-coding-agent

# Vercel Skills CLI, if `skills --version` is missing
npm install --global skills@latest

# PiWorkflow, if `pi-extensible-workflows` is missing
pi install npm:pi-extensible-workflows
```

Verify with:

```bash
pi --version
skills --version
node skills/pi-herdr-orchestrator/scripts/check-environment.mjs --strict
```

### Gentle AI and Engram

Install only when the capability report shows they are missing. The official Gentle AI installer provisions the Pi integrations, including `gentle-pi`, `gentle-engram`, and the MCP adapter; do not install those packages again individually:

```bash
curl -fsSL https://raw.githubusercontent.com/Gentleman-Programming/gentle-ai/main/scripts/install.sh | bash
gentle-ai install --agent pi
```

For an existing Gentle installation that only lacks Engram, use its official setup instead of a second memory stack:

```bash
engram setup pi
```

Verify:

```bash
gentle-ai --version
node skills/pi-herdr-orchestrator/scripts/check-environment.mjs --json
```

### Guardian Angel and Herdr

Guardian Angel (GGA) is installed only as an executable. On POSIX, use Homebrew only when it is already available; otherwise use the official repository installer:

```bash
# POSIX, if brew is already installed
brew install gentleman-programming/tap/gga

# POSIX fallback
tmpdir="$(mktemp -d)" && trap 'rm -rf "$tmpdir"' EXIT && git clone --depth 1 https://github.com/Gentleman-Programming/gentleman-guardian-angel "$tmpdir/gga" && (cd "$tmpdir/gga" && ./install.sh)

gga version
```

Do not run `gga init` or `gga install` from the dependency bootstrap. Those commands mutate the target repository's hooks/config and are intentionally left to an explicit repository setup step. No official compatible GGA installer is documented for Windows, so the bootstrap reports `BLOCKED` there.

Herdr uses its official installers without enabling integrations or plugins automatically:

```bash
# macOS/Linux
curl -fsSL https://herdr.dev/install.sh | sh
herdr --version
```

```powershell
# Windows PowerShell
irm https://herdr.dev/install.ps1 | iex
herdr --version
```

The bootstrap reports `BLOCKED` when the required POSIX shell tools or PowerShell are unavailable.

### Optional context and reduction tools

Wizard-AI is a manager for several tools, not an additional Gentle/Pi control plane. If Gentle AI, Engram, or PiWorkflow is already installed, do not run its full setup because it can provision overlapping memory, workflow, proxy, and provider-routing components. Use it only after reviewing those overlaps:

```bash
npx --no-cache -y @darkrei08/wizard-ai-cli@latest setup --verbose
```

The bootstrap uses Wizard-AI as the manager for TOON/LEA and its graphifyy/LLMLingua context stack. If Wizard-AI is missing and no Gentle/PiWorkflow owner would be overlapped, it runs the official setup above. If an overlap owner exists, it blocks the full setup and requires the non-overlapping commands below. If Wizard-AI remains present while graphify or LLMLingua is missing, it uses these exact manager-supported commands:

```bash
uv tool install --force 'graphifyy[all]'
uv pip install --python "$WIZARD_AI_DIR/venv/bin/python" llmlingua
```

The venv path is detected from the Wizard-AI installation; no system-wide LLMLingua fallback or standalone LEA installer is guessed. RTK, sqz and Serena use their own official installers when still missing:

```bash
# POSIX
curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/master/install.sh | sh
rtk init --global
curl -fsSL https://raw.githubusercontent.com/ojuschugh1/sqz/main/install.sh | sh
sqz init --global
uv tool install -p 3.13 serena-agent
serena init
```

On Windows, the documented PowerShell/WinGet commands are:

```powershell
winget install rtk-ai.rtk
rtk init -g
irm https://raw.githubusercontent.com/ojuschugh1/sqz/main/install.ps1 | iex
sqz init --global
uv tool install -p 3.13 serena-agent
serena init
```

If a required installer tool (`npx`, `pi`, `uv`, POSIX `curl`/`sh`/`bash`/`git`/`mktemp`, Windows `winget` or PowerShell) is unavailable, the bootstrap reports `BLOCKED` instead of silently falling back. Wizard-AI wrappers do not prove that RTK, sqz, Serena, graphify or LLMLingua is available; rerun the capability report.

The installer uses these global skill roots:

| Agent | Agent-specific root |
| --- | --- |
| Codex | `~/.codex/skills` |
| Claude Code | `~/.claude/skills` |
| Antigravity | `~/.gemini/config/skills` |
| Antigravity CLI | `~/.gemini/antigravity-cli/skills` |
| Pi | `~/.pi/agent/skills` |

The official CLI may instead install once in the shared `~/.agents/skills` root and expose the skill to several agents through links or its agent registry. Verify the actual resolution with the capability report before relying on a path.

## Verify

Run the read-only capability report from a checkout:

```bash
node skills/pi-herdr-orchestrator/scripts/check-environment.mjs --json
node skills/pi-herdr-orchestrator/scripts/check-environment.mjs --strict
```

The report checks:

- the skill, Node.js, and Git;
- Pi, PiWorkflow, Gentle/Engram, Guardian Angel, and Herdr;
- optional Wizard-AI, Serena, graphify, RTK, and sqz tools;
- Codex, Claude Code, Antigravity, and Antigravity CLI skill roots;
- the active Pi compaction owner.

Missing optional tools are reported, not treated as failures. `--strict` fails for a missing core runtime, conflicting compaction owners, or a missing skill.

## Runtime and dependency policy

The orchestrator is usable with plain Git. It never assumes that a command or integration exists because a package or repository is mentioned in a prompt.

At bootstrap it detects the installed implementation, version, supported operations, configuration, and constraints. It then chooses a documented fallback when an optional capability is missing. It does not install software silently.

Pi compaction is selected from active settings and hooks. Under Vekexasia's dotenv ownership model, `pi-codex-context` is the sole third-party owner and the bootstrap intentionally skips `@sting8k/pi-vcc`. The supported outcomes are:

- `pi-codex-context` as the configured third-party owner;
- Pi native compaction when no third-party owner is active;
- `incompatible` when multiple owners are active.

The orchestrator never runs a second compactor over the live transcript. Gentle AI/Engram and PiWorkflow remain authoritative when installed; Wizard-AI memory, workflow, proxy, or provider-routing components are not installed on top of them unless explicitly required and verified as non-overlapping.

## Layout

- `skills/pi-herdr-orchestrator/SKILL.md`: operational contract.
- `skills/pi-herdr-orchestrator/references/`: bootstrap, dependency, routing, state, execution, quality, memory, integration, and audit guidance.
- `skills/pi-herdr-orchestrator/scripts/check-environment.mjs`: read-only capability and host compatibility check.
- `skills/pi-herdr-orchestrator/agents/openai.yaml`: OpenAI/Codex metadata.

## Sources

The implementation follows the documented interfaces of these upstream projects:

- [Vercel Agent Skills CLI](https://github.com/vercel-labs/skills) for cross-agent skill installation.
- [OpenAI Codex skills](https://developers.openai.com/plugins/concepts/skills) for the `SKILL.md` skill contract.
- [Google Antigravity skills](https://antigravity.google/docs/skills) for Antigravity skill discovery.
- [Pi coding agent](https://github.com/badlogic/pi-mono) for Pi extensions and sessions.
- [Pi extensible workflows](https://github.com/vekexasia/pi-extensible-workflows) for workflow orchestration.
- [Gentle AI](https://github.com/Gentleman-Programming/gentle-ai) and its [Pi setup](https://github.com/Gentleman-Programming/gentle-ai#installation) for continuity and integration installation.
- [Gentle Engram](https://github.com/Gentleman-Programming/gentle-engram) and [Engram Pi setup](https://github.com/Gentleman-Programming/engram/blob/main/docs/AGENT-SETUP.md) for durable project memory.
- [Gentleman Guardian Angel](https://github.com/Gentleman-Programming/gentleman-guardian-angel) for the optional provider-agnostic quality gate.
- [Wizard-AI](https://github.com/darkrei08/Wizard-AI) for optional guided setup, TOON/LEA adapters and graphifyy/LLMLingua context tooling.
- [graphifyy](https://pypi.org/project/graphifyy/) and [LLMLingua](https://github.com/microsoft/LLMLingua) for the manager-supported context stack.
- [Herdr](https://herdr.dev/) and its [installation guide](https://herdr.dev/docs/install/) for optional workspace and tab management.
- [RTK installation](https://github.com/rtk-ai/rtk/blob/develop/docs/guide/getting-started/installation.md) for standalone output reduction.
- [sqz](https://github.com/ojuschugh1/sqz) for standalone output compression.
- [Serena installation](https://github.com/oraios/serena/blob/main/docs/02-usage/010_installation.md) for semantic navigation.
- [Vekexasia Pi extensible workflows](https://github.com/vekexasia/pi-extensible-workflows) and its dotenv ownership model for Pi package/compaction overlap policy.

Upstream availability and package versions can change. The runtime report and installed package metadata are authoritative; README links are references, not proof that a tool is installed.

## License

See [LICENSE](LICENSE).
