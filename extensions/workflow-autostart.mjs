const MARKER = "<!-- pi-herdr-orchestrator/workflow-autostart -->";
const DIRECTIVE = [
  MARKER,
  "P-Header Orchestrations is pi-herdr-orchestrator. P Workflow Extensible is Vekexasia's pi-extensible-workflows extension.",
  "PiWorkflow auto-start is owned by pi-herdr-orchestrator in this repository.",
  "For repository work, always start the workflow through the pi-extensible-workflows `workflow` tool before delegating or editing. Launch it with `foreground: true` and no budget; omit timeoutMs on child agents because Vekexasia's runner treats omission as no timer.",
  "Do not ask for manual 'esegui questo' approval to start a workflow, and do not start a competing workflow-intent catalog route. Ordinary conversational answers with no repository or tool work keep the current behavior.",
].join("\n");

export default function registerWorkflowAutostart(pi) {
  pi.on("before_agent_start", (event) => {
    if (event.messageType !== "user") return;
    const existing = event.systemPrompt ?? "";
    if (existing.includes(MARKER)) return;
    return { systemPrompt: existing ? `${existing}\n\n${DIRECTIVE}` : DIRECTIVE };
  });
}
