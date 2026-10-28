---
name: anthropic-small-business-pi
description: Pi compatibility contract for Anthropic's Small Business skills. Use when routing or executing any of the official 44 Small Business skills from Pi Agent, PiWorkflow, or Herdr; it maps Claude-specific routing, approvals, memory, artifacts, and connector assumptions onto the current Pi runtime.
disable-model-invocation: true
---

# Anthropic Small Business on Pi

This is the Pi adapter for Anthropic's official `small-business` plugin. The upstream `SKILL.md` files remain the source of truth for operational behavior; this adapter supplies the runtime contract that Claude's plugin host normally provides.

## Runtime contract

1. Select the exact upstream skill by name, for example `smb-router`, `grow-pipeline`, `speed-to-lead`, `content-strategy`, `social-content-engine`, `review-reputation`, `proposal-builder`, `plan-payroll`, `build-agent`, or `build-connector`.
2. Run orchestration skills through a named PiWorkflow direct `agent(...)` call. Every child selects a `pi-ext-roles` role, the MCP bridge `builtin:codemode`, `builtin:tool-search`, and `builtin:mcp`, a bounded timeout of at least 600000 ms, and a named worktree when it writes.
3. Use `smb-router` only to choose one next skill. The Pi parent owns the workflow graph, approval checkpoints, worktree ownership, mailbox reporting, and final decision; the skill does not create native subagents or an alternate scheduler.
4. Use `pipeline(...)` for a fixed upstream chain such as `grow-pipeline` or `plan-payroll`; use `parallel(...)` only for independent research or validation legs. Pass structured outputs explicitly between stages.

## Host substitutions

| Claude Small Business assumption | Pi implementation |
| --- | --- |
| Slash command such as `/plan-payroll` | Explicit skill selector in a PiWorkflow child, with the route recorded in the workflow result |
| Claude session memory and `## Business context` | Engram/project memory plus the current workflow state; never invent missing business context |
| Cowork HTML artifact | Pi artifact/export tools or a repository-local output file selected by the user |
| Claude connector registration | Current Pi MCP registry and MCP bridge; a connector name is only available when the Pi registry exposes it |
| `Read`, `WebFetch`, `ToolSearch` frontmatter | Pi tool/extension selectors; upstream `allowed-tools` is treated as metadata and is not a permission grant |
| Claude approval checkpoint | Explicit Pi user decision or workflow checkpoint before a send, publish, payment, CRM write, payroll submission, or external mutation |
| Missing connector fallback | Uploaded CSV, pasted text, local files, read-only BrowserOS/Firecrawl research, or a clear `BLOCKED` report |

## Connector policy

The upstream plugin declares 35 remote MCP endpoints. Pi must not import or enable those endpoints automatically: most require authentication and several can send, publish, pay, or modify external data. Use only servers already present in the active Pi MCP registry, and report the missing category plus the designed fallback when a skill cannot complete its connector leg.

For a new connector, route to `build-connector` as a proposal and stop at the authentication or configuration boundary. Do not write credentials, invent OAuth state, or treat a URL in `.mcp.json` as proof that a server is authorized.

## Approval and evidence

- Draft first; approval is per consequential batch, not a blanket approval for the chain.
- Keep inferred contacts, unreadable figures, projected cash, and missing records explicitly labeled.
- Use `orch_report` for worker evidence and `orch_ask` for a blocking decision. The master reconciles Git, workflow state, and external effects before closure.
- Do not submit payroll, send outreach, publish content, pay bills, or write customer systems without the exact human approval required by the upstream skill.

## Verification

Run `node scripts/check-anthropic-small-business.mjs --json` before claiming the integration is available. It verifies the installed official source, all 44 canonical Pi skill copies, the adapter contract, and the non-import policy for Anthropic's remote MCP definitions.
