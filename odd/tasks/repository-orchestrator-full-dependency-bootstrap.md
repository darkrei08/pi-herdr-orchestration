# Repository Orchestrator full dependency bootstrap

## Goal
Make the skill installation flow provision every supported non-overlapping dependency through its official installer, following Vekexasia's dotenv ownership model.

## Scope
- Add an explicit, idempotent bootstrap command for dependencies that the Skills CLI cannot install.
- Keep `pi-codex-context` as the sole Pi compaction owner; do not install `@sting8k/pi-vcc` alongside it.
- Cover Wizard-AI, PiWorkflow, TOON/LEA, RTK/sqz, Serena, graphify/graphifyy and LLMLingua through official sources or Wizard-AI's official manager.
- Update README, skill references and capability detection so managed dependencies are visible and verifiable.
- Preserve unrelated working-tree changes.

## Acceptance checks
- One documented install flow installs the skill and then runs the dependency bootstrap with an explicit apply mode.
- The bootstrap skips already-installed capabilities and reports overlap-owned or unavailable standalone components instead of guessing.
- The Vekexasia dotenv model is recorded: PiWorkflow ownership stays with its existing manager and `pi-codex-context` owns compaction.
- Dry-run, apply safety checks, capability report and focused tests pass.
- No commit or push without explicit authorization.

## Status
- [x] Define ownership and installer matrix.
- [x] Implement dependency bootstrap command.
- [x] Update documentation and capability report.
- [x] Install authorized non-overlapping dependencies and verify.

## Evidence
- Vekexasia dotenv's `pi/agent/pi-packages.txt` explicitly drops `@sting8k/pi-vcc` because it conflicts with `pi-codex-context`.
- Vekexasia `setup_env.sh` treats PiWorkflow as manager-owned and installs Pi packages idempotently through `pi install`.
- Wizard-AI's official setup owns graphifyy, LLMLingua, sqz and Serena; TOON/LEA are context adapters without standalone installers.
- The Vercel Skills CLI installs skill files only and cannot run third-party post-install hooks.
- `bootstrap-dependencies.mjs --apply` installed graphifyy/graphify 0.9.69, LLMLingua 0.2.2 in `/root/.wizard-ai/venv`, and Serena 1.7.0; existing Wizard-AI 0.49.0, PiWorkflow 5.17.1, RTK 0.50.0 and sqz 1.9.0 were detected and skipped.
- Final checks passed: strict capability report, JSON report, bootstrap help/dry-run, Node syntax check, `git diff --check`, and the Debian/Ubuntu/Fedora/Arch/openSUSE/Alpine container matrix.
- Native Gentle review approved and acknowledged the candidate; informational reliability findings remain non-blocking.
- Published after explicit authorization: the implementation is part of squashed commit `35d3363`, merged into `main`.
