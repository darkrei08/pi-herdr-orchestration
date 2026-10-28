import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { join } from "node:path";
import { inspectRegistry } from "./check-mcp.mjs";

const root = join(import.meta.dirname, "../../..");
const read = (path) => readFileSync(join(root, path), "utf8");

test("trusted project settings enable fully inspectable Herdr workflow agents", () => {
  const settings = JSON.parse(read(".pi/pi-extensible-workflows/settings.json"));
  assert.equal(settings.extensionSettings?.herdr?.enableFullyInspectableMode, true);
});

test("dispatch contract names deterministic workflow fan-out and explicit role loadout", () => {
  const skill = read("skills/pi-herdr-orchestrator/SKILL.md");
  const routing = read("skills/pi-herdr-orchestrator/references/routing.md");
  const execution = read("skills/pi-herdr-orchestrator/references/execution.md");
  const readme = read("README.md");
  const environment = read("skills/pi-herdr-orchestrator/scripts/check-environment.mjs");

  assert.match(skill, /named workflow/);
  assert.match(skill, /parallel\(/);
  assert.match(skill, /#1/);
  assert.match(skill, /subagents_run/);
  assert.match(skill, /forbidden/);
  for (const source of [skill, routing, readme]) {
    assert.match(source, /role:\s*["'][a-z-]+["']/);
    assert.match(source, /builtin:codemode/);
    assert.match(source, /builtin:tool-search/);
    assert.match(source, /builtin:mcp/);
    assert.match(source, /timeoutMs/);
  }
  assert.match(execution, /pi-ext-roles.*role/);
  assert.match(execution, /builtin:codemode/);
  assert.match(execution, /builtin:tool-search/);
  assert.match(execution, /builtin:mcp/);
  assert.match(execution, /600 seconds/);
  assert.match(routing, /skills:\s*\[/);
  assert.match(routing, /extensions:\s*\[/);
  assert.match(routing, /label/);
  assert.match(execution, /numbered/);
  assert.match(execution, /worktree/);
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
