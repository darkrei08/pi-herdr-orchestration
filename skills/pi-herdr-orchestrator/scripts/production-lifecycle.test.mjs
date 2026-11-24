import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { join } from "node:path";

const root = join(import.meta.dirname, "../../..");
const read = (path) => readFileSync(join(root, path), "utf8");
const referencePath = "skills/pi-herdr-orchestrator/references/production-lifecycle.md";

const stages = [
  "Chart / Spec",
  "Isolated worktree implementation",
  "Local audit and diff review",
  "Fast checks: tests, lint, typecheck",
  "Commit the work unit",
  "CI, matrix and security gates",
  "Artifact identity and provenance",
  "Fresh runtime smoke",
  "Beta / staging gate",
  "Production approval gate",
  "Post-deploy smoke, health and observability",
  "Rollback decision",
  "Close with evidence",
];

test("production lifecycle keeps the required stage order", () => {
  const reference = read(referencePath);
  let previous = -1;

  stages.forEach((stage, index) => {
    const position = reference.indexOf(`| ${index + 1} | ${stage} |`);
    assert.ok(position >= 0, `missing stage ${index + 1}: ${stage}`);
    assert.ok(position > previous, `stage ${index + 1} (${stage}) is out of order`);
    previous = position;
  });
});

test("fresh runtime smoke observes the exact candidate identity", () => {
  const reference = read(referencePath);

  assert.match(reference, /fresh temporary PiWorkflow\/Herdr session/);
  assert.match(reference, /exact candidate/);
  assert.match(reference, /same commit SHA/);
  assert.match(reference, /same artifact digest/);
  assert.match(reference, /No reload claim is accepted without a fresh runtime proof/);
  assert.match(reference, /"candidateMatch": true/);
});

test("promotion is immutable and never rebuilds between environments", () => {
  const reference = read(referencePath);

  assert.match(reference, /Build once, then promote the same artifact/);
  assert.match(reference, /no rebuild between environments/);
  assert.match(reference, /immutable digest/);
  assert.match(reference, /Rollback deploys the previous digest/);
});

test("blocked and not-run results are explicit and never pass a gate", () => {
  const reference = read(referencePath);

  assert.match(reference, /`PASS`, `FAIL`, `BLOCKED` or `NOT RUN`/);
  assert.match(reference, /`NOT RUN` is never treated as passing/);
  assert.match(reference, /A red stage stops the pipeline/);
  assert.match(reference, /Never deliver to beta, staging or production from a red gate/);
});

test("PiWorkflow schedules, the Master Chief controls, Herdr only transports", () => {
  const reference = read(referencePath);

  assert.match(reference, /PiWorkflow is the only execution scheduler/);
  assert.match(reference, /Pi Herdr Orchestration is the Master Chief control plane/);
  assert.match(reference, /Herdr tabs and panes are inspectable transport and presentation only/);
  assert.match(reference, /never delegates scheduling to a second engine/);
  assert.match(reference, /workflow_result/);
});

test("skill and README route to the production lifecycle only for delivery scope", () => {
  const skill = read("skills/pi-herdr-orchestrator/SKILL.md");
  const readme = read("README.md");

  assert.match(skill, /\[production-lifecycle\.md\]\(references\/production-lifecycle\.md\)/);
  assert.match(skill, /beta, staging, production, or a live runtime claim/);
  assert.match(readme, /\[production lifecycle\]\(skills\/pi-herdr-orchestrator\/references\/production-lifecycle\.md\)/);
  assert.match(readme, /Production delivery or live runtime verification/);
});

test("production lifecycle cites its sources and delegates Engineering Excellence", () => {
  const reference = read(referencePath);

  for (const url of [
    "https://docs.github.com/en/actions/concepts/workflows-and-actions/deployment-environments",
    "https://docs.github.com/en/actions/concepts/workflows-and-actions/concurrency",
    "https://docs.github.com/en/actions/concepts/security/artifact-attestations",
    "https://dora.dev/capabilities/deployment-automation/",
    "https://docs.cloud.google.com/deploy/docs/deployment-strategies/canary",
    "https://github.com/vekexasia/pi-extensible-workflows",
  ]) {
    assert.ok(reference.includes(url), `missing source ${url}`);
  }

  for (const delegated of [
    "quality-gates.md",
    "testing.md",
    "production-readiness.md",
    "ci-cd-and-publishing.md",
    "git-and-pull-requests.md",
    "environments.md",
  ]) {
    assert.ok(reference.includes(delegated), `missing delegated standard ${delegated}`);
  }
});
