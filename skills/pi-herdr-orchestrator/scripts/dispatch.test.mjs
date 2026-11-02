import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { join } from "node:path";

const root = join(import.meta.dirname, "../../..");
const read = (path) => readFileSync(join(root, path), "utf8");

test("trusted project settings select the pane topology for Herdr workflow agents", () => {
  const settings = JSON.parse(read(".pi/pi-extensible-workflows/settings.json"));
  assert.equal(settings.extensionSettings?.herdr?.enableFullyInspectableMode, false);
});

test("dispatch contract names deterministic workflow fan-out and explicit loadout", () => {
  const skill = read("skills/pi-herdr-orchestrator/SKILL.md");
  const routing = read("skills/pi-herdr-orchestrator/references/routing.md");
  const execution = read("skills/pi-herdr-orchestrator/references/execution.md");

  assert.match(skill, /parallel\(/);
  assert.match(skill, /herdr pane/i);
  assert.match(skill, /sibling panes/);
  assert.match(routing, /skills:\s*\[/);
  assert.match(routing, /extensions:\s*\[/);
  assert.match(routing, /label/);
  assert.match(execution, /pane tree/i);
  assert.match(execution, /caller's current tab/);
  assert.match(execution, /worktree/);
});

test("repository initialization owns the project workflow settings contract", () => {
  const init = read("skills/pi-herdr-orchestrator/scripts/init-repository.mjs");
  assert.match(init, /pi-extensible-workflows/);
  assert.match(init, /enableFullyInspectableMode/);
  assert.ok(existsSync(join(root, ".pi/pi-extensible-workflows/settings.json")));
});
