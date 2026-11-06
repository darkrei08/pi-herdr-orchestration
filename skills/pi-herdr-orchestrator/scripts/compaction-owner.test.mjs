import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveCompactionOwner } from "./compaction-owner.mjs";

test("configured VCC owns compaction when codex context is only detected", () => {
  assert.deepEqual(resolveCompactionOwner({ configuredVcc: true, configuredCodexContext: false }), {
    owner: "pi-vcc",
    status: "installed",
  });
});

test("configured VCC and configured codex context fail closed as a conflict", () => {
  assert.deepEqual(resolveCompactionOwner({ configuredVcc: true, configuredCodexContext: true }), {
    owner: "conflict",
    status: "incompatible",
  });
});

test("codex context owns compaction when VCC is not configured", () => {
  assert.deepEqual(resolveCompactionOwner({ configuredVcc: false, configuredCodexContext: true }), {
    owner: "pi-codex-context",
    status: "installed",
  });
});
