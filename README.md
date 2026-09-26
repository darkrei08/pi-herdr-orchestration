# Repository Orchestrator

A portable agent skill for coordinating repository maintenance, issue and PR work, isolated worktrees, verification, review, integration, and final audit.

The skill is provider-agnostic. It can run with plain Git and a single agent. PiWorkflow, Gentle/Engram, Herdr, Guardian Angel, Wizard-AI, and context tools are optional integrations discovered at runtime.

## Install

This repository does not require an npm package. Install the skill with the official Vercel Skills CLI:

```bash
# From GitHub, for all supported agent targets
npx skills add darkrei08/repository-orchestrator \
  --skill repository-orchestrator \
  --agent codex claude-code antigravity antigravity-cli \
  --global
```

For a local checkout:

```bash
npx skills add . \
  --skill repository-orchestrator \
  --agent codex claude-code antigravity antigravity-cli \
  --global
```

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
node skills/repository-orchestrator/scripts/check-environment.mjs --json
node skills/repository-orchestrator/scripts/check-environment.mjs --strict
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

Pi compaction is selected from active settings and hooks. The supported outcomes are:

- one configured third-party owner, such as `pi-codex-context` or `@sting8k/pi-vcc`;
- Pi native compaction when no third-party owner is active;
- `incompatible` when multiple owners are active.

The orchestrator never runs a second compactor over the live transcript. Gentle AI/Engram and PiWorkflow remain authoritative when installed; Wizard-AI memory, workflow, proxy, or provider-routing components are not installed on top of them unless explicitly required and verified as non-overlapping.

## Layout

- `skills/repository-orchestrator/SKILL.md`: operational contract.
- `skills/repository-orchestrator/references/`: bootstrap, dependency, routing, state, execution, quality, memory, integration, and audit guidance.
- `skills/repository-orchestrator/scripts/check-environment.mjs`: read-only capability and host compatibility check.
- `skills/repository-orchestrator/agents/openai.yaml`: OpenAI/Codex metadata.

## Sources

The implementation follows the documented interfaces of these upstream projects:

- [Vercel Agent Skills CLI](https://github.com/vercel-labs/skills) for cross-agent skill installation.
- [OpenAI Codex skills](https://developers.openai.com/plugins/concepts/skills) for the `SKILL.md` skill contract.
- [Google Antigravity skills](https://antigravity.google/docs/skills) for Antigravity skill discovery.
- [Pi coding agent](https://github.com/badlogic/pi-mono) for Pi extensions and sessions.
- [Pi extensible workflows](https://github.com/vekexasia/pi-extensible-workflows) for workflow orchestration.
- [Gentle AI](https://github.com/Gentleman-Programming/gentle-ai) and [Gentle Engram](https://github.com/Gentleman-Programming/gentle-engram) for continuity and memory integrations.
- [Gentleman Guardian Angel](https://github.com/Gentleman-Programming/gentleman-guardian-angel) for the optional provider-agnostic quality gate.
- [Wizard-AI](https://github.com/darkrei08/Wizard-AI) for optional guided setup and context tooling.
- [Herdr](https://herdr.dev/) for optional workspace and tab management.

Upstream availability and package versions can change. The runtime report and installed package metadata are authoritative; README links are references, not proof that a tool is installed.

## License

See [LICENSE](LICENSE).
