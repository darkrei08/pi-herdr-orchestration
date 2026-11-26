import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const WORKFLOW_PATH = join(ROOT, ".github", "workflows", "publish.yml");

function readWorkflow() {
  return readFileSync(WORKFLOW_PATH, "utf8");
}

// Runs of a step are YAML literal blocks indented deeper than the `run:` key.
function runBlocks(yaml) {
  const lines = yaml.split("\n");
  const blocks = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^(\s*)run:\s*(.*)$/.exec(lines[index]);
    if (!match) continue;
    const indent = match[1].length;
    const inline = match[2].trim();
    if (inline !== "" && !["|", ">"].includes(inline)) {
      blocks.push(inline);
      continue;
    }
    const body = [];
    while (index + 1 < lines.length) {
      const next = lines[index + 1];
      if (next.trim() !== "" && next.search(/\S/) <= indent) break;
      body.push(next);
      index += 1;
    }
    blocks.push(body.join("\n"));
  }
  return blocks;
}

function stepBlock(yaml, name) {
  const lines = yaml.split("\n");
  const start = lines.findIndex((line) => line.trim() === `- name: ${name}`);
  assert.notEqual(start, -1, `workflow step "${name}" is missing`);
  const indent = lines[start].search(/\S/);
  const body = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() !== "" && line.search(/\S/) <= indent) break;
    body.push(line);
  }
  return body.join("\n");
}

function resolveScript() {
  const blocks = runBlocks(stepBlock(readWorkflow(), "Resolve Release Tag & Version"));
  assert.equal(blocks.length, 1, "resolve step must own exactly one run script");
  return blocks[0];
}

test("no run block interpolates the workflow expression syntax", () => {
  const blocks = runBlocks(readWorkflow());
  assert.ok(blocks.length >= 6, "run block extraction found too few scripts to be meaningful");
  for (const block of blocks) {
    assert.doesNotMatch(block, /\$\{\{\s*inputs\./, "run block interpolates a workflow input");
    assert.doesNotMatch(block, /\$\{\{\s*github\./, "run block interpolates a github context value");
  }
});

test("dispatch tag reaches the resolve script through env", () => {
  const step = stepBlock(readWorkflow(), "Resolve Release Tag & Version");
  assert.match(step, /env:\s*\n\s+INPUT_TAG:\s*\$\{\{\s*inputs\.tag\s*\}\}/);
  assert.match(resolveScript(), /TAG="\$INPUT_TAG"/);
});

test("manual and push-derived tags are validated against the semver allowlist", () => {
  const script = resolveScript();
  assert.match(script, /\[\[ "\$TAG" =~ \^v\[0-9\]\+\\\.\[0-9\]\+\\\.\[0-9\]\+\$ \]\]/);
  assert.match(script, /TAG="\$\{GITHUB_REF#refs\/tags\/\}"/);
});

test("valid runs still write the tag and version outputs after the equality check", () => {
  const script = resolveScript();
  assert.match(script, /echo "tag=\$TAG" >> "\$GITHUB_OUTPUT"/);
  assert.match(script, /echo "version=\$VERSION" >> "\$GITHUB_OUTPUT"/);
  assert.match(script, /test "\$TAG" = "v\$VERSION"/);
});
