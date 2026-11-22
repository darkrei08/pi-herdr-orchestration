import { readFileSync } from "node:fs";

const MARKER = "<!-- herdr-workflow-autostart -->";
const DIRECTIVE = `${MARKER}
P-Header Orchestrations (pi-herdr-orchestrator) starts work through PiWorkflow (pi-extensible-workflows): foreground: true, no budget, omit timeoutMs.
Read context before routing: AGENTS.md and the files it points to, the relevant phase reference, and Engram memory when available; never route from request text alone.
Root default: gentle-ai+issue-ops. Child agents: pi-ext-roles role, skills pi-herdr-orchestrator+engineering-excellence plus one installed task skill (tdd, code-review, diagnosing-bugs, pr, container-test-matrix), extensions builtin:codemode,builtin:tool-search,builtin:mcp, isolated worktree. Name only installed skills (work-unit-commits, chained-pr, judgment-day, gentle-ai-branch-pr, issue-ops); never branch-pr, issue-creation, sdd-*, systemic-issue-triage or issue-root-resolution. Matt wayfinder, to-spec, to-tickets, handoff and retro stay in the master session and are invoked explicitly.`;

export default async function registerWorkflowAutostart(pi) {
  pi.on("before_agent_start", (event) => {
    if (event.messageType !== "user") return;
    const existing = event.systemPrompt ?? "";
    if (existing.includes(MARKER)) return;
    return { systemPrompt: existing ? `${existing}\n\n${DIRECTIVE}` : DIRECTIVE };
  });
  let registryUrl;
  try {
    registryUrl = import.meta.resolve("pi-extensible-workflows/registry");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ERR_MODULE_NOT_FOUND") return;
    throw error;
  }
  const { registerWorkflowExtension } = await import(registryUrl);
  const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  registerWorkflowExtension({
    version: manifest.version,
    headline: "Pi Herdr workflow auto-start",
    source: import.meta.url,
    agentPreparationHooks: {
      herdrWorkflowLoadout: {
        priority: Number.MAX_SAFE_INTEGER - 1,
        prepare(configuration) {
          if (!configuration.systemPromptAppend.includes(MARKER)) configuration.systemPromptAppend += `\n${DIRECTIVE}`;
        },
      },
    },
  });
}
