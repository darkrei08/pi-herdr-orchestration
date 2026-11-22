import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const protocol = readFileSync(new URL("../references/state-protocol.md", import.meta.url), "utf8");

test("state protocol documents the AGENTS-only evidence digest", () => {
  assert.match(protocol, /recomputes the configuration digest from candidate `AGENTS\.md` only/);
  assert.match(protocol, /machine-local `\.gga` profile is intentionally excluded/);
  assert.doesNotMatch(protocol, /candidate `AGENTS\.md` plus the current project `\.gga` bytes/);
});
