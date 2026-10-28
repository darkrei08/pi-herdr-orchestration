Feature: piworkflow-mcp-delegation
Owner: PiWorkflow with @piewf/pi-ext-roles; MCP servers must remain available in Pi sessions and workflow-owned child sessions.
Acceptance: no native standalone subagent delegation for orchestrated work; role-based workflow children use verified MCP-capable loadouts; timeout and MCP checks produce evidence.

## Specs

S1. "risolvi defintivamente questta delezaione sotto agentica"

S2. "io vorrei usare smepre pi worjfloe extensible con pi ext roles"

S3. "analizza nche il corretto funzioanmento dei server mcp, devono funzioanre smepre in qualsisi sessioen pi anceh sotto agentica"

S4. Observed failure: "✗ Subagent: OCR research [failed] mode=foreground runtime=2m 1s\n   AGENT_TIMEOUT: Agent attempt timed out"

S5. Observed failure: "✗ Subagent: Visual RAG research [failed] mode=foreground runtime=2m 1s\n   AGENT_TIMEOUT: Agent attempt timed out"

S6. "E quindi seguendo Excel Engine Engineering e le rispettive sottoskill procedi a eseguire le correzioni secondo quando individuato dal report che mi hai dato e procedi quindi poi a effettuare i commit locali seguendo audit, test, fin dando che poi tutto è perfettamente funzionante. Utilizzando appunto anche Pony Tail e dopodiché inizia a pushare nei rispettivi poi i commit. e se sono anche upstream verso repo remoti di altri fornitori perché i miei locali potrebbero essere dei fork allora devi procedere a creare delle pull request"

## Tasks

- T1 | S1-S2 | Make PiWorkflow direct workflow calls with pi-ext-roles the only orchestrated delegation path; document and test the prohibition on native subagents_run | commit: 5fd71c6
- T2 | S2-S3 | Ensure role-based workflow children receive MCP-capable tools and validate the configured MCP server set | commit: 5fd71c6
- T3 | S4-S5 | Add bounded timeout and MCP smoke checks, then run focused verification without changing provider credentials | commit: 5fd71c6
- T4 | S1-S3 | Reconcile global runtime configuration and preserve unrelated dirty repository state | commit: 5fd71c6
- T5 | S6 | Correct the audit findings with regression tests, commit coherent work units, and deliver only the authorized branch | commit: pending

## Log

L1. risolvi defintivamente questta delezaione sotto agentica
 ● Subagent: OCR research [running] mode=foreground runtime=33s
   ⠧

 ● Subagent: Visual RAG research [running] mode=foreground runtime=33s
   ⠧

L2. io vorrei usare smepre pi worjfloe extensible con pi ext roles

L3. analizza nche il corretto funzioanmento dei server mcp, devono funzioanre smepre in qualsisi sessioen pi anceh sotto agentica

L4. Verified current state: native foreground subagent attempts failed with AGENT_TIMEOUT at about 121 seconds. PiWorkflow and @piewf/pi-ext-roles are installed, Herdr inspectable mode is enabled, and the current role files omit builtin:codemode and builtin:mcp from their tool selectors. The active MCP registry is /root/.pi/agent/mcp.json.

L5. Final evidence: PiWorkflow default researcher role completed a read-only Context7 MCP workflow smoke. CLIProxyAPI preflight and inventory show all role aliases currently resolve to Pi-listed cliproxyapi routes; all 16 role diagnostics include codemode. The MCP registry checker reports 5/5 configured servers reachable at URL or executable level. npm test, strict capability check, syntax checks, and git diff check pass. BrowserOS/Firecrawl action calls were not executed because they may be authenticated or side-effecting; discovery and transport reachability passed.

L6. Audit correction evidence: added failing-first regression tests for run and evidence path traversal, explicit directory traversal, stale lock ownership, MCP HTTP health/protocol initialization, and secret redaction. Hardened mailbox inputs, lock ownership recovery, MCP initialize probing, local config ignores, and documentation. Final verification reports 19/19 tests pass, 5/5 MCP endpoints reachable, 2 HTTP MCP endpoints initialized, 3 stdio servers transport-only/unverified, strict checks pass, syntax checks pass, and diff checks pass. Native Gentle review could not start because the candidate view was rejected before lineage creation; the final source review and regression suite found no remaining confirmed security defect in the changed code.

L7. Delivery strategy: auto-chain. Slice 1 boundary is commit 5fd71c6 and contains the PiWorkflow, role, MCP checker, documentation, and task specification. Slice 2 contains the high-risk mailbox path and lock hardening plus regression tests and hygiene updates.
