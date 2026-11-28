import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { resolveTicketSupervision, thinkingLevel } from "./resolve-ticket-supervision.mjs";

const protocol = readFileSync(new URL("../references/state-protocol.md", import.meta.url), "utf8");

test("state protocol documents the portable reviewer-profile digest", () => {
  assert.match(protocol, /recomputes the configuration digest from candidate `AGENTS\.md` and the tracked `skills\/pi-herdr-orchestrator\/reviewer-profile\.gga`/);
  assert.match(protocol, /machine-local `\.gga` bytes are intentionally excluded/);
  assert.doesNotMatch(protocol, /candidate `AGENTS\.md` plus the current project `\.gga` bytes/);
});

function readJson(relativePath) {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8"));
}

test("ticket supervision config references pi-ext-roles aliases without duplicating models", () => {
  const config = readJson("../../../config/ticket-supervision.json");
  assert.equal(config.schema, "pi-herdr-orchestration/ticket-supervision/v1");
  assert.equal(config.aliasSource, "pi-ext-roles.modelAliases");
  assert.notEqual(config.producer.role, config.supervisor.role);
  assert.notEqual(config.producer.alias, config.supervisor.alias);
  assert.doesNotMatch(JSON.stringify(config), /opencode-go|cliproxyapi|deepseek|gemini|claude/);
  assert.equal(thinkingLevel("provider/model:high"), "high");
  assert.equal(thinkingLevel("provider/model"), null);
});

test("ticket supervision resolves roles from pi-ext-roles settings and blocks identical models", () => {
  const dir = mkdtempSync(join(tmpdir(), "ticket-supervision-"));
  const configPath = join(dir, "config.json");
  const settingsPath = join(dir, "settings.json");
  const config = {
    schema: "pi-herdr-orchestration/ticket-supervision/v1",
    aliasSource: "pi-ext-roles.modelAliases",
    producer: { role: "developer", alias: "developer-model" },
    supervisor: { role: "reviewer", alias: "reviewer-model" },
  };

  try {
    writeFileSync(configPath, JSON.stringify(config));
    writeFileSync(settingsPath, JSON.stringify({
      modelAliases: {
        "developer-model": "opencode-go/deepseek-v4.1-flash:high",
        "reviewer-model": "cliproxyapi/gemini-4-hydrogen-xhigh",
      },
    }));

    const resolved = resolveTicketSupervision(configPath, settingsPath);
    assert.equal(resolved.producer.model, "opencode-go/deepseek-v4.1-flash:high");
    assert.equal(resolved.producer.effort, "high");
    assert.equal(resolved.supervisor.model, "cliproxyapi/gemini-4-hydrogen-xhigh");
    assert.equal(resolved.supervisor.effort, null);
    assert.notEqual(resolved.producer.model, resolved.supervisor.model);

    writeFileSync(settingsPath, JSON.stringify({
      modelAliases: {
        "developer-model": "shared/model:high",
        "reviewer-model": "shared/model:high",
      },
    }));
    assert.throws(() => resolveTicketSupervision(configPath, settingsPath), /TICKET_SUPERVISION_NOT_DISTINCT/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("flow phases place supervise between spec and implement", () => {
  const phases = readJson("../../../scripts/flow-phases.json");
  const ids = phases.phases.map((phase) => phase.id);
  assert.equal(ids[ids.indexOf("spec") + 1], "supervise");
  assert.equal(ids[ids.indexOf("supervise") + 1], "implement");
});

test("reviewer profile points at the supervisor alias", () => {
  const profile = readFileSync(new URL("../reviewer-profile.gga", import.meta.url), "utf8");
  assert.match(profile, /^PROVIDER="kilo:reviewer-model"$/m);
});
