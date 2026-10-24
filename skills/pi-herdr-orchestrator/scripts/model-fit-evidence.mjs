export const MODEL_FIT_EVIDENCE_VERSION = "pi-model-fit/evidence/v1";
export const OUTCOMES = Object.freeze(["PASS", "UNKNOWN", "BLOCKED", "NOT RUN"]);

const DIMENSIONS = Object.freeze(["entitlement", "inference", "quota"]);
const EVIDENCE_REFERENCE = /^ref:sha256:[0-9a-f]{64}$/;
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isOutcome = (value) => OUTCOMES.includes(value);

function malformed() {
  return { v: MODEL_FIT_EVIDENCE_VERSION, outcome: "BLOCKED", reason: "malformed" };
}

function result(envelope, outcome, reason, ageMs) {
  return {
    v: MODEL_FIT_EVIDENCE_VERSION,
    outcome,
    reason,
    source: envelope.source,
    timestamp: envelope.timestamp,
    age_ms: ageMs,
    evidence_ref: envelope.evidence_ref,
    dimensions: { ...envelope.dimensions },
    availability: envelope.availability,
  };
}

function currentTime(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value === "string") return Date.parse(value);
  return Date.now();
}

export function evaluateModelFitEvidence(envelope, options = {}) {
  if (!isRecord(envelope) || envelope.v !== MODEL_FIT_EVIDENCE_VERSION) return malformed();
  if (typeof envelope.source !== "string" || envelope.source.trim() === "") return malformed();
  if (typeof envelope.timestamp !== "string") return malformed();
  if (!EVIDENCE_REFERENCE.test(envelope.evidence_ref)) return malformed();
  if (!isOutcome(envelope.outcome)) return malformed();
  if (!isRecord(envelope.dimensions)) return malformed();
  if (Object.keys(envelope.dimensions).sort().join(",") !== DIMENSIONS.slice().sort().join(",")) return malformed();
  if (DIMENSIONS.some((dimension) => !isOutcome(envelope.dimensions[dimension]))) return malformed();

  const availability = envelope.availability ?? "available";
  if (availability !== "available" && availability !== "unavailable") return malformed();

  const timestampMs = Date.parse(envelope.timestamp);
  const nowMs = currentTime(options.now);
  if (!Number.isFinite(timestampMs) || !Number.isFinite(nowMs) || timestampMs > nowMs) return malformed();
  const ageMs = nowMs - timestampMs;
  const maxAgeMs = Number.isFinite(options.maxAgeMs) && options.maxAgeMs >= 0
    ? options.maxAgeMs
    : DEFAULT_MAX_AGE_MS;

  if (availability === "unavailable") return result({ ...envelope, availability }, "BLOCKED", "unavailable", ageMs);
  if (ageMs > maxAgeMs) return result({ ...envelope, availability }, "UNKNOWN", "stale", ageMs);
  if (envelope.dimensions.entitlement === "UNKNOWN") {
    return result({ ...envelope, availability }, "UNKNOWN", "entitlement-unknown", ageMs);
  }
  if (envelope.outcome === "BLOCKED" || DIMENSIONS.some((dimension) => envelope.dimensions[dimension] === "BLOCKED")) {
    return result({ ...envelope, availability }, "BLOCKED", "reported-blocked", ageMs);
  }
  if (envelope.outcome === "UNKNOWN" || DIMENSIONS.some((dimension) => envelope.dimensions[dimension] === "UNKNOWN")) {
    return result({ ...envelope, availability }, "UNKNOWN", "reported-unknown", ageMs);
  }
  if (envelope.outcome === "NOT RUN" || DIMENSIONS.some((dimension) => envelope.dimensions[dimension] === "NOT RUN")) {
    return result({ ...envelope, availability }, "NOT RUN", "not-run", ageMs);
  }
  return result({ ...envelope, availability }, "PASS", "accepted", ageMs);
}
