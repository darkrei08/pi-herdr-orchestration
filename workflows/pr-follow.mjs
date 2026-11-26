// Deterministic PR-following workflow: validated target, developer/reviewer
// cycles, verbatim external findings, zero-agent CI/review/merge polling, and
// a mailbox question that pauses the run until orch_reply answers it.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { fileFor, runDir } from "../skills/pi-herdr-orchestrator/scripts/mailbox.mjs";

const SESSION_VERSION = "pi-herdr-orchestration/pr-follow/v1";
// Three developer cycles is the cap: cycle 1 plus two finding-driven reworks.
export const MAX_DEV_CYCLES = 3;
// Waiting costs zero model calls, so a phase may wait 30 minutes before it
// escalates to BLOCKED with POLL_BOUND_EXCEEDED.
export const POLL_INTERVAL_MS = 60_000;
export const MAX_POLL_ATTEMPTS = 30;

const PHASES = Object.freeze({
  VALIDATE: "VALIDATE",
  DEVELOP: "DEVELOP",
  REVIEW: "REVIEW",
  BOT_REVIEW: "BOT_REVIEW",
  CI: "CI",
  APPROVAL: "APPROVAL",
  MERGE: "MERGE",
});

export const REASON = Object.freeze({
  ID_INVALID: "ID_INVALID",
  ID_KIND_MISMATCH: "ID_KIND_MISMATCH",
  ID_NOT_FOUND: "ID_NOT_FOUND",
  BOT_REVIEW_PENDING: "BOT_REVIEW_PENDING",
  CI_PENDING: "CI_PENDING",
  CI_FAILED: "CI_FAILED",
  APPROVAL_PENDING: "APPROVAL_PENDING",
  MERGE_PENDING: "MERGE_PENDING",
  MERGE_BLOCKED: "MERGE_BLOCKED",
  POLL_BOUND_EXCEEDED: "POLL_BOUND_EXCEEDED",
  REVIEW_LOOP_CAP: "REVIEW_LOOP_CAP",
  DECISION_REQUIRED: "DECISION_REQUIRED",
});

const KINDS = new Set(["issue", "pr"]);
const TASK_ID = /^[1-9][0-9]{0,8}$/;

export function parseTarget(input) {
  const kind = input?.target;
  if (!KINDS.has(kind)) throw new TypeError(`target must be "issue" or "pr", received ${JSON.stringify(kind)}`);
  const raw = input?.id;
  const text = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
  if (!TASK_ID.test(text)) throw new TypeError(`${REASON.ID_INVALID}: id must be a positive integer, received ${JSON.stringify(raw)}`);
  return { kind, number: Number(text), task: kind === "pr" ? `PR#${text}` : `I#${text}` };
}

function newSession(target) {
  return {
    version: SESSION_VERSION,
    target: { kind: target.kind, number: target.number, task: target.task },
    cycle: 1,
    completed: [],
    findings: "",
    verdict: "",
    bot_findings: [],
    pending: null,
  };
}

const settled = (session, step) => session.completed.includes(step);

const settle = (session, step) => {
  if (!settled(session, step)) session.completed.push(step);
};

function assertSession(session, target) {
  if (session.version !== SESSION_VERSION) throw new Error(`unknown session version: ${session.version}`);
  if (session.target?.task !== target.task) {
    throw new Error(`session target ${session.target?.task} does not match requested target ${target.task}`);
  }
}

export function createFileStore({ dir }) {
  const file = (task) => join(dir, "pr-follow", fileFor(task));
  return {
    load(task) {
      try {
        return JSON.parse(readFileSync(file(task), "utf8"));
      } catch (error) {
        if (error.code === "ENOENT") return null;
        throw error;
      }
    },
    save(session) {
      const target = file(session.target.task);
      const temporary = `${target}.${process.pid}.tmp`;
      mkdirSync(join(dir, "pr-follow"), { recursive: true });
      writeFileSync(temporary, `${JSON.stringify(session, null, 2)}\n`);
      renameSync(temporary, target);
    },
  };
}

