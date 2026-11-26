import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { ask, fileFor, reply, report } from "../skills/pi-herdr-orchestrator/scripts/mailbox.mjs";
import registerPrFollowExtension, {
  MAX_DEV_CYCLES,
  MAX_POLL_ATTEMPTS,
  POLL_INTERVAL_MS,
  PR_FOLLOW_EXTENSION,
  REASON,
  createFileStore,
  githubPorts,
  mailboxAnswer,
  parseTarget,
  registerPrFollow,
  runPrFollow,
} from "./pr-follow.mjs";

const exhaust = () => {
  throw new Error("github port exhausted");
};

const cleanGithub = (overrides = {}) => ({
  inspect: async () => ({ exists: true, pullRequest: true }),
  botFindings: async () => ({ pending: false, findings: [] }),
  ci: async () => ({ pending: false, state: "success" }),
  approval: async () => ({ pending: false, approved: true }),
  mergeability: async () => ({ pending: false, mergeable: true }),
  ...overrides,
});

function harness({ github, dir = mkdtempSync(join(tmpdir(), "pr-follow-")) }) {
  const reports = [];
  const asks = [];
  const launches = [];
  let sleeps = 0;
  // The harness tools persist through the real mailbox, so the records the
  // workflow emits are exactly what orch_status reads.
  const tools = {
    async orch_report(args) {
      reports.push(args);
      report({ ...args, dir, silent: true });
      return { content: [{ type: "text", text: `reported ${args.state}` }] };
    },
    async orch_ask(args) {
      asks.push(args);
      ask({ task: args.task, id: args.id, question: args.question, dir, silent: true });
      return { content: [{ type: "text", text: `question_id=${args.id}` }] };
    },
  };
  const ports = {
    github,
    tools,
    run: "run-dry",
    sleep: async () => {
      sleeps += 1;
    },
    agent: async (prompt, options) => {
      launches.push({ prompt, options });
      return "PASS";
    },
    store: createFileStore({ dir }),
    answer: mailboxAnswer({ dir }),
  };
  return {
    dir,
    reports,
    asks,
    launches,
    counts: () => ({ sleeps, launches: launches.length }),
    record: () => JSON.parse(readFileSync(join(dir, fileFor("PR#27")), "utf8")),
    run: (input) => runPrFollow(input, ports),
  };
}

test("parseTarget rejects unknown kinds and malformed ids", () => {
  assert.deepEqual(parseTarget({ target: "pr", id: 27 }), { kind: "pr", number: 27, task: "PR#27" });
  assert.deepEqual(parseTarget({ target: "issue", id: "27" }), { kind: "issue", number: 27, task: "I#27" });
  assert.throws(() => parseTarget({ target: "pull-request", id: 27 }), /target must be/);
  assert.throws(() => parseTarget({ target: "pr", id: "PR#27" }), /ID_INVALID/);
  assert.throws(() => parseTarget({ target: "pr", id: 0 }), /ID_INVALID/);
  assert.throws(() => parseTarget({ target: "pr", id: "" }), /ID_INVALID/);
});

test("a non-existent id is rejected before any agent launch", async () => {
  const h = harness({ github: cleanGithub({ inspect: async () => ({ exists: false, pullRequest: false }) }) });

  const result = await h.run({ target: "pr", id: 27 });

  assert.equal(result.status, "REJECTED");
  assert.equal(result.reason, REASON.ID_NOT_FOUND);
  assert.deepEqual(h.counts(), { sleeps: 0, launches: 0 });
  assert.equal(h.reports.at(-1).state, "FAILED");
  assert.ok(h.reports.at(-1).checks.includes("id=FAIL"));
  assert.ok(h.reports.at(-1).summary.includes(REASON.ID_NOT_FOUND));
  assert.equal(h.record().state, "FAILED");
  rmSync(h.dir, { recursive: true, force: true });
});

test("a mismatched id kind is rejected before any agent launch", async () => {
  const h = harness({ github: cleanGithub({ inspect: async () => ({ exists: true, pullRequest: true }) }) });

  const result = await h.run({ target: "issue", id: 27 });

  assert.equal(result.status, "REJECTED");
  assert.equal(result.reason, REASON.ID_KIND_MISMATCH);
  assert.equal(h.counts().launches, 0);
  assert.ok(h.reports.at(-1).summary.includes(REASON.ID_KIND_MISMATCH));
  rmSync(h.dir, { recursive: true, force: true });
});

