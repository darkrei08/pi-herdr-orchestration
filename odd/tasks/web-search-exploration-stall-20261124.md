# Wayfinder: resolve web-search tool and exploration-budget workflow stall

Read this document through `## Log` before acting.

## Specs

- S1: "mcp__web_search"
- S2: "Tool mcp__web_search not found"
- S3: "GLM 5.4 release z.ai"
- S4: "GLM-5.4 model announcement November 2026"
- S5: "z.ai GLM 5.4 pricing context window"
- S6: "numResults": 10
- S7: "Aggiungi anche il task `[gentle-pi.exploration-budget]`."
- S8: "Aggiungi alla mappa wayfinder un ticker per lo stallo di questo workflow."
- S9: "Se lo strumento non esiste, verifica gli strumenti disponibili. Non inventare risultati web e documenta ogni blocco."
- S10: "Exploration budget: 4 tracked lookups and 30,621 UTF-8 text bytes (an approximate evidence budget). Ongoing discovery needs one configured explorer, even if read-only or initially small. Preparation for an already-understood authorized inline write remains exempt."

## Tasks

- T1 | S1-S6,S9 | Reproduce missing `mcp__web_search`, inventory actual search tools/providers, and document the blocked GLM lookup without fabricated results | route: configured read-only explorer | commit: n/a (run 977212a5)
- T2 | S7-S10 | Inspect the exploration-budget enforcement and workflow lifecycle for the stall, then implement the smallest correction in this repository | route: inline documentation/test correction | commit: uncommitted working tree
- T3 | S7-S10 | Run focused and full checks, verify bounded lookup behavior and no false web results, and record remaining blockers | route: independent verifier | commit: n/a (run 927f7b0b)

## Log

- L1: "mcp__web_search" returned "Tool mcp__web_search not found" for the requested GLM 5.4 searches.
- L2: New operator task added to the Wayfinder map. No source changes for this task have been made yet.
- L3: Scout run 977212a5 reproduced the missing tool name safely. `mcp__web_search` is not registered; the host tool is `web_search`, and the configured MCP provider is `mcp__firecrawl_local__firecrawl_search`. No MCP server named `web_search` exists. The requested GLM search therefore remains BLOCKED through the missing name; no web result is claimed.
- L4: The exploration-budget notice is emitted by the installed gentle-pi harness when `lookups > 3` or `bytes > 40,000`, not by repository code and not by a workflow gate. The child continued and completed via Firecrawl; no workflow stall was reproduced. The explorer child lacked `tool_search` and `web_search` because its explicit workflow `tools` allowlist selected only read/grep/bash/codemode; extension selectors alone do not add host tools.
- L5: Added truthful tool-naming and explicit-search-tool guidance to `skills/pi-herdr-orchestrator/references/routing.md`, documented the advisory budget semantics in `skills/pi-herdr-orchestrator/references/odd-workflow.md`, and added routing assertions in `skills/pi-herdr-orchestrator/scripts/dispatch.test.mjs`. Created GitHub Wayfinder issue #62, `[gentle-pi.exploration-budget] Research dispatch uses an unavailable web-search tool name`, with the exact reproduction, blocked GLM lookup, provider inventory, and acceptance commands.
- L6: Independent verifier run 927f7b0b: S1, S2, S6, S9, and S10 PASS; S3-S5 correctly BLOCKED because `mcp__web_search` does not exist and no web results were fabricated; focused dispatch 8/8, full npm test 123/123, lint, strict required failures 0, context-window, MCP reachability, and diff checks PASS. The local task and issue #62 satisfy the Wayfinder ticker requirement; the live GLM searches remain intentionally unexecuted through the missing tool.
- L7: Issue #62 re-verified on this document at origin/main 25266d7. The repository guidance had already landed: f921c0d (`Refs #62`) added the runtime-specific tool-naming rule and the `mcp__web_search` prohibition to `skills/pi-herdr-orchestrator/references/routing.md` plus the advisory, non-gating reading of the exploration-budget notice in `skills/pi-herdr-orchestrator/references/odd-workflow.md`, and e480d70 added the matching assertions to `skills/pi-herdr-orchestrator/scripts/dispatch.test.mjs`. T4 therefore adds no new guidance: focused dispatch 9/9, `npm test` 145/145, `npm run lint` 47 files clean, `npm run check:strict` Required failures 0, `npm run check:context-window` PASS, `npm run check:mcp` 7/7 reachable (2 healthy, 5 unverified), `git diff --check` PASS. The L6 counts (8/8, 123/123) were current for that earlier verifier run. Live `web_search` execution through a configured provider was NOT RUN.
