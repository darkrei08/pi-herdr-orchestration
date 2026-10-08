# Bootstrap, capability discovery, and repository initialization

Inspect the actual machine before planning. The setup process consists of two distinct stages:

1. **System & Skills Bootstrap (`bootstrap-dependencies.mjs`):** Installs missing agent runtimes, CLI utilities, and adds the required skill suites (Engineering Excellence, Matt Pocock, Gentle AI, and Pi Herdr Orchestration).
2. **Per-Repository Initialization (`init-repository.mjs`):** Initializes and verifies all integrated tools for the specific repository or project.

From a checkout or project root, use this flow:

```bash
# 1. Install or update the orchestration skill
npx skills add darkrei08/pi-herdr-orchestration --skill pi-herdr-orchestrator --agent pi --global

# 2. Bootstrap missing system runtimes and required skill suites
node skills/pi-herdr-orchestrator/scripts/bootstrap-dependencies.mjs
node skills/pi-herdr-orchestrator/scripts/bootstrap-dependencies.mjs --apply

# 3. Initialize the target repository
node skills/pi-herdr-orchestrator/scripts/init-repository.mjs
node skills/pi-herdr-orchestrator/scripts/init-repository.mjs --apply
```

The bootstrap defaults to a read-only dry run. `--apply` is required for mutations. It prints a compact plan, detects commands and configuration before installing, inherits stdio for real installers, and exits nonzero only for an apply-time command failure or required postcondition failure. It covers Gentle AI/Engram, Guardian Angel and Herdr in addition to the context and reduction tools. It refuses the full Wizard-AI setup when Gentle or PiWorkflow already owns an overlapping responsibility.

## Mandatory Per-Repository Initialization

Every repository managed by Pi Herdr Orchestrator must be initialized using `init-repository.mjs --apply`. This script provisions:

- **Git Baseline:** Ensures a Git repository exists on branch `main` and creates `.worktrees/`.
- **Gitignore Policies:** Ensures `.worktrees/`, `.codegraph/`, and `.atl/` are excluded from Git.
- **Engram Memory Identity:** Establishes `.git/engram-project-identity.json` with a dedicated UUID and project name so memories are strictly scoped.
- **Guardian Angel Gate:** Generates `.gga` configuration and baseline repository `AGENTS.md` guidelines.
- **Semantic Code Navigation:** Creates `.serena` project configuration for language-server symbol exploration.
- **Token Compression:** Deploys local `sqz` and `rtk` hooks to compress terminal and tool outputs.
- **Herdr Workspace:** Registers a named Herdr workspace pointing to the repository path.
- **Skill Registry:** Renders `.atl/skill-registry.md` to catalog all accessible agent skills.

## Ownership and managers

- `pi-codex-context` in `~/.pi/agent/packages/pi-codex-context` is the sole Pi compaction owner under Vekexasia's dotenv model. The bootstrap reports Pi VCC as intentionally skipped and never installs `@sting8k/pi-vcc`.
- PiWorkflow is manager-owned when an existing Pi package or configuration is present. Otherwise use the official `pi install npm:pi-extensible-workflows` command.
- Wizard-AI manages TOON/LEA and its graphifyy/LLMLingua context stack. There is no standalone LEA installer. When Wizard-AI is missing, use the official setup command:

```bash
npx --no-cache -y @darkrei08/wizard-ai-cli@latest setup --verbose
```

If Wizard-AI remains present but graphify or LLMLingua is missing, use the documented manager commands rather than guessing another package:

```bash
uv tool install --force 'graphifyy[all]'
uv pip install --python <Wizard-AI-venv-python> llmlingua
```

The capability report detects Wizard-AI venv imports without printing environment contents or secrets.

## Gentle AI and Engram

On POSIX, when no existing `gentle-pi`, `gentle-engram` or PiWorkflow owner is detected, the bootstrap runs the official Gentle AI installer and then installs its Pi integration only when that integration is missing:

```bash
curl -fsSL https://raw.githubusercontent.com/Gentleman-Programming/gentle-ai/main/scripts/install.sh | bash
gentle-ai install --agent pi
```

An existing Gentle owner is manager-owned; the bootstrap does not add a duplicate memory/workflow stack. No official compatible Windows installer is documented for this row, so Windows is reported as `BLOCKED`. The Vekexasia dotenv rule remains unchanged: `pi-codex-context` owns compaction and Pi VCC is never installed.

## Guardian Angel and Herdr

GGA is installed as an executable only. On POSIX, the bootstrap uses the already-installed Homebrew command when available, otherwise the official repository clone and installer:

```bash
brew install gentleman-programming/tap/gga
tmpdir="$(mktemp -d)" && trap 'rm -rf "$tmpdir"' EXIT && git clone --depth 1 https://github.com/Gentleman-Programming/gentleman-guardian-angel "$tmpdir/gga" && (cd "$tmpdir/gga" && ./install.sh)
gga version
```

The two GGA installation choices are alternatives. The bootstrap never runs `gga init` or `gga install`, because those mutate repository hooks/config. No official compatible GGA installer is documented for Windows, so Windows is reported as `BLOCKED`.

Herdr uses the official installer and verifies the command without enabling integrations or plugins:

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

Missing `curl`, `sh`, `bash`, `git`, `mktemp` or PowerShell prerequisites are reported as `BLOCKED`; the bootstrap does not silently fall back.

## Official standalone installers

RTK, sqz and Serena remain independently verifiable. Run only missing rows:

```bash
# POSIX
curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/master/install.sh | sh
rtk init --global
curl -fsSL https://raw.githubusercontent.com/ojuschugh1/sqz/main/install.sh | sh
sqz init --global
uv tool install -p 3.13 serena-agent
serena init
```

```powershell
# Windows
winget install rtk-ai.rtk
rtk init -g
irm https://raw.githubusercontent.com/ojuschugh1/sqz/main/install.ps1 | iex
sqz init --global
uv tool install -p 3.13 serena-agent
serena init
```

On Windows the bootstrap uses PowerShell for the documented pipelines and reports `BLOCKED` when PowerShell or WinGet is unavailable. On POSIX it reports `BLOCKED` when `curl` or `sh` is unavailable. It does not silently substitute another installer.

## Capability discovery

Run the read-only report when a checkout is available:

```bash
node skills/pi-herdr-orchestrator/scripts/check-environment.mjs --json
node skills/pi-herdr-orchestrator/scripts/check-environment.mjs --strict
```

It checks Pi, PiWorkflow, Gentle/Engram, the GitHub CLI, Docker and Docker Compose, the Engineering Excellence, Matt Pocock and Gentle AI skill families, Wizard-AI, TOON/LEA, graphify/graphifyy, LLMLingua, RTK, sqz, Serena, Guardian Angel, Herdr, skill roots, the Vekexasia `pi-codex-context` package path, and the active compaction owner. Missing optional tools select documented fallbacks; overlapping owners are `incompatible`.