test("waiting phases poll with a documented interval and launch no agent", async () => {
  let ciCalls = 0;
  const h = harness({
    github: cleanGithub({
      ci: async () => {
        ciCalls += 1;
        return ciCalls < 3 ? { pending: true } : { pending: false, state: "success" };
      },
    }),
  });

  const result = await h.run({ target: "pr", id: 27, merge: "auto" });

  assert.equal(result.status, "COMPLETED");
  assert.equal(ciCalls, 3);
  assert.equal(h.counts().launches, 2, "one developer and one reviewer launch only");
  const waits = h.reports.filter((entry) => entry.phase === "CI" && entry.checks.includes("ci=NOT RUN"));
  assert.equal(waits.length, 2);
  assert.equal(h.counts().sleeps, 2, "one bounded interval per pending poll");
  for (const wait of waits) {
    assert.ok(wait.summary.includes(REASON.CI_PENDING));
    assert.ok(wait.summary.includes(`${POLL_INTERVAL_MS / 1000}s`));
  }
  assert.ok(h.reports.at(-1).checks.includes("merge=PASS"));
  assert.equal(h.record().checks.find((check) => check.name === "merge").status, "PASS");
  assert.equal(h.record().lifecycle, "running");
  assert.ok(Object.hasOwn(h.record().usage.phases, "CI"), "the CI phase is visible in the mailbox the supervisor reads");
  rmSync(h.dir, { recursive: true, force: true });
});

test("bounded polling gives up with a reason code and no agent", async () => {
  const h = harness({ github: cleanGithub({ ci: async () => ({ pending: true }) }) });

  const result = await h.run({ target: "pr", id: 27 });

  assert.equal(result.status, "BLOCKED");
  assert.equal(result.reason, REASON.POLL_BOUND_EXCEEDED);
  assert.equal(h.counts().launches, 2);
  assert.equal(h.counts().sleeps, MAX_POLL_ATTEMPTS - 1);
  assert.ok(h.reports.at(-1).summary.includes(REASON.POLL_BOUND_EXCEEDED));
  rmSync(h.dir, { recursive: true, force: true });
});

test("external bot findings feed the next dev cycle verbatim and the loop caps", async () => {
  const finding = "src/a.ts:12 unexpected `any`\n  second line preserved";
  const h = harness({ github: cleanGithub({ botFindings: async () => ({ pending: false, findings: [finding] }) }) });

  const result = await h.run({ target: "pr", id: 27 });

  assert.equal(result.status, "BLOCKED");
  assert.equal(result.reason, REASON.REVIEW_LOOP_CAP);
  assert.equal(result.cycle, MAX_DEV_CYCLES + 1);
  assert.equal(h.counts().launches, MAX_DEV_CYCLES * 2);
  const devPrompts = h.launches.filter((launch) => launch.options.label.includes("[PR-FOLLOW/DEV]")).map((launch) => launch.prompt);
  assert.equal(devPrompts.length, MAX_DEV_CYCLES);
  for (const prompt of devPrompts.slice(1)) assert.ok(prompt.includes(finding), "later cycles carry the finding byte for byte");
  rmSync(h.dir, { recursive: true, force: true });
});

test("an unautomatable decision asks, pauses and resumes from the mailbox reply", async () => {
  const h = harness({ github: cleanGithub() });

  const paused = await h.run({ target: "pr", id: 27 });

  assert.equal(paused.status, "PAUSED");
  assert.equal(paused.reason, REASON.DECISION_REQUIRED);
  assert.equal(paused.question_id, "ask:PR#27:merge");
  assert.equal(h.asks.length, 1);
  assert.equal(h.asks[0].id, paused.question_id);
  assert.equal(h.record().state, "BLOCKED");
  assert.equal(h.record().lifecycle, "blocked");
  const launchesAtPause = h.counts().launches;

  const reentry = await h.run({ target: "pr", id: 27 });
  assert.equal(reentry.status, "PAUSED");
  assert.equal(h.asks.length, 1, "re-entry does not duplicate the question");
  assert.equal(h.counts().launches, launchesAtPause, "no agent relaunch while paused");

  // The master answers through the same mailbox operation as orch_reply.
  reply({ dir: h.dir, task: "PR#27", question_id: paused.question_id, answer: "approved: merge it", silent: true });

  const resumed = await h.run({ target: "pr", id: 27 });

  assert.equal(resumed.status, "COMPLETED");
  assert.equal(h.counts().launches, launchesAtPause, "resume never repeats completed work");
  assert.ok(h.reports.at(-1).checks.includes("merge=PASS"));
  assert.equal(h.record().state, "WORKING");
  rmSync(h.dir, { recursive: true, force: true });
});

