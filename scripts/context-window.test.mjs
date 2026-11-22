import assert from "node:assert/strict";
import test from "node:test";
import { evaluateContextWindow, MAX_CONTEXT_TOKENS, TARGET_TRIGGER_TOKENS } from "./check-context-window.mjs";

const config = {
  maxContextTokens: MAX_CONTEXT_TOKENS,
  targetTriggerTokens: TARGET_TRIGGER_TOKENS,
  minimumTriggerTokens: 256_000,
  scope: ["orchestrator", "child"],
  modelWindows: {
    "cliproxyapi/beam-free": 1_048_576,
    "cliproxyapi/gpt-6.1-sol": 500_000,
  },
};

test("accepts parent and child overrides that compact at 276000 tokens", () => {
  const settings = {
    compaction: {
      enabled: true,
      reserveTokens: 16_384,
      modelOverrides: {
        "cliproxyapi/beam-free": { reserveTokens: 772_576 },
        "cliproxyapi/gpt-6.1-sol": { reserveTokens: 224_000 },
      },
    },
  };
  const result = evaluateContextWindow(settings, config);
  assert.equal(result.ok, true);
  assert.deepEqual(result.triggers, {
    "cliproxyapi/beam-free": 276_000,
    "cliproxyapi/gpt-6.1-sol": 276_000,
  });
  assert.deepEqual(result.scope, ["orchestrator", "child"]);
});

test("rejects an override that lets context grow beyond 300000 tokens", () => {
  const settings = {
    compaction: {
      modelOverrides: {
        "cliproxyapi/beam-free": { reserveTokens: 724_000 },
      },
    },
  };
  const result = evaluateContextWindow(settings, config);
  assert.equal(result.ok, false);
  assert.match(result.issues.join(" "), /324576 exceeds 300000/);
});

test("rejects a config that does not cover both orchestrator and child scope", () => {
  const settings = { compaction: { modelOverrides: {} } };
  const result = evaluateContextWindow(settings, { ...config, scope: ["orchestrator"] });
  assert.equal(result.ok, false);
  assert.match(result.issues.join(" "), /scope must cover orchestrator and child/);
});
