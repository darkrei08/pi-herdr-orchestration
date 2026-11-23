import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const MARKER = "<!-- herdr-workflow-autostart -->";
export const DIRECTIVE = `${MARKER}
P-Header Orchestrations (pi-herdr-orchestrator) starts work through PiWorkflow (pi-extensible-workflows): foreground: true, no budget, omit timeoutMs. Read context before routing: AGENTS.md and the files it points to, the relevant phase reference, and Engram memory when available; never route from request text alone.
Context tools: use @sting8k/pi-vcc for compaction and vcc_recall; use gentle-engram for persistent memory; use builtin:codemode and builtin:tool-search for bounded tool scripts. Keep the active context at or below 300000 tokens; compaction triggers at 276000.
Root default: gentle-ai+issue-ops. Child agents: pi-ext-roles role, skills pi-herdr-orchestrator+engineering-excellence plus one installed task skill (tdd, code-review, diagnosing-bugs, pr, container-test-matrix), extensions builtin:codemode,builtin:tool-search,builtin:mcp, isolated worktree. Name only installed skills (work-unit-commits, chained-pr, judgment-day, gentle-ai-branch-pr, issue-ops); never branch-pr, issue-creation, sdd-*, systemic-issue-triage or issue-root-resolution. Matt wayfinder, to-spec, to-tickets, handoff and retro stay in the master session and are invoked explicitly.`;
export const withDirective = (prompt) => (prompt.includes(MARKER) ? prompt : prompt ? `${prompt}\n\n${DIRECTIVE}` : DIRECTIVE);

export function registryCandidates({ resolve = (spec) => import.meta.resolve(spec), require, exists = existsSync, localForks, warn = () => {}, home = homedir() } = {}) {
  const candidates = [];
  try { candidates.push(resolve("pi-extensible-workflows/registry")); } catch (error) { warn(`registry resolution failed: ${error.message}`); }
  const agentRequire = require ?? createRequire(join(home, ".pi", "agent", "npm", "package.json"));
  try { candidates.push(pathToFileURL(agentRequire.resolve("pi-extensible-workflows/registry")).href); } catch (error) { warn(`npm registry resolution failed: ${error.message}`); }
  for (const candidate of localForks ?? [join(home, "git", "fork", "vekexasia", "pi-extensible-workflows", ".worktrees", "herdr-inline-prompt-64", "packages", "core", "dist", "src", "registry.js")]) if (exists(candidate)) candidates.push(pathToFileURL(candidate).href);
  return candidates;
}
export const resolveRegistryUrl = async (options = {}) => registryCandidates(options)[0] ?? null;

export default async function registerWorkflowAutostart(pi, options = {}) {
  pi.on("before_agent_start", (event) => event.messageType !== "user" || event.systemPrompt?.includes(MARKER) ? undefined : { systemPrompt: withDirective(event.systemPrompt ?? "") });
  const warn = options.warn ?? ((message) => process.emitWarning(`[HERDR_AUTOSTART] ${message}`));
  const candidates = options.candidateUrls ?? registryCandidates({ warn, ...options });
  const importModule = options.importModule ?? ((url) => import(url));
  let registry;
  for (const candidate of candidates) try { registry = await importModule(candidate); break; } catch (error) { warn(`registry import failed for ${candidate}: ${error.message}`); }
  if (!registry) { warn("registry unavailable; auto-start hooks were not registered"); return; }
  if (!registry.registerWorkflowExtension) { warn("registry does not expose registerWorkflowExtension"); return; }
  registry.registerWorkflowExtension({ version: JSON.parse((options.readPackage ?? (() => readFileSync(new URL("../package.json", import.meta.url), "utf8")))()).version, headline: "Pi Herdr workflow auto-start", source: import.meta.url, agentPreparationHooks: { herdrWorkflowLoadout: { priority: Number.MAX_SAFE_INTEGER - 1, prepare: (configuration) => { configuration.systemPromptAppend = withDirective(configuration.systemPromptAppend ?? ""); } } } });
}
