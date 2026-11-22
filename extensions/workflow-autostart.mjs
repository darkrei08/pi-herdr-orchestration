import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { pathToFileURL } from "node:url";

const MARKER = "<!-- herdr-workflow-autostart -->";
const DIRECTIVE = `${MARKER}
P-Header Orchestrations (pi-herdr-orchestrator) starts work through PiWorkflow (pi-extensible-workflows): foreground: true, no budget, omit timeoutMs. Read context before routing: AGENTS.md and the files it points to, the relevant phase reference, and Engram memory when available; never route from request text alone.
Root default: gentle-ai+issue-ops. Child agents: pi-ext-roles role, skills pi-herdr-orchestrator+engineering-excellence plus one installed task skill (tdd, code-review, diagnosing-bugs, pr, container-test-matrix), extensions builtin:codemode,builtin:tool-search,builtin:mcp, isolated worktree. Name only installed skills (work-unit-commits, chained-pr, judgment-day, gentle-ai-branch-pr, issue-ops); never branch-pr, issue-creation, sdd-*, systemic-issue-triage or issue-root-resolution. Matt wayfinder, to-spec, to-tickets, handoff and retro stay in the master session and are invoked explicitly.`;
const withDirective = (prompt) => (prompt.includes(MARKER) ? prompt : prompt ? `${prompt}\n\n${DIRECTIVE}` : DIRECTIVE);

export default async function registerWorkflowAutostart(pi) {
  pi.on("before_agent_start", (event) => {
    if (event.messageType !== "user" || event.systemPrompt?.includes(MARKER)) return;
    return { systemPrompt: withDirective(event.systemPrompt ?? "") };
  });
  let registryUrl;
  try {
    registryUrl = import.meta.resolve("pi-extensible-workflows/registry");
  } catch {
    try {
      registryUrl = pathToFileURL(createRequire(`${homedir()}/.pi/agent/npm/package.json`).resolve("pi-extensible-workflows/registry")).href;
    } catch (error) {
      process.emitWarning(`[HERDR_AUTOSTART] registry unavailable: ${error.message}`);
      return;
    }
  }
  let registry;
  try {
    registry = await import(registryUrl);
  } catch (error) {
    process.emitWarning(`[HERDR_AUTOSTART] registry import failed: ${error.message}`);
    return;
  }
  const { registerWorkflowExtension } = registry;
  if (!registerWorkflowExtension) return;
  registerWorkflowExtension({
    version: JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version,
    headline: "Pi Herdr workflow auto-start",
    source: import.meta.url,
    agentPreparationHooks: {
      herdrWorkflowLoadout: {
        priority: Number.MAX_SAFE_INTEGER - 1,
        prepare: (configuration) => { configuration.systemPromptAppend = withDirective(configuration.systemPromptAppend); },
      },
    },
  });
}
