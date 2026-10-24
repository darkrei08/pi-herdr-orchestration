import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { test } from "node:test";
import { tmpdir } from "node:os";
import { join } from "node:path";

const publishWorkflow = readFileSync(
  new URL("../../../.github/workflows/publish.yml", import.meta.url),
  "utf8",
);
const resolutionStepStart = publishWorkflow.indexOf("      - name: Resolve Release Tag & Version");
const resolutionStepEnd = publishWorkflow.indexOf("      - name: Extract Detailed Changelog for Tag", resolutionStepStart);
const resolutionStep = publishWorkflow.slice(resolutionStepStart, resolutionStepEnd);
const resolutionStepLines = resolutionStep.split("\n");
const runLine = resolutionStepLines.indexOf("        run: |");
const resolutionScript = resolutionStepLines
  .slice(runLine + 1)
  .filter((line) => line === "" || line.startsWith("          "))
  .map((line) => line.slice(10))
  .join("\n");
const runScripts = [...publishWorkflow.matchAll(/^\s+run: \|\n((?: {10}.*(?:\n|$))*)/gm)]
  .map((match) => match[1]);

const runResolution = ({ inputTag = "", githubRef = "refs/heads/main" } = {}) => {
  const outputDir = mkdtempSync(join(tmpdir(), "publish-workflow-test-"));
  const outputFile = join(outputDir, "github-output");
  try {
    const markerFile = join(outputDir, "injected");
    const result = spawnSync("bash", ["-c", resolutionScript], {
      encoding: "utf8",
      env: {
        ...process.env,
        GITHUB_OUTPUT: outputFile,
        GITHUB_REF: githubRef,
        INPUT_TAG: inputTag,
        MARKER_PATH: markerFile,
      },
    });
    return {
      ...result,
      injected: existsSync(markerFile),
      outputs: result.status === 0 ? readFileSync(outputFile, "utf8") : "",
    };
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
};

const parseOutputs = (output) => Object.fromEntries(
  output.trim().split("\n").map((line) => line.split("=", 2)),
);

test("publish workflow keeps GitHub expressions out of shell scripts", () => {
  assert.ok(resolutionStep.includes("env:\n          INPUT_TAG: ${{ inputs.tag }}"));
  assert.equal(runScripts.join("\n").includes("${{"), false);
});

test("publish workflow rejects malformed manual and push tags", () => {
  for (const scenario of [
    { inputTag: "1.2.6" },
    { inputTag: "v1.2" },
    { inputTag: "v1.2.6-beta" },
    { inputTag: "v1.2.6; touch \"$MARKER_PATH\"" },
    { githubRef: "refs/tags/v1.2" },
  ]) {
    const result = runResolution(scenario);
    assert.notEqual(result.status, 0, JSON.stringify(scenario));
    assert.equal(result.injected, false, JSON.stringify(scenario));
  }
});

test("publish workflow preserves tag and version outputs for valid paths", () => {
  const expected = {
    package: "pi-herdr-orchestration",
    tag: "v1.2.6",
    version: "1.2.6",
  };
  for (const scenario of [
    { inputTag: "v1.2.6" },
    { githubRef: "refs/tags/v1.2.6" },
    { githubRef: "refs/heads/main" },
  ]) {
    const result = runResolution(scenario);
    assert.equal(result.status, 0, `${JSON.stringify(scenario)}: ${result.stderr}`);
    assert.deepEqual(parseOutputs(result.outputs), expected, JSON.stringify(scenario));
  }
});
