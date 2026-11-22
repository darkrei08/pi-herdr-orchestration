import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { join } from "node:path";
import { inspectRegistry } from "./check-mcp.mjs";

const root = join(import.meta.dirname, "../../..");
const read = (path) => readFileSync(join(root, path), "utf8");

test("trusted project settings select the pane topology for Herdr workflow agents", () => {
  const settings = JSON.parse(read(".pi/pi-extensible-workflows/settings.json"));
  assert.equal(settings.extensionSettings?.herdr?.enableFullyInspectableMode, false);
});

test("workflow auto-start has one repo-owned extension", () => {
  const manifest = JSON.parse(read("package.json"));
  const owner = JSON.parse(read(".pi/workflow-owner.json"));
  const autostart = read("extensions/workflow-autostart.mjs");
  assert.ok(manifest.pi.extensions.includes("./extensions/workflow-autostart.mjs"));
  assert.equal(owner.workflowOwner, "pi-herdr-orchestrator");
  assert.match(autostart, /before_agent_start/);
  assert.match(autostart, /registerWorkflowExtension/);
  assert.match(autostart, /agentPreparationHooks/);
  assert.match(autostart, /foreground: true/);
  assert.match(autostart, /omit timeoutMs/);
  assert.match(autostart, /no budget/);
  assert.match(autostart, /pi-ext-roles/);
  assert.match(autostart, /pi-herdr-orchestrator/);
  assert.match(autostart, /builtin:codemode/);
  assert.match(autostart, /builtin:tool-search/);
  assert.match(autostart, /builtin:mcp/);
  assert.ok(autostart.trim().split("\n").length <= 40);
});

test("dispatch contract names deterministic workflow fan-out and explicit role loadout", () => {
  const skill = read("skills/pi-herdr-orchestrator/SKILL.md");
  const routing = read("skills/pi-herdr-orchestrator/references/routing.md");
  const execution = read("skills/pi-herdr-orchestrator/references/execution.md");
  const dispatch = read("skills/pi-herdr-orchestrator/references/dispatch.md");
  const readme = read("README.md");
  const smallBusiness = read("skills/anthropic-small-business-pi/SKILL.md");
  const environment = read("skills/pi-herdr-orchestrator/scripts/check-environment.mjs");

  assert.match(skill, /named workflow/);
  assert.match(skill, /parallel\(/);
  assert.match(skill, /herdr pane split/);
  assert.match(skill, /herdr pane zoom/);
  assert.match(skill, /subagents_run/);
  assert.match(skill, /forbidden/);
  for (const source of [skill, routing, readme]) {
    assert.match(source, /role:\s*["'][a-z-]+["']/);
    assert.match(source, /builtin:codemode/);
    assert.match(source, /builtin:tool-search/);
    assert.match(source, /builtin:mcp/);
    assert.doesNotMatch(source, /timeoutMs:\s*\d/);
    assert.doesNotMatch(source, /bounded timeout/i);
  }
  assert.doesNotMatch(smallBusiness, /timeoutMs:\s*\d/);
  assert.doesNotMatch(smallBusiness, /bounded timeout/i);
  assert.match(execution, /pi-ext-roles.*role/);
  assert.match(execution, /builtin:codemode/);
  assert.match(execution, /builtin:tool-search/);
  assert.match(execution, /builtin:mcp/);
  assert.match(execution, /omit timeoutMs/);
  assert.match(execution, /foreground: true/);
  assert.match(execution, /no budget/);
  assert.match(routing, /skills:\s*\[/);
  assert.match(routing, /extensions:\s*\[/);
  assert.match(routing, /label/);
  assert.match(execution, /pane tree/);
  assert.match(execution, /worktree/);
  assert.match(dispatch, /### Directive envelope/);
  assert.match(dispatch, /canonical source remains a validated JSON/);
  assert.match(dispatch, /no structured-directive consumer/);
  assert.match(environment, /@piewf\/pi-ext-roles/);
});

test("MCP checker reports reachability without leaking registry secrets", async () => {
  const report = await inspectRegistry({
    mcpServers: {
      local: { command: "node", args: ["--version", "SECRET_ARG"] },
      remote: { url: "https://example.test/mcp?token=SECRET_TOKEN#fragment" },
    },
  }, {
    resolveExecutable: () => "/usr/bin/node",
    fetchImpl: async (url, options) => {
        assert.equal(url, "https://example.test/mcp");
      assert.equal(options.method, "POST");
      assert.equal(options.headers.accept, "application/json, text/event-stream");
      assert.equal(options.headers["content-type"], "application/json");
      assert.match(options.body, /"method":"initialize"/);
      return { status: 200, text: async () => 'data: {"result":{"protocolVersion":"2025-06-18"}}' };
    },
    timeoutMs: 100,
  });

  assert.deepEqual(report.summary, { configured: 2, reachable: 2, healthy: 1, unhealthy: 0, unverified: 1, unreachable: 0 });
  assert.equal(report.configured_servers[0].command, "node");
  assert.equal(report.configured_servers[0].health, "unverified");
  assert.equal(report.configured_servers[1].url, "https://example.test/mcp");
  assert.equal(report.configured_servers[1].health, "ok");
  assert.doesNotMatch(JSON.stringify(report), /SECRET/);
});

test("MCP checker distinguishes transport reachability from HTTP health", async () => {
  const report = await inspectRegistry({
    mcpServers: { endpoint: { url: "https://example.test/mcp" } },
  }, {
    fetchImpl: async () => ({ status: 404 }),
    timeoutMs: 100,
  });

  assert.equal(report.configured_servers[0].reachable, true);
  assert.equal(report.configured_servers[0].health, "unhealthy");
  assert.equal(report.summary.unhealthy, 1);
});

test("repository initialization owns the project workflow settings contract", () => {
  const init = read("skills/pi-herdr-orchestrator/scripts/init-repository.mjs");
  assert.match(init, /pi-extensible-workflows/);
  assert.match(init, /enableFullyInspectableMode/);
  assert.ok(existsSync(join(root, ".pi/pi-extensible-workflows/settings.json")));
});

test("native extension exposes bounded graph status and step controls", () => {
  const extension = read("extensions/index.mjs");
  assert.match(extension, /name: "orch_graph_status"/);
  assert.match(extension, /name: "orch_graph_step"/);
  assert.match(extension, /loadGraphState/);
  assert.match(extension, /persistGraphState/);
  assert.match(extension, /projectHerdrState/);
});
