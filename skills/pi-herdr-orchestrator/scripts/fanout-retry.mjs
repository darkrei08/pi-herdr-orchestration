// Bounded fan-out resolution. The mailbox owns branch lifecycle and identity,
// the persisted graph owns the retry counter, so this module only projects a
// decision per branch and the graph actions that record it.
import { normalizeGraphInput } from "./graph-supervisor.mjs";

// One bounded retry per branch: a second non-completed outcome is terminal.
export const MAX_FANOUT_RETRY = 1;
export const BRANCH_OUTCOMES = Object.freeze(["COMPLETED", "TIMEOUT", "FAILED", "NOT_STARTED"]);
export const SIDE_EFFECTS = Object.freeze(["OBSERVED", "NONE", "UNKNOWN"]);
export const FAILURE_CAUSES = Object.freeze(["MODEL", "CAPABILITY", "HERDR", "TIMEOUT", "UNKNOWN"]);
export const FANOUT_REASON = Object.freeze({
  COMPLETED: "FANOUT_COMPLETED",
  RETRY_BOUNDED: "FANOUT_RETRY_BOUNDED",
  RETRY_EXHAUSTED: "FANOUT_RETRY_EXHAUSTED",
  SIDE_EFFECTS_UNCERTAIN: "FANOUT_SIDE_EFFECTS_UNCERTAIN",
});

function text(value, label) {
  if (typeof value !== "string" || !value || value.length > 512 || /[\u0000-\u001f]/.test(value)) {
    throw new TypeError(`${label} must be a non-empty bounded string`);
  }
  return value;
}

function oneOf(value, allowed, label) {
  if (!allowed.includes(value)) throw new TypeError(`${label} must be one of ${allowed.join(", ")}`);
  return value;
}

function identity(value, label) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
  const result = {};
  for (const field of ["pane", "session"]) {
    if (value[field] !== undefined && value[field] !== null) result[field] = text(value[field], `${label}.${field}`);
  }
  return Object.keys(result).length ? result : null;
}

function normalizeBranch(input, index) {
  const label = `branches[${index}]`;
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError(`${label} must be an object`);
  const task = text(input.task, `${label}.task`);
  const outcome = oneOf(input.outcome, BRANCH_OUTCOMES, `${label}.outcome`);
  const effects = oneOf(input.side_effects ?? "UNKNOWN", SIDE_EFFECTS, `${label}.side_effects`);
  const cause = outcome === "COMPLETED" ? null : oneOf(input.cause ?? "UNKNOWN", FAILURE_CAUSES, `${label}.cause`);
  if (outcome === "COMPLETED" && !input.result_ref) throw new TypeError(`${label}.result_ref is required for a completed branch`);
  if (outcome !== "COMPLETED" && !input.evidence) throw new TypeError(`${label}.evidence is required for a non-completed branch`);
  return {
    task,
    agent: input.agent === undefined || input.agent === null ? null : text(input.agent, `${label}.agent`),
    identity: identity(input.identity, `${label}.identity`),
    outcome,
    cause,
    liveness: input.liveness === undefined || input.liveness === null ? null : text(input.liveness, `${label}.liveness`),
    side_effects: effects,
    evidence: input.evidence === undefined || input.evidence === null ? null : text(input.evidence, `${label}.evidence`),
    result_ref: input.result_ref === undefined || input.result_ref === null ? null : text(input.result_ref, `${label}.result_ref`),
  };
}

function decide(branch, retries, retryLimit) {
  if (branch.outcome === "COMPLETED") return { retries, decision: "ACCEPT", reason: FANOUT_REASON.COMPLETED };
  if (branch.side_effects !== "NONE") return { retries, decision: "BLOCK", reason: FANOUT_REASON.SIDE_EFFECTS_UNCERTAIN };
  if (retries < retryLimit) return { retries, decision: "RETRY", reason: FANOUT_REASON.RETRY_BOUNDED };
  return { retries, decision: "BLOCK", reason: FANOUT_REASON.RETRY_EXHAUSTED };
}

function summaryPart(branch, retryLimit) {
  const parts = [branch.task, branch.outcome, branch.reason, `side_effects=${branch.side_effects}`];
  if (branch.decision === "ACCEPT") parts.push(`result=${branch.result_ref}`);
  else {
    parts.push(`cause=${branch.cause}`, `retries=${branch.retries}/${retryLimit}`);
    if (branch.liveness) parts.push(`liveness=${branch.liveness}`);
  }
  if (branch.identity?.pane) parts.push(`pane=${branch.identity.pane}`);
  if (branch.identity?.session) parts.push(`session=${branch.identity.session}`);
  if (branch.evidence) parts.push(`evidence=${branch.evidence}`);
  return parts.join(" ");
}

export function resolveFanout({ run, branches, graph }) {
  const runId = text(run, "run");
  if (!Array.isArray(branches) || branches.length === 0) throw new TypeError("branches must be a non-empty array");
  const state = normalizeGraphInput(graph);
  if (state.run_id !== runId) throw new TypeError(`graph run_id ${state.run_id} does not match run ${runId}`);
  const retryLimit = state.budget.maxRetries ?? MAX_FANOUT_RETRY;
  const seen = new Set();
  const results = branches.map((input, index) => {
    const branch = normalizeBranch(input, index);
    if (seen.has(branch.task)) throw new TypeError(`duplicate fan-out branch: ${branch.task}`);
    seen.add(branch.task);
    const nodeId = `task:${branch.task}`;
    const node = state.nodes.find((candidate) => candidate.id === nodeId);
    if (node?.type !== "task") throw new TypeError(`branch ${branch.task} has no task graph node ${nodeId}`);
    return { ...branch, ...decide(branch, Number(node.retry_count ?? 0), retryLimit) };
  });

  const blocked = results.filter((branch) => branch.decision === "BLOCK");
  const retried = results.filter((branch) => branch.decision === "RETRY");
  const status = blocked.length > 0 ? "BLOCKED" : retried.length > 0 ? "PARTIAL" : "COMPLETED";
  const reason = (blocked[0] ?? retried[0])?.reason ?? FANOUT_REASON.COMPLETED;
  // A branch is failed in the graph before a retry, so the transition log keeps
  // the exact classification of the attempt that was not completed.
  const actions = results.flatMap((branch) => {
    if (branch.decision === "ACCEPT") return [];
    const nodeId = `task:${branch.task}`;
    const failed = { type: "fail", nodeId, reason: branch.reason };
    return branch.decision === "RETRY" ? [failed, { type: "retry", nodeId }] : [failed];
  });

  return {
    run: runId,
    status,
    reason,
    retry_limit: retryLimit,
    branches: results,
    completed: results
      .filter((branch) => branch.decision === "ACCEPT")
      .map(({ task, result_ref, evidence, identity: recorded }) => ({ task, result_ref, evidence, identity: recorded })),
    actions,
    report: {
      state: status === "BLOCKED" ? "BLOCKED" : "WORKING",
      summary: `${reason}: ${status} run ${runId}; ${results.map((branch) => summaryPart(branch, retryLimit)).join("; ")}`,
      checks: [`fanout=${status === "COMPLETED" ? "PASS" : status === "BLOCKED" ? "BLOCKED" : "NOT RUN"}`],
    },
  };
}
