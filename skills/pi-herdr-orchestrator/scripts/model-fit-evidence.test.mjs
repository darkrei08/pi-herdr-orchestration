import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MODEL_FIT_EVIDENCE_VERSION,
  OUTCOMES,
  evaluateModelFitEvidence,
} from "./model-fit-evidence.mjs";

const now = Date.parse("2026-10-24T12:00:00Z");
const evidenceRef = `ref:sha256:${"a".repeat(64)}`;

function envelope(overrides = {}) {
  return {
    v: MODEL_FIT_EVIDENCE_VERSION,
    source: "pi-model-fit@1df6b902",
    timestamp: new Date(now - 60 * 60 * 1000).toISOString(),
    evidence_ref: evidenceRef,
    outcome: "PASS",
    dimensions: {
      entitlement: "PASS",
      inference: "PASS",
      quota: "PASS",
    },
    availability: "available",
    ...overrides,
  };
}

test("accepts a current PASS envelope with independent dimensions", () => {
  const result = evaluateModelFitEvidence(envelope(), { now });

  assert.equal(result.outcome, "PASS");
  assert.equal(result.reason, "accepted");
  assert.equal(result.source, "pi-model-fit@1df6b902");
  assert.equal(result.evidence_ref, evidenceRef);
  assert.equal(result.age_ms, 60 * 60 * 1000);
  assert.deepEqual(result.dimensions, {
    entitlement: "PASS",
    inference: "PASS",
    quota: "PASS",
  });
});

test("accepts exactly the four explicit outcomes", () => {
  assert.deepEqual(OUTCOMES, ["PASS", "UNKNOWN", "BLOCKED", "NOT RUN"]);
  for (const outcome of OUTCOMES) {
    const result = evaluateModelFitEvidence(envelope({ outcome }), { now });
    assert.equal(result.outcome, outcome);
  }
});

test("returns BLOCKED for malformed envelopes and unknown outcomes", () => {
  const missingSource = evaluateModelFitEvidence(envelope({ source: "" }), { now });
  const invalidOutcome = evaluateModelFitEvidence(envelope({ outcome: "MAYBE" }), { now });
  const invalidDimension = evaluateModelFitEvidence(
    envelope({ dimensions: { entitlement: "PASS", inference: "PASSING", quota: "PASS" } }),
    { now },
  );

  assert.equal(missingSource.outcome, "BLOCKED");
  assert.equal(missingSource.reason, "malformed");
  assert.equal(invalidOutcome.outcome, "BLOCKED");
  assert.equal(invalidOutcome.reason, "malformed");
  assert.equal(invalidDimension.outcome, "BLOCKED");
  assert.equal(invalidDimension.reason, "malformed");
});

test("returns UNKNOWN for stale evidence", () => {
  const result = evaluateModelFitEvidence(
    envelope({ timestamp: new Date(now - 25 * 60 * 60 * 1000).toISOString() }),
    { now, maxAgeMs: 24 * 60 * 60 * 1000 },
  );

  assert.equal(result.outcome, "UNKNOWN");
  assert.equal(result.reason, "stale");
  assert.equal(result.age_ms, 25 * 60 * 60 * 1000);
});

test("returns BLOCKED when the evidence source is unavailable", () => {
  const result = evaluateModelFitEvidence(envelope({ availability: "unavailable" }), { now });

  assert.equal(result.outcome, "BLOCKED");
  assert.equal(result.reason, "unavailable");
});

test("returns UNKNOWN when entitlement is unknown even if other dimensions pass", () => {
  const result = evaluateModelFitEvidence(
    envelope({ dimensions: { entitlement: "UNKNOWN", inference: "PASS", quota: "PASS" } }),
    { now },
  );

  assert.equal(result.outcome, "UNKNOWN");
  assert.equal(result.reason, "entitlement-unknown");
  assert.equal(result.dimensions.entitlement, "UNKNOWN");
});

test("does not certify PASS when inference or quota is not PASS", () => {
  const inferenceUnknown = evaluateModelFitEvidence(
    envelope({ dimensions: { entitlement: "PASS", inference: "UNKNOWN", quota: "PASS" } }),
    { now },
  );
  const quotaBlocked = evaluateModelFitEvidence(
    envelope({ dimensions: { entitlement: "PASS", inference: "PASS", quota: "BLOCKED" } }),
    { now },
  );

  assert.equal(inferenceUnknown.outcome, "UNKNOWN");
  assert.equal(quotaBlocked.outcome, "BLOCKED");
});
