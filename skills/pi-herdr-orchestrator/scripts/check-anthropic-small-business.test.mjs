import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { inspectSmallBusiness } from "./check-anthropic-small-business.mjs";

function skill(root, name, description = "Test skill") {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`);
}

test("accepts a complete canonical inventory and Pi adapter contract", () => {
  const root = mkdtempSync(join(tmpdir(), "small-business-check-"));
  const source = join(root, "source", "skills");
  const canonical = join(root, "canonical");
  mkdirSync(source, { recursive: true });
  mkdirSync(canonical, { recursive: true });
  skill(source, "smb-router");
  skill(source, "build-agent");
  skill(canonical, "smb-router");
  skill(canonical, "build-agent");
  const report = inspectSmallBusiness({
    sourceRoot: source,
    canonicalRoot: canonical,
    expectedSkillCount: 2,
    adapterText: "PiWorkflow pipeline builtin:codemode builtin:tool-search builtin:mcp approval fallback",
    sourceMcp: { mcpServers: { ledger: { type: "http", url: "https://example.test/mcp" } } },
    piMcp: { mcpServers: { context7: { command: "context7" } } },
  });

  assert.equal(report.valid, true);
  assert.deepEqual(report.missingCanonical, []);
  assert.equal(report.skillCount, 2);
  assert.equal(report.anthropicConnectorCount, 1);
  assert.deepEqual(report.piConfiguredAnthropicConnectors, []);
});

test("fails closed when a canonical skill is missing or the adapter lacks the MCP bridge", () => {
  const root = mkdtempSync(join(tmpdir(), "small-business-check-"));
  const source = join(root, "source");
  const canonical = join(root, "canonical");
  mkdirSync(source, { recursive: true });
  mkdirSync(canonical, { recursive: true });
  skill(source, "smb-router");
  skill(source, "build-agent");
  skill(canonical, "smb-router");
  const report = inspectSmallBusiness({
    sourceRoot: source,
    canonicalRoot: canonical,
    expectedSkillCount: 2,
    adapterText: "no bridge",
    sourceMcp: { mcpServers: {} },
    piMcp: { mcpServers: {} },
  });

  assert.equal(report.valid, false);
  assert.deepEqual(report.missingCanonical, ["build-agent"]);
  assert.deepEqual(report.adapterMissing, ["builtin:codemode", "builtin:tool-search", "builtin:mcp", "approval", "fallback"]);
});