test("the workflow registers through the existing workflow extension registry", () => {
  const registered = [];
  const registry = { registerWorkflowExtension: (value) => registered.push(value) };

  assert.equal(registerPrFollow(registry), true);
  assert.equal(registered.length, 1);
  const extension = registered[0];
  assert.equal(extension.headline, PR_FOLLOW_EXTENSION.headline);
  assert.match(extension.version, /^\d+\.\d+\.\d+$/);
  const fn = extension.functions.prFollow;
  assert.equal(fn.input.type, "object");
  assert.deepEqual(fn.input.required, ["target", "id"]);
  assert.equal(fn.input.additionalProperties, false);
  assert.equal(fn.output.type, "object");
  assert.equal(typeof fn.run, "function");
  assert.equal(registerPrFollow(null), false);
});

test("the gh adapter reads target facts without launching anything", async () => {
  const commands = [];
  const shell = (map) => async (command) => {
    const match = map.find(([needle]) => command.includes(needle));
    return match ? { exitCode: 0, stdout: match[1] } : { exitCode: 1, stdout: "" };
  };

  const pending = githubPorts(shell([["gh pr checks", '{"pending": true, "failure": false}']]));
  assert.deepEqual(await pending.ci({ number: 27 }), { pending: true, state: "pending" });

  const failed = githubPorts(shell([["gh pr checks", '{"pending": false, "failure": true}']]));
  assert.deepEqual(await failed.ci({ number: 27 }), { pending: false, state: "failure" });

  const merge = githubPorts(shell([["--json mergeable", '{"mergeable": "MERGEABLE", "merge_state": "CLEAN"}']]));
  assert.deepEqual(await merge.mergeability({ number: 27 }), { pending: false, mergeable: true });

  const inspection = githubPorts(shell([["issues/27", "true"]]));
  assert.deepEqual(await inspection.inspect({ number: 27 }), { exists: true, pullRequest: true });

  const missing = githubPorts(shell([]));
  assert.deepEqual(await missing.inspect({ number: 27 }), { exists: false, pullRequest: false });
  assert.ok(commands.every((command) => command.startsWith("gh ")));
});

test("the gh adapter keeps findings from Bot authors that have no [bot] login suffix", async () => {
  const botFinding = "src/a.ts:7 unexpected `any`\n  second line preserved";
  const reviews = [
    { body: botFinding, user: { login: "codex-reviewer", type: "Bot" } },
    { body: "please rename this helper", user: { login: "alice", type: "User" } },
    { body: "", user: { login: "renovate[bot]", type: "Bot" } },
    { body: null, user: { login: "suffixed[bot]", type: "Bot" } },
  ];
  const commands = [];
  const ports = githubPorts(async (command) => {
    commands.push(command);
    return command.includes("pulls/27/reviews") ? { exitCode: 0, stdout: JSON.stringify(reviews) } : { exitCode: 1, stdout: "" };
  });

  assert.deepEqual(await ports.botFindings({ number: 27 }), { pending: false, findings: [botFinding] });
  assert.ok(commands[0].startsWith("gh api "), "the review query must expose the author type");

  const unreviewed = githubPorts(async () => ({ exitCode: 0, stdout: "[]" }));
  assert.deepEqual(await unreviewed.botFindings({ number: 27 }), { pending: true, findings: [] });
});

test("registration falls back to the agent npm install when the repo has no local package", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pr-follow-registry-"));
  const stub = join(dir, "registry.mjs");
  writeFileSync(
    stub,
    'export const loadingRegistry = () => ({ frozen: false });\nexport const registered = [];\nexport const registerWorkflowExtension = (value) => registered.push(value.headline);\n',
  );
  const requested = [];
  const notInstalled = () => {
    throw Object.assign(new Error("Cannot find module 'pi-extensible-workflows/registry'"), { code: "ERR_MODULE_NOT_FOUND" });
  };

  await registerPrFollowExtension({
    resolve: notInstalled,
    require: { resolve: (specifier) => {
      requested.push(specifier);
      return stub;
    } },
    importModule: async (url) => import(url),
  });

  assert.deepEqual(requested, ["pi-extensible-workflows/registry"]);
  assert.deepEqual((await import(pathToFileURL(stub).href)).registered, [PR_FOLLOW_EXTENSION.headline]);
  rmSync(dir, { recursive: true, force: true });
});

test("registration stays a no-op when neither layout provides the registry", async () => {
  const notInstalled = () => {
    throw Object.assign(new Error("Cannot find module 'pi-extensible-workflows/registry'"), { code: "ERR_MODULE_NOT_FOUND" });
  };

  assert.equal(await registerPrFollowExtension({ resolve: notInstalled, require: { resolve: notInstalled } }), undefined);
});
