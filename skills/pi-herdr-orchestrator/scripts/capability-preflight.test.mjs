import assert from "node:assert/strict";
import { test } from "node:test";
import { inspectLiveAgentCapabilities } from "./capability-preflight.mjs";

function context(overrides = {}) {
  return {
    options: {},
    defaults: {
      model: { provider: "provider", model: "root-model" },
    },
    capabilities: {
      tools: [],
      skills: ["available-skill"],
      extensions: ["builtin:codemode"],
    },
    availableModels: new Set(["provider/root-model"]),
    ...overrides,
  };
}

test("reports live capability gaps separately from installed package inventory", () => {
  const report = inspectLiveAgentCapabilities({
    context: context({ options: { role: "developer" } }),
    configuration: {
      model: "provider/missing-model:high",
      skills: ["!*", "missing-skill"],
      extensions: ["!*", "builtin:missing"],
    },
    roleHookAvailable: true,
  });

  assert.equal(report.source, "AgentPreparationContext");
  assert.equal(report.live.role.status, "delegated-to-pi-ext-roles");
  assert.deepEqual(report.missing, [
    { kind: "model", name: "provider/missing-model" },
    { kind: "skill", name: "missing-skill" },
    { kind: "extension", name: "builtin:missing" },
  ]);
});

test("does not treat wildcard or excluded selectors as unavailable capabilities", () => {
  const report = inspectLiveAgentCapabilities({
    context: context({ options: { role: "developer" } }),
    configuration: {
      skills: ["!*", "available-skill", "*", "!optional-skill"],
      extensions: ["!*", "builtin:codemode", "builtin:*", "!builtin:optional"],
    },
    roleHookAvailable: true,
  });

  assert.deepEqual(report.missing, []);
  assert.equal(report.live.skills.status, "available");
  assert.equal(report.live.extensions.status, "available");
});

test("blocks a requested role when the pi-ext-roles hook is not live", () => {
  const report = inspectLiveAgentCapabilities({
    context: context({ options: { role: "developer" } }),
    configuration: {
      skills: ["!*"],
      extensions: ["!*"],
    },
    roleHookAvailable: false,
  });

  assert.deepEqual(report.missing, [{ kind: "role", name: "developer" }]);
  assert.equal(report.live.role.status, "unavailable");
});
