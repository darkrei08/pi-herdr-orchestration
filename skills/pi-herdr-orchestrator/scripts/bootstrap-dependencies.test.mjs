import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (name) => readFileSync(new URL(`./${name}`, import.meta.url), "utf8");

test("bootstrap derives compaction ownership from the shared resolver", () => {
  const source = read("bootstrap-dependencies.mjs");
  assert.match(source, /import \{ resolveCompactionOwner \} from "\.\/compaction-owner\.mjs"/);
  assert.match(source, /const compaction = resolveCompactionOwner\(\{/);
  assert.doesNotMatch(source, /const compactionConflict = vccConfigured/);
});

test("environment summary reports blocked and disabled checks", () => {
  const source = read("check-environment.mjs");
  assert.match(source, /blocked: checks\.filter\(\(check\) => check\.status === "blocked"\)\.length/);
  assert.match(source, /disabled: checks\.filter\(\(check\) => check\.status === "disabled"\)\.length/);
});
