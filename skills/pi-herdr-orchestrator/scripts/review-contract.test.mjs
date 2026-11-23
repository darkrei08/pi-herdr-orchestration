import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const protocol = readFileSync(new URL("../references/state-protocol.md", import.meta.url), "utf8");

test("state protocol documents the portable reviewer-profile digest", () => {
  assert.match(protocol, /recomputes the configuration digest from candidate `AGENTS\.md` and the tracked `skills\/pi-herdr-orchestrator\/reviewer-profile\.gga`/);
  assert.match(protocol, /machine-local `\.gga` bytes are intentionally excluded/);
  assert.doesNotMatch(protocol, /candidate `AGENTS\.md` plus the current project `\.gga` bytes/);
});