// The answer is whatever orch_reply persisted, so a resume never re-asks.
export function mailboxAnswer({ dir }) {
  return (task, questionId) => {
    let entry;
    try {
      entry = JSON.parse(readFileSync(join(dir, fileFor(task)), "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
    if (entry.pending_ask) return null;
    if (entry.last_reply?.question_id !== questionId) return null;
    return String(entry.last_reply.answer ?? "") || null;
  };
}

function developerPrompt(target, findings, cycle) {
  const parts = [
    `Implement cycle ${cycle} of ${MAX_DEV_CYCLES} for ${target.task}.`,
    "Work only in your isolated worktree, run the repository checks, and report the exact commands you ran.",
  ];
  if (findings) {
    parts.push("The reviewer findings below are quoted verbatim and must all be addressed:", findings);
  }
  return parts.join("\n\n");
}

function reviewerPrompt(target, cycle) {
  return [
    `Review the cycle ${cycle} change for ${target.task}.`,
    'Reply with "PASS" on the first line when the change is mergeable, otherwise "CHANGES" followed by the exact findings; every finding is forwarded verbatim to the next cycle.',
  ].join("\n");
}

async function poll({ phase, reason, read, emit, sleep, checks, limit = MAX_POLL_ATTEMPTS, intervalMs = POLL_INTERVAL_MS }) {
  let value = null;
  for (let attempt = 1; attempt <= limit; attempt += 1) {
    value = await read();
    if (!value.pending) return { settled: true, attempts: attempt, value };
    await emit(phase, "WORKING", `${reason}: poll ${attempt}/${limit} every ${intervalMs / 1000}s, no agent launched`, checks);
    if (attempt < limit) await sleep(intervalMs);
  }
  return { settled: false, attempts: limit, value };
}

export async function runPrFollow(input, ports) {
  const target = parseTarget(input);
  const { github, agent, tools, sleep, store, answer } = ports ?? {};
  if (!github || !agent || !tools?.orch_report || !tools?.orch_ask || !sleep || !store || !answer) {
    throw new TypeError("runPrFollow requires github, agent, tools.orch_report, tools.orch_ask, sleep, store and answer");
  }
  const session = store.load(target.task) ?? newSession(target);
  assertSession(session, target);

  // orch_report derives the lifecycle from the mailbox state it persists.
  const emit = (phase, state, summary, checks = []) => tools.orch_report({
    task: target.task,
    state,
    phase,
    summary,
    checks,
    run: ports.run,
  });
  const finish = (status, reason = "") => {
    store.save(session);
    return {
      status,
      reason,
      task: target.task,
      cycle: session.cycle,
      question_id: session.pending?.question_id ?? "",
    };
  };

  // 1. The target is proven to exist and to match its kind before any agent runs.
  if (!settled(session, "validate")) {
    const facts = await github.inspect(target);
    if (!facts.exists) {
      await emit(PHASES.VALIDATE, "FAILED", `${REASON.ID_NOT_FOUND}: no ${target.kind} ${target.number} in this repository`, ["id=FAIL"]);
      return finish("REJECTED", REASON.ID_NOT_FOUND);
    }
    if (facts.pullRequest !== (target.kind === "pr")) {
      await emit(PHASES.VALIDATE, "FAILED", `${REASON.ID_KIND_MISMATCH}: ${target.number} is ${facts.pullRequest ? "a pull request" : "an issue"}, not ${target.kind === "pr" ? "a pull request" : "an issue"}`, ["id=FAIL"]);
      return finish("REJECTED", REASON.ID_KIND_MISMATCH);
    }
    await emit(PHASES.VALIDATE, "WORKING", `${target.task} accepted as ${target.kind === "pr" ? "pull request" : "issue"}`, ["id=PASS"]);
    settle(session, "validate");
    store.save(session);
  }

  // 2. Developer/reviewer cycles; the external bot drives the next cycle.
  for (let guard = 0; guard <= MAX_DEV_CYCLES; guard += 1) {
    if (session.cycle > MAX_DEV_CYCLES) break;
    const cycle = session.cycle;
    if (!settled(session, `dev-${cycle}`)) {
      await emit(PHASES.DEVELOP, "WORKING", `cycle ${cycle}/${MAX_DEV_CYCLES} starts${session.findings ? " with external findings" : ""}`, [`cycle_${cycle}_dev=NOT RUN`]);
      await agent(developerPrompt(target, session.findings, cycle), { label: `[PR-FOLLOW/DEV] ${target.task} #${cycle}`, role: "developer" });
      await emit(PHASES.DEVELOP, "WORKING", `cycle ${cycle} development reported`, [`cycle_${cycle}_dev=PASS`]);
      settle(session, `dev-${cycle}`);
      store.save(session);
    }
    if (!settled(session, `review-${cycle}`)) {
      await emit(PHASES.REVIEW, "WORKING", `cycle ${cycle} internal review starts`, [`cycle_${cycle}_review=NOT RUN`]);
      const verdict = String((await agent(reviewerPrompt(target, cycle), { label: `[PR-FOLLOW/REVIEW] ${target.task} #${cycle}`, role: "reviewer" })) ?? "").trim();
      session.verdict = /^PASS\b/i.test(verdict) ? "PASS" : "CHANGES";
      if (session.verdict !== "PASS") session.findings = verdict;
      await emit(PHASES.REVIEW, "WORKING", `cycle ${cycle} internal review ${session.verdict}`, [`cycle_${cycle}_review=${session.verdict === "PASS" ? "PASS" : "FAIL"}`]);
      settle(session, `review-${cycle}`);
      store.save(session);
    }
    if (session.verdict !== "PASS") {
      session.cycle += 1;
      store.save(session);
      continue;
    }
    if (!settled(session, `bot-${cycle}`)) {
      const result = await poll({
        phase: PHASES.BOT_REVIEW,
        reason: REASON.BOT_REVIEW_PENDING,
        read: () => github.botFindings(target),
        emit,
        sleep,
        checks: ["bot_review=NOT RUN"],
      });
      if (!result.settled) {
        await emit(PHASES.BOT_REVIEW, "BLOCKED", `${REASON.POLL_BOUND_EXCEEDED}: external review after ${result.attempts} polls`, ["bot_review=BLOCKED"]);
        return finish("BLOCKED", REASON.POLL_BOUND_EXCEEDED);
      }
      session.bot_findings = result.value.findings;
      await emit(
        PHASES.BOT_REVIEW,
        "WORKING",
        session.bot_findings.length
          ? `${session.bot_findings.length} external findings kept verbatim for the next cycle`
          : "external reviewer reported no findings",
        [`bot_review=${session.bot_findings.length ? "FAIL" : "PASS"}`],
      );
      settle(session, `bot-${cycle}`);
      store.save(session);
    }
    if (session.bot_findings.length === 0) break;
    session.findings = session.bot_findings.join("\n");
    session.cycle += 1;
    store.save(session);
  }

  if (session.cycle > MAX_DEV_CYCLES) {
    await emit(PHASES.REVIEW, "BLOCKED", `${REASON.REVIEW_LOOP_CAP}: findings still open after ${MAX_DEV_CYCLES} cycles`, ["bot_review=BLOCKED"]);
    return finish("BLOCKED", REASON.REVIEW_LOOP_CAP);
  }

  // 3. CI, review approval and mergeability are polled, never agent-checked.
  if (!settled(session, "ci")) {
    const result = await poll({ phase: PHASES.CI, reason: REASON.CI_PENDING, read: () => github.ci(target), emit, sleep, checks: ["ci=NOT RUN"] });
    if (!result.settled) {
      await emit(PHASES.CI, "BLOCKED", `${REASON.POLL_BOUND_EXCEEDED}: CI after ${result.attempts} polls`, ["ci=BLOCKED"]);
      return finish("BLOCKED", REASON.POLL_BOUND_EXCEEDED);
    }
    if (result.value.state === "failure") {
      await emit(PHASES.CI, "FAILED", `${REASON.CI_FAILED}: CI concluded without success`, ["ci=FAIL"]);
      return finish("BLOCKED", REASON.CI_FAILED);
    }
    await emit(PHASES.CI, "WORKING", "CI concluded successfully", ["ci=PASS"]);
    settle(session, "ci");
    store.save(session);
  }

  if (!settled(session, "approval")) {
    const result = await poll({ phase: PHASES.APPROVAL, reason: REASON.APPROVAL_PENDING, read: () => github.approval(target), emit, sleep, checks: ["approval=NOT RUN"] });
    if (!result.settled) {
      await emit(PHASES.APPROVAL, "BLOCKED", `${REASON.POLL_BOUND_EXCEEDED}: review approval after ${result.attempts} polls`, ["approval=BLOCKED"]);
      return finish("BLOCKED", REASON.POLL_BOUND_EXCEEDED);
    }
    if (!result.value.approved) {
      await emit(PHASES.APPROVAL, "BLOCKED", `${REASON.DECISION_REQUIRED}: review did not approve the change`, ["approval=BLOCKED"]);
      return finish("BLOCKED", REASON.DECISION_REQUIRED);
    }
    await emit(PHASES.APPROVAL, "WORKING", "review approved the change", ["approval=PASS"]);
    settle(session, "approval");
    store.save(session);
  }

  if (!settled(session, "mergeability")) {
    const result = await poll({ phase: PHASES.MERGE, reason: REASON.MERGE_PENDING, read: () => github.mergeability(target), emit, sleep, checks: ["merge=NOT RUN"] });
    if (!result.settled) {
      await emit(PHASES.MERGE, "BLOCKED", `${REASON.POLL_BOUND_EXCEEDED}: mergeability after ${result.attempts} polls`, ["merge=BLOCKED"]);
      return finish("BLOCKED", REASON.POLL_BOUND_EXCEEDED);
    }
    if (!result.value.mergeable) {
      await emit(PHASES.MERGE, "BLOCKED", `${REASON.MERGE_BLOCKED}: the pull request is not cleanly mergeable`, ["merge=FAIL"]);
      return finish("BLOCKED", REASON.MERGE_BLOCKED);
    }
    settle(session, "mergeability");
    store.save(session);
  }

  // 4. Merging stays with the master unless the caller pre-authorizes it.
  if (input.merge !== "auto") {
    if (!settled(session, "decision")) {
      session.pending ??= {
        question_id: `ask:${target.task}:merge`,
        question: `Authorize merging ${target.task}: CI, review and mergeability are clean.`,
      };
      const answered = await answer(target.task, session.pending.question_id);
      if (!answered) {
        if (!session.asked) {
          await tools.orch_ask({
            task: target.task,
            id: session.pending.question_id,
            question: session.pending.question,
            run: ports.run,
          });
          session.asked = true;
          store.save(session);
        }
        await emit(PHASES.MERGE, "BLOCKED", `${REASON.DECISION_REQUIRED}: ${session.pending.question}`, ["merge=BLOCKED"]);
        return finish("PAUSED", REASON.DECISION_REQUIRED);
      }
      session.answer = answered;
      session.pending = null;
      settle(session, "decision");
      store.save(session);
    }
    await emit(PHASES.MERGE, "WORKING", `merge authorized: ${session.answer}`, ["merge=PASS"]);
    return finish("COMPLETED");
  }

  await emit(PHASES.MERGE, "WORKING", `${target.task} is ready to merge`, ["merge=PASS"]);
  return finish("COMPLETED");
}

export function githubPorts(shell) {
  const json = async (command) => {
    const { exitCode, stdout } = await shell(command);
    if (exitCode !== 0) return null;
    const text = String(stdout ?? "").trim();
    return text ? JSON.parse(text) : null;
  };
  const text = async (command) => {
    const { exitCode, stdout } = await shell(command);
    return exitCode === 0 ? String(stdout ?? "").trim() : null;
  };
  return {
    async inspect({ number }) {
      // NOTE: a failed gh call is indistinguishable from a missing record here, so
      // a transport error rejects the run instead of burning a cycle on it.
      const pullRequest = await text(`gh api repos/{owner}/{repo}/issues/${number} --jq 'has("pull_request")'`);
      return { exists: pullRequest !== null, pullRequest: pullRequest === "true" };
    },
    async botFindings({ number }) {
      // The REST review object carries the author type, which the GraphQL
      // reviews payload does not: a Bot actor often has no "[bot]" login
      // suffix, so the suffix alone would miss it.
      const reviews = await json(`gh api repos/{owner}/{repo}/pulls/${number}/reviews`);
      // NOTE: a failed gh call is treated as "not reviewed yet" and the bounded poll escalates.
      if (!reviews) return { pending: true, findings: [] };
      const findings = reviews
        .filter((review) => (review.user?.type === "Bot" || review.user?.login?.endsWith("[bot]")) && review.body?.length > 0)
        .map((review) => review.body);
      return { pending: findings.length === 0 && reviews.length === 0, findings };
    },
    async ci({ number }) {
      const data = await json(`gh pr checks ${number} --json state --jq '{"pending": any(.state | test("PENDING|QUEUED|IN_PROGRESS")), "failure": any(.state | test("FAILURE|ERROR|CANCELLED|TIMED_OUT"))}'`);
      if (!data) return { pending: true };
      return { pending: data.pending, state: data.failure ? "failure" : data.pending ? "pending" : "success" };
    },
    async approval({ number }) {
      const decision = await text(`gh pr view ${number} --json reviewDecision --jq '.reviewDecision'`);
      if (decision === null) return { pending: true };
      const normalized = decision === "null" ? "" : decision;
      return { pending: normalized === "", approved: normalized === "APPROVED" };
    },
    async mergeability({ number }) {
      const data = await json(`gh pr view ${number} --json mergeable,mergeStateStatus --jq '{"mergeable": .mergeable, "merge_state": .mergeStateStatus}'`);
      if (!data) return { pending: true };
      const unknown = data.mergeable === "UNKNOWN" || data.merge_state === "UNKNOWN";
      return { pending: unknown, mergeable: data.merge_state === "CLEAN" && data.mergeable === "MERGEABLE" };
    },
  };
}

function workflowPorts(context) {
  const dir = runDir({ run: context.run.runId });
  return {
    github: githubPorts((command) => context.shell(command)),
    agent: (prompt, options) => context.agent(prompt, options),
    tools: context.tools,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    store: createFileStore({ dir }),
    answer: mailboxAnswer({ dir }),
    run: context.run.runId,
  };
}

export const PR_FOLLOW_EXTENSION = Object.freeze({
  version: "1.0.0",
  headline: "Deterministic PR-following workflow",
  source: import.meta.url,
  functions: {
    prFollow: {
      description: "Follow one issue or pull request through developer/reviewer cycles, external findings, zero-agent CI/review/merge polling, and a mailbox decision that resumes after orch_reply.",
      input: {
        type: "object",
        properties: {
          target: { type: "string", enum: ["issue", "pr"] },
          id: { type: "integer", minimum: 1 },
          merge: { type: "string", enum: ["human", "auto"], description: "human asks the master before merge; auto pre-authorizes the merge step" },
        },
        required: ["target", "id"],
        additionalProperties: false,
      },
      output: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["REJECTED", "BLOCKED", "PAUSED", "COMPLETED"] },
          reason: { type: "string" },
          task: { type: "string" },
          cycle: { type: "integer", minimum: 1 },
          question_id: { type: "string" },
        },
        required: ["status", "reason", "task", "cycle", "question_id"],
        additionalProperties: false,
      },
      run(input, context) {
        return runPrFollow(input, workflowPorts(context));
      },
    },
  },
});

export function registerPrFollow(registry) {
  if (!registry?.registerWorkflowExtension) return false;
  registry.registerWorkflowExtension(PR_FOLLOW_EXTENSION);
  return true;
}

// The installed host keeps PiWorkflow under ~/.pi/agent/npm/node_modules, where
// import.meta.resolve from this repository cannot see it.
export function registryUrls({ resolve = (specifier) => import.meta.resolve(specifier), require = createRequire(join(homedir(), ".pi", "agent", "npm", "package.json")) } = {}) {
  const urls = [];
  try { urls.push(resolve("pi-extensible-workflows/registry")); } catch { /* no repo-local package */ }
  try { urls.push(pathToFileURL(require.resolve("pi-extensible-workflows/registry")).href); } catch { /* host install absent */ }
  return urls;
}

export default async function registerPrFollowExtension({ candidateUrls, importModule = (url) => import(url), ...options } = {}) {
  let registry;
  for (const url of candidateUrls ?? registryUrls(options)) {
    try { registry = await importModule(url); break; } catch (error) { if (error?.code !== "ERR_MODULE_NOT_FOUND") throw error; }
  }
  if (!registry) return;
  if (registry.loadingRegistry().frozen) return;
  registerPrFollow(registry);
}
