export const EVIDENCE_SCHEMA = "pi-model-fit-evidence/1";

// A model-fit report older than one day is not current availability evidence.
export const DEFAULT_FRESHNESS_MS = 24 * 60 * 60 * 1000;

const OUTCOMES = ["PASS", "UNKNOWN", "BLOCKED", "NOT RUN"];
const WORST_FIRST = ["BLOCKED", "UNKNOWN", "NOT RUN", "PASS"];
const ROUTE_PATTERN = /^[a-z0-9][a-z0-9.-]*\/[A-Za-z0-9][A-Za-z0-9._-]*(?::[a-z]+)?$/;

function result(outcome, reason, { evidenceRef = null, routes = [] } = {}) {
  // routing is fixed: reading evidence never selects, replaces or reorders a route.
  return { outcome, evidenceRef, routes, reason, routing: "unchanged" };
}

function fail(reason, evidenceRef = null) {
  return result("BLOCKED", reason, { evidenceRef });
}

// Reads a pi-model-fit evidence envelope read-only and fails closed: only an explicit,
// fresh, attributable PASS (or explicit NOT RUN/UNKNOWN/BLOCKED) leaves this boundary.
export function readModelFitEvidence(envelope, { now = Date.now(), freshnessMs = DEFAULT_FRESHNESS_MS } = {}) {
  if (envelope === undefined || envelope === null) {
    return result("UNKNOWN", "model-fit evidence unavailable: no envelope supplied");
  }
  if (typeof envelope !== "object" || Array.isArray(envelope)) {
    return fail("malformed envelope: expected an object");
  }
  if (envelope.schema !== EVIDENCE_SCHEMA) {
    return fail(`unsupported envelope schema: ${String(envelope.schema)}`);
  }
  if (envelope.source !== "pi-model-fit") {
    return fail(`foreign evidence source: ${String(envelope.source)}; static catalogs and model matrices are not route evidence`);
  }

  const { evidenceRef } = envelope;
  if (typeof evidenceRef !== "string" || evidenceRef.trim() === "") {
    return fail("malformed envelope: missing evidence reference");
  }
  if (typeof envelope.generatedAt !== "string") {
    return fail("malformed envelope: missing generatedAt timestamp", evidenceRef);
  }
  const generatedAt = Date.parse(envelope.generatedAt);
  if (Number.isNaN(generatedAt)) {
    return fail(`malformed envelope: unparseable generatedAt: ${envelope.generatedAt}`, evidenceRef);
  }
  // A timestamp ahead of the injected clock proves nothing about current access.
  if (generatedAt > now) {
    return fail(`malformed envelope: generatedAt is in the future: ${envelope.generatedAt}`, evidenceRef);
  }
  if (now - generatedAt > freshnessMs) {
    return result("UNKNOWN", `stale evidence: generatedAt ${envelope.generatedAt} is older than ${freshnessMs}ms`, { evidenceRef });
  }

  if (!Array.isArray(envelope.routes) || envelope.routes.length === 0) {
    return fail("malformed envelope: routes must be a non-empty array", evidenceRef);
  }
  const routes = [];
  for (const entry of envelope.routes) {
    if (entry === null || typeof entry !== "object") {
      return fail("malformed envelope: route entry must be an object", evidenceRef);
    }
    const { route, outcome } = entry;
    if (typeof route !== "string" || !ROUTE_PATTERN.test(route)) {
      return fail(`malformed envelope: invalid route: ${String(route)}`, evidenceRef);
    }
    if (!OUTCOMES.includes(outcome)) {
      return fail(`malformed envelope: unrecognized outcome for ${route}: ${String(outcome)}`, evidenceRef);
    }
    routes.push({ route, outcome });
  }

  const outcome = routes.reduce((worst, { outcome: next }) =>
    WORST_FIRST.indexOf(next) < WORST_FIRST.indexOf(worst) ? next : worst, "PASS");
  return result(outcome, outcome === "PASS"
    ? `fresh pi-model-fit evidence: ${evidenceRef}`
    : `route evidence reports ${outcome}: ${evidenceRef}`, { evidenceRef, routes });
}
