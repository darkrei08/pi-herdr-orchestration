const TERMINAL_STATES = new Set(["CLOSED", "ACCEPTED"]);
const PASSING_CHECKS = new Set(["PASS"]);

function sameIdentity(record, report) {
  const identity = report?.identity;
  return Boolean(
    identity &&
    identity.assignment_id === record.assignment_id &&
    identity.worker === record.worker &&
    identity.task === record.task,
  );
}

function allChecksPass(report) {
  return Array.isArray(report?.checks) && report.checks.length > 0 && report.checks.every((check) => PASSING_CHECKS.has(check.status));
}

function stale(record, report, now, staleMs) {
  const updated = Date.parse(report?.updated_at ?? record.updated_at);
  return Number.isFinite(updated) && now - updated > staleMs;
}

export function decideSupervision(record, report, agent, git, options = {}) {
  if (!record || TERMINAL_STATES.has(record.state)) return { action: "noop", reason: "terminal" };
  if (!report) {
    if ((record.retry?.attempt ?? 0) < (record.retry?.max ?? 0)) return { action: "reassign", reason: "report-missing" };
    return { action: "escalate", reason: "report-missing" };
  }
  if (!sameIdentity(record, report)) return { action: "escalate", reason: "identity-drift" };

  const live = agent?.agent_status;
  if (report.state === "BLOCKED" && report.pending_ask) return { action: "escalate", reason: "worker-question" };
  if (!agent || live === "unknown") {
    if ((record.retry?.attempt ?? 0) < (record.retry?.max ?? 0)) return { action: "reassign", reason: "worker-missing" };
    return { action: "escalate", reason: "retry-budget-exhausted" };
  }
  if (report.state === "FAILED") {
    if ((record.retry?.attempt ?? 0) < (record.retry?.max ?? 0)) return { action: "reassign", reason: "worker-failed" };
    return { action: "escalate", reason: "retry-budget-exhausted" };
  }
  if (report.state === "READY") {
    if (!git?.clean || git.branch !== record.branch || git.worktree !== record.worktree) {
      return { action: "escalate", reason: "git-evidence-mismatch" };
    }
    if (!allChecksPass(report)) return { action: "escalate", reason: "checks-incomplete" };
    return { action: "accept", reason: "ready-evidence-reconciled", result_id: report.result_id ?? record.result_id };
  }
  if (report.state === "BLOCKED") return { action: "escalate", reason: "worker-blocked" };
  if (report.state === "WORKING" && stale(record, report, options.now ?? Date.now(), options.staleMs ?? 600_000)) {
    if ((record.nudge_count ?? 0) < (options.maxNudges ?? 2)) return { action: "nudge", reason: "stale-report" };
    if ((record.retry?.attempt ?? 0) < (record.retry?.max ?? 0)) return { action: "reassign", reason: "stale-after-nudges" };
    return { action: "escalate", reason: "retry-budget-exhausted" };
  }
  if (["idle", "done"].includes(live) && report.state === "WORKING") return { action: "nudge", reason: "silent-worker" };
  return { action: "noop", reason: "on-track" };
}

export function planSupervision(snapshot, options = {}) {
  const assignments = snapshot?.assignments ?? [];
  return assignments.map((record) => decideSupervision(
    record,
    snapshot.reports?.[record.assignment_id],
    snapshot.agents?.[record.worker],
    snapshot.git?.[record.assignment_id],
    options,
  )).map((decision, index) => ({ ...decision, assignment_id: assignments[index].assignment_id }));
}

export async function runSupervisorCycle(snapshot, applyDecision, options = {}) {
  const plan = planSupervision(snapshot, options);
  const actionable = plan.filter((decision) => decision.action !== "noop");
  const applied = [];
  for (const decision of actionable) {
    applied.push(await applyDecision(decision));
  }
  return { plan, applied, actionable: actionable.length };
}

export async function runSupervisorLoop({ loadSnapshot, applyDecision, waitForWake, maxCycles = 1, signal, options = {} }) {
  if (typeof loadSnapshot !== "function") throw new Error("loadSnapshot is required");
  if (typeof applyDecision !== "function") throw new Error("applyDecision is required");
  if (!Number.isInteger(maxCycles) || maxCycles < 1) throw new Error("maxCycles must be a positive integer");

  let cycles = 0;
  let lastCycle = null;
  while (!signal?.aborted && cycles < maxCycles) {
    const snapshot = await loadSnapshot();
    lastCycle = await runSupervisorCycle(snapshot, applyDecision, options);
    cycles += 1;
    if (lastCycle.actionable === 0) return { cycles, reason: "no-actionable-work", lastCycle };
    if (cycles < maxCycles && typeof waitForWake === "function") {
      await waitForWake({ cycle: cycles, plan: lastCycle.plan });
    }
  }
  return { cycles, reason: signal?.aborted ? "aborted" : "max-cycles", lastCycle };
}
