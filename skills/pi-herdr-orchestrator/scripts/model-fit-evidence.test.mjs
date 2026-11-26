import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { DEFAULT_FRESHNESS_MS, EVIDENCE_SCHEMA, readModelFitEvidence } from "./model-fit-evidence.mjs";

const NOW = Date.UTC(2026, 10, 26, 12, 0, 0);

function envelope(overrides = {}) {
  return {
    schema: EVIDENCE_SCHEMA,
    source: "pi-model-fit",
    generatedAt: "2026-11-26T11:30:00.000Z",
    evidenceRef: "pi-model-fit/reports/2026-11-26.md#role-matrix",
    routes: [{ route: "cliproxyapi/claude-opus-5-5:high", outcome: "PASS" }],
    ...overrides,
  };
}

const read = (input, overrides = {}) => readModelFitEvidence(input, { now: NOW, ...overrides });

test("accepts a fresh envelope and preserves its evidence reference", () => {
  const input = envelope();
  const snapshot = structuredClone(input);

  const report = read(input);

  assert.equal(report.outcome, "PASS");
  assert.equal(report.evidenceRef, input.evidenceRef);
  assert.deepEqual(report.routes, [{ route: "cliproxyapi/claude-opus-5-5:high", outcome: "PASS" }]);
  assert.equal(report.routing, "unchanged");
  assert.deepEqual(input, snapshot, "reading evidence must not mutate the envelope");
  assert.deepEqual(read(input), report, "the reading is deterministic for a fixed clock");
});

test("rejects a malformed envelope as BLOCKED", () => {
  const cases = [
    ["not an object", "2026-11-26"],
    ["missing schema", envelope({ schema: undefined })],
    ["unsupported schema", envelope({ schema: "pi-model-fit-evidence/2" })],
    ["missing source", envelope({ source: undefined })],
    ["missing evidence reference", envelope({ evidenceRef: "" })],
    ["invalid timestamp", envelope({ generatedAt: "yesterday" })],
    ["future timestamp", envelope({ generatedAt: "2026-11-26T12:00:01.000Z" })],
    ["no routes", envelope({ routes: [] })],
    ["malformed route", envelope({ routes: [{ route: "claude-opus", outcome: "PASS" }] })],
    ["implicit outcome", envelope({ routes: [{ route: "cliproxyapi/claude-opus-5-5:high", outcome: "ok" }] })],
    ["missing outcome", envelope({ routes: [{ route: "cliproxyapi/claude-opus-5-5:high" }] })],
  ];

  for (const [label, input] of cases) {
    const report = read(input);
    assert.equal(report.outcome, "BLOCKED", label);
    assert.equal(report.routing, "unchanged", label);
  }
});

test("a static model matrix is not route evidence", () => {
  const report = read(envelope({ source: "static-model-matrix", evidenceRef: undefined }));

  assert.equal(report.outcome, "BLOCKED");
  assert.match(report.reason, /static|source/i);
  assert.equal(report.routing, "unchanged");
});

test("fails closed on stale evidence", () => {
  const input = envelope({ generatedAt: "2026-11-24T12:00:00.000Z" });

  const report = read(input);

  assert.equal(report.outcome, "UNKNOWN");
  assert.match(report.reason, /stale/i);
  assert.equal(report.evidenceRef, input.evidenceRef);
  assert.equal(report.routing, "unchanged");
});

test("the freshness window is one day and half-open at its edge", () => {
  assert.equal(DEFAULT_FRESHNESS_MS, 24 * 60 * 60 * 1000);

  const edge = new Date(NOW - DEFAULT_FRESHNESS_MS).toISOString();
  assert.equal(read(envelope({ generatedAt: edge })).outcome, "PASS");

  const beyond = new Date(NOW - DEFAULT_FRESHNESS_MS - 1).toISOString();
  assert.equal(read(envelope({ generatedAt: beyond })).outcome, "UNKNOWN");
});

test("fails closed when the envelope is unavailable", () => {
  for (const input of [undefined, null]) {
    const report = read(input);
    assert.equal(report.outcome, "UNKNOWN");
    assert.equal(report.evidenceRef, null);
    assert.deepEqual(report.routes, []);
    assert.equal(report.routing, "unchanged");
  }
});

test("entitlement-unknown route evidence never becomes PASS", () => {
  const report = read(envelope({
    routes: [
      { route: "cliproxyapi/claude-opus-5-5:high", outcome: "PASS" },
      { route: "cliproxyapi/gpt-6-luna:high", outcome: "UNKNOWN" },
    ],
  }));

  assert.equal(report.outcome, "UNKNOWN");
  assert.deepEqual(report.routes.map(({ outcome }) => outcome), ["PASS", "UNKNOWN"]);
  assert.equal(report.routing, "unchanged");
});

test("worst explicit route outcome wins and NOT RUN is never passing", () => {
  const report = read(envelope({
    routes: [
      { route: "cliproxyapi/gpt-6-luna:high", outcome: "PASS" },
      { route: "opencode-go/cat-jam-free:medium", outcome: "NOT RUN" },
      { route: "cliproxyapi/claude-opus-5-5:high", outcome: "UNKNOWN" },
      { route: "cliproxyapi/gemini-4-argon:high", outcome: "BLOCKED" },
    ],
  }));

  assert.equal(report.outcome, "BLOCKED");
  assert.equal(report.routing, "unchanged");

  const notRun = read(envelope({ routes: [{ route: "opencode-go/cat-jam-free:medium", outcome: "NOT RUN" }] }));
  assert.equal(notRun.outcome, "NOT RUN");
});

test("the evidence reader is read-only and never invokes SkillOpt", () => {
  const source = readFileSync(new URL("./model-fit-evidence.mjs", import.meta.url), "utf8");

  assert.doesNotMatch(source, /skillopt/i);
  assert.doesNotMatch(source, /child_process|writeFile|appendFile|mkdir|rmSync/);
});
