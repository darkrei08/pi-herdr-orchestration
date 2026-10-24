import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { join } from "node:path";

const root = join(import.meta.dirname, "../../..");
const read = (path) => readFileSync(join(root, path), "utf8");

test("trusted project settings enable fully inspectable Herdr workflow agents", () => {
  const settings = JSON.parse(read(".pi/pi-extensible-workflows/settings.json"));
  assert.equal(settings.extensionSettings?.herdr?.enableFullyInspectableMode, true);
});

test("dispatch contract names deterministic workflow fan-out and explicit loadout", () => {
  const skill = read("skills/pi-herdr-orchestrator/SKILL.md");
  const routing = read("skills/pi-herdr-orchestrator/references/routing.md");
  const execution = read("skills/pi-herdr-orchestrator/references/execution.md");

  assert.match(skill, /parallel\(/);
  assert.match(skill, /#1/);
  assert.match(routing, /skills:\s*\[/);
  assert.match(routing, /extensions:\s*\[/);
  assert.match(routing, /label/);
  assert.match(execution, /numbered/);
  assert.match(execution, /label/);
  assert.match(execution, /worktree/);
});

test("native extension exposes durable directive and supervision controls", () => {
  const extension = read("extensions/index.mjs");
  for (const tool of ["orch_assign", "orch_directive_ack", "orch_directive_state", "orch_directive_decide", "orch_directive_reassign", "orch_directive_receipt", "orch_supervise"]) {
    assert.match(extension, new RegExp(`name: \\\"${tool}\\\"`));
  }
  assert.match(read("skills/pi-herdr-orchestrator/references/supervisor-loop.md"), /parent receipt/);
});

test("repository initialization owns the project workflow settings contract", () => {
  const init = read("skills/pi-herdr-orchestrator/scripts/init-repository.mjs");
  assert.match(init, /pi-extensible-workflows/);
  assert.match(init, /enableFullyInspectableMode/);
  assert.ok(existsSync(join(root, ".pi/pi-extensible-workflows/settings.json")));
});
