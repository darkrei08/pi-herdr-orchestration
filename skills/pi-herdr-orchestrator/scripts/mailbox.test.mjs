import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { classify, classifyLiveness, storeEvidence, readEvidence, deriveLifecycle, fileFor, parse, report, ask, reply, runDir, validateEvidenceBinding, STATES, LIFECYCLE_STATES } from "./mailbox.mjs";
import { withLock } from "./lock.mjs";

const now = Date.parse("2026-10-09T12:00:00Z");
const min = 60_000;
const entry = (state, agoMin = 0, extra = {}) => ({
  state,
  updated_at: new Date(now - agoMin * min).toISOString(),
  ...extra
});
const live = (agent_status) => ({ agent_status });

test("classify flags what needs master action", () => {
  const identity = { pane: "w7D:p1", session: "test-session" };
  const agent = (agent_status) => ({ agent_status, pane_id: identity.pane, agent_session: { value: identity.session } });
  const identified = (state, agoMin = 0, extra = {}) => entry(state, agoMin, { identity, ...extra });
  assert.equal(classify(identified("WORKING"), agent("working"), now, 10 * min), "OK");
  assert.equal(classify(identified("WORKING", 11), agent("working"), now, 10 * min), "STALE");
  assert.equal(classify(identified("WORKING"), agent("idle"), now, 10 * min), "SILENT");
  assert.equal(classify(identified("ASSIGNED"), agent("done"), now, 10 * min), "SILENT");
  assert.equal(classify(identified("WORKING"), agent("blocked"), now, 10 * min), "NEEDS_HUMAN");
  assert.equal(classify(entry("WORKING"), undefined, now, 10 * min), "GONE");
  assert.equal(classify(identified("READY"), agent("idle"), now, 10 * min), "DECIDE");
  assert.equal(classify(identified("BLOCKED"), agent("working"), now, 10 * min), "DECIDE");
  assert.equal(classify(entry("CLOSED"), undefined, now, 10 * min), "GONE");
  assert.equal(classify(identified("WORKING"), agent("unknown"), now, 10 * min), "DECIDE");
  assert.equal(classify(identified("BLOCKED", 0, { pending_ask: { question: "Q?" } }), agent("idle"), now, 10 * min), "ASK");
  assert.equal(classify(identified("BLOCKED", 0, { pending_ask: { question: "Q?" } }), agent("blocked"), now, 10 * min), "ASK");
  assert.equal(classify(identified("BLOCKED", 0, { pending_ask: { question: "Q?" } }), agent("unknown"), now, 10 * min), "DECIDE");
});

const sessionPath = "/root/.pi/agent/sessions/x--/2026-10-31T15-47-02-621Z_01a192a4-975c-7524-b395-6fc6e737f235.jsonl";
const recorded = { pane: "w7D:p1", session: "01a192a4-975c-7524-b395-6fc6e737f235" };
const liveAgent = (agent_status, pane_id, session) => ({ agent_status, pane_id, agent_session: { value: session } });
const candidateAtHead = () => spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
const candidateReview = (task, candidate, version = "2.10.1") => {
  const parents = spawnSync("git", ["rev-list", "--parents", "-n", "1", candidate], { encoding: "utf8" });
  const parentIds = parents.status === 0 ? parents.stdout.trim().split(/\s+/).slice(1) : [];
  const changedCommands = parentIds.length
    ? parentIds.map((parent) => ["diff", "--name-only", "-z", parent, candidate])
    : [["diff-tree", "--root", "--no-commit-id", "--name-only", "-z", "-r", candidate]];
  const changedPaths = new Set();
  for (const args of changedCommands) {
    const changed = spawnSync("git", args, { encoding: "utf8" });
    if (changed.status === 0) {
      for (const path of changed.stdout.split("\0").filter(Boolean)) {
        changedPaths.add(path);
      }
    }
  }
  const file_hashes = {};
  for (const path of changedPaths) {
    const file = spawnSync("git", ["show", `${candidate}:${path}`], { encoding: null }).stdout;
    file_hashes[path] = createHash("sha256").update(file).digest("hex");
  }
  const rules = spawnSync("git", ["show", `${candidate}:AGENTS.md`], { encoding: null }).stdout;
  const gga = readFileSync(".gga");
  const config_digest = createHash("sha256")
    .update("AGENTS.md\\0").update(rules)
    .update(".gga\\0").update(gga)
    .digest("hex");
  return { task, run: "run-test", candidate, provider: "gga", status: "PASS", version, config_digest, output_digest: "0".repeat(64), file_hashes, deleted_files: [] };
};
const memoryEvidence = (dir, task, candidate, observation = "obs-test") => {
  const memory = { task, run: "run-test", candidate, provider: "engram", status: "PERSISTED", ref: `engram:${observation}` };
  memory.receipt = storeEvidence(dir, JSON.stringify(memory));
  return memory;
};

test("identity correlation decides on a reused pane or session", () => {
  const trace = entry("WORKING", 0, { identity: recorded });

  const match = classifyLiveness(trace, liveAgent("working", "w7D:p1", sessionPath), now, 10 * min);
  assert.equal(match.flag, "OK");
  assert.equal(match.state, "live");

  const reusedPane = classifyLiveness(trace, liveAgent("working", "w7D:p9", sessionPath), now, 10 * min);
  assert.equal(reusedPane.flag, "DECIDE");
  assert.equal(reusedPane.state, "decide");
  assert.match(reusedPane.reason, /w7D:p1/);
  assert.match(reusedPane.reason, /w7D:p9/);

  const reusedSession = classifyLiveness(trace, liveAgent("working", "w7D:p1", "/tmp/2026-10-31T15-47-02-621Z_01a19999-975c-7524-b395-6fc6e737f235.jsonl"), now, 10 * min);
  assert.equal(reusedSession.flag, "DECIDE");

  const silentLive = classifyLiveness(trace, liveAgent("working", "w7D:p1", undefined), now, 10 * min);
  assert.equal(silentLive.flag, "DECIDE");
  assert.equal(silentLive.state, "unverified");

  const paneOnly = classifyLiveness(entry("WORKING", 0, { identity: { pane: recorded.pane } }), liveAgent("working", recorded.pane, sessionPath), now, 10 * min);
  assert.equal(paneOnly.flag, "DECIDE");
  assert.equal(paneOnly.state, "unverified");
});

test("legacy record without identity stays unverified", () => {
  const legacy = classifyLiveness(entry("WORKING"), liveAgent("working", "w7D:p1", sessionPath), now, 10 * min);
  assert.equal(legacy.flag, "DECIDE");
  assert.equal(legacy.state, "unverified");
  assert.match(legacy.reason, /no identity/);

  const readyWithoutIdentity = classifyLiveness(entry("READY"), liveAgent("idle", "w7D:p1", sessionPath), now, 10 * min);
  assert.equal(readyWithoutIdentity.flag, "DECIDE");
  assert.equal(readyWithoutIdentity.state, "unverified");

  const closed = classifyLiveness(entry("CLOSED"), undefined, now, 10 * min);
  assert.equal(closed.flag, "GONE");
  const contradictoryClosed = classifyLiveness(entry("CLOSED", 0, { lifecycle: "running", identity: recorded }), { agent_status: "working" }, now, 10 * min);
  assert.equal(contradictoryClosed.flag, "DECIDE");
  assert.equal(closed.state, "decide");

  const closedWithIdentity = classifyLiveness(entry("CLOSED", 0, { identity: recorded }), liveAgent("idle", "w7D:p1", sessionPath), now, 10 * min);
  assert.equal(closedWithIdentity.flag, "OK");
  assert.equal(closedWithIdentity.state, "closed");
});

test("report records pane and session identity and preserves it across reports", () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-identity-"));
  try {
    const first = report({
      dir,
      run: "run-test",
      task: "I#103",
      state: "ASSIGNED",
      summary: "Assigned",
      pane: "w7D:p1",
      session: sessionPath,
      silent: true,
      nonBlocking: true
    });
    assert.deepEqual(first.identity, recorded);

    const second = report({ dir, run: "run-test", task: "I#103", state: "WORKING", summary: "Working", silent: true, nonBlocking: true });
    assert.deepEqual(second.identity, recorded);

    const saved = JSON.parse(readFileSync(join(dir, "I-103.json"), "utf8"));
    assert.deepEqual(saved.identity, recorded);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a partial identity report preserves the field it does not supply", () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-identity-merge-"));
  try {
    report({ dir, run: "run-test", task: "I#105", state: "ASSIGNED", summary: "a", pane: "w7D:p1", session: sessionPath, silent: true, nonBlocking: true });
    const second = report({ dir, run: "run-test", task: "I#105", state: "WORKING", summary: "b", pane: "w7D:p2", silent: true, nonBlocking: true });
    assert.deepEqual(second.identity, { pane: "w7D:p2", session: recorded.session });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a lifecycle that contradicts the state is not treated as closed", () => {
  const contradictory = entry("WORKING", 0, { lifecycle: "closed" });
  const result = classifyLiveness(contradictory, liveAgent("working", "w7D:p1", sessionPath), now, 10 * min);
  assert.equal(result.flag, "DECIDE");
  assert.equal(result.state, "decide");
  assert.match(result.reason, /state is WORKING/);
});

test("a corrupt record is refused instead of silently overwritten", () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-corrupt-"));
  try {
    const file = join(dir, "I-104.json");
    writeFileSync(file, "{ not json");
    assert.throws(() => report({ dir, run: "run-test", task: "I#104", state: "WORKING", summary: "x", silent: true, nonBlocking: true }));
    assert.equal(readFileSync(file, "utf8"), "{ not json");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("storeEvidence hashes and stores files deduplicated", () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-test-"));
  try {
    const content = "Very large test log output that would pollute context windows";
    const ref1 = storeEvidence(dir, content);
    const ref2 = storeEvidence(dir, content);
    assert.equal(ref1, ref2);
    assert.ok(ref1.startsWith("ref:sha256:"));
    writeFileSync(join(dir, "evidence", `${ref1.slice("ref:sha256:".length)}.txt`), "tampered");
    assert.throws(() => storeEvidence(dir, content), /evidence file hash mismatch/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("validateEvidenceBinding accepts review and memory evidence for the exact candidate", () => {
  const result = validateEvidenceBinding({
    task: "I#106",
    run: "run-test",
    candidate: "commit-106",
    review: { task: "I#106", run: "run-test", candidate: "commit-106", provider: "gga", status: "PASS", ref: `ref:sha256:${"a".repeat(64)}`, version: "2.10.1", config_digest: "b".repeat(64), output_digest: "c".repeat(64), file_hashes: { "mailbox.mjs": "a".repeat(64) } },
    memory: { task: "I#106", run: "run-test", candidate: "commit-106", provider: "engram", status: "PERSISTED", ref: "engram:obs-106", receipt: `ref:sha256:${"c".repeat(64)}` }
  }, { task: "I#106", run: "run-test", candidate: "commit-106" });

  assert.equal(result.status, "verified");
});

test("validateEvidenceBinding accepts candidate deletion evidence separately from file hashes", () => {
  const result = validateEvidenceBinding({
    task: "I#106-delete",
    run: "run-test",
    candidate: "commit-106-delete",
    review: {
      task: "I#106-delete",
      run: "run-test",
      candidate: "commit-106-delete",
      provider: "gga",
      status: "PASS",
      ref: `ref:sha256:${"a".repeat(64)}`,
      version: "2.10.1",
      config_digest: "b".repeat(64),
      output_digest: "e".repeat(64),
      file_hashes: {},
      deleted_files: [{ path: "obsolete.mjs", diff_hash: "c".repeat(64) }]
    },
    memory: {
      task: "I#106-delete",
      run: "run-test",
      candidate: "commit-106-delete",
      provider: "engram",
      status: "PERSISTED",
      ref: "engram:obs-106-delete",
      receipt: `ref:sha256:${"d".repeat(64)}`
    }
  }, { task: "I#106-delete", run: "run-test", candidate: "commit-106-delete" });

  assert.equal(result.status, "verified");
});

test("validateEvidenceBinding blocks evidence from another task or candidate", () => {
  const result = validateEvidenceBinding({
    task: "I#106",
    run: "run-test",
    candidate: "commit-106",
    review: { task: "I#106", run: "run-test", candidate: "commit-other", provider: "gga", status: "PASS", ref: `ref:sha256:${"a".repeat(64)}`, version: "2.10.1", config_digest: "b".repeat(64), file_hashes: { "mailbox.mjs": "a".repeat(64) } },
    memory: { task: "I#106", run: "run-test", candidate: "commit-106", provider: "engram", status: "PERSISTED", ref: "engram:obs-106", receipt: `ref:sha256:${"c".repeat(64)}` }
  }, { task: "I#106", run: "run-test", candidate: "commit-106" });

  assert.equal(result.status, "blocked");
  assert.match(result.reason, /candidate/);
});

test("report keeps unavailable review or memory evidence blocked", () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-evidence-binding-"));
  try {
    const result = report({
      dir,
      run: "run-test",
      task: "I#107",
      candidate: "commit-107",
      state: "READY",
      summary: "Review unavailable",
      evidence_binding: {
        task: "I#107",
        run: "run-test",
        candidate: "commit-107",
        review: { task: "I#107", run: "run-test", candidate: "commit-107", provider: "gga", status: "UNVERIFIED", reason: "GGA unavailable" },
        memory: { task: "I#107", run: "run-test", candidate: "commit-107", provider: "engram", status: "PERSISTED", ref: "engram:obs-107" }
      },
      silent: true,
      nonBlocking: true
    });

    assert.equal(result.state, "BLOCKED");
    assert.equal(result.evidence_binding.status, "unverified");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("terminal checks require a check name", () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-check-name-"));
  try {
    assert.throws(() => report({ dir, run: "run-test", task: "I#112", state: "READY", checks: ["=PASS"], silent: true, nonBlocking: true }), /must be name/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("terminal reports retain required checks from earlier reports", () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-required-checks-"));
  try {
    report({
      dir,
      run: "run-test",
      task: "I#113",
      state: "WORKING",
      checks: ["unit=PASS"],
      required_checks: ["build"],
      silent: true,
      nonBlocking: true
    });
    const result = report({
      dir,
      run: "run-test",
      task: "I#113",
      candidate: "commit-113",
      state: "READY",
      checks: ["unit=PASS"],
      silent: true,
      nonBlocking: true
    });
    assert.equal(result.state, "BLOCKED");
    assert.deepEqual(result.required_checks, ["build"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("report blocks a candidate from becoming ready without evidence", () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-evidence-binding-missing-"));
  try {
    const result = report({
      dir,
      run: "run-test",
      task: "I#108",
      candidate: "commit-108",
      state: "READY",
      summary: "Evidence missing",
      silent: true,
      nonBlocking: true
    });

    assert.equal(result.state, "BLOCKED");
    assert.equal(result.evidence_binding.status, "blocked");
    assert.match(result.evidence_binding.reason, /fresh evidence binding/);
    const retried = report({
      dir,
      run: "run-test",
      task: "I#108",
      candidate: "commit-108",
      state: "READY",
      summary: "Evidence missing",
      silent: true,
      nonBlocking: true
    });
    assert.equal(retried.seq, result.seq);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("report persists a verified evidence binding with the candidate", () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-evidence-binding-ready-"));
  try {
    const candidate = candidateAtHead();
    const review = candidateReview("I#108", candidate, "4.6.0");
    const reviewRef = storeEvidence(dir, JSON.stringify(review));
    const binding = {
      task: "I#108",
      run: "run-test",
      candidate,
      review: { ...review, ref: reviewRef },
      memory: memoryEvidence(dir, "I#108", candidate, "obs-108")
    };
    const result = report({
      dir,
      run: "run-test",
      task: "I#108",
      candidate,
      state: "READY",
      summary: "Evidence verified",
      checks: ["unit=PASS"],
      required_checks: ["unit"],
      evidence_binding: binding,
      providerVerifier: () => ({ status: "verified" }),
      silent: true,
      nonBlocking: true
    });

    assert.equal(result.state, "READY");
    assert.equal(result.candidate, candidate);
    assert.equal(result.evidence_binding.status, "verified");

    const replay = report({
      dir,
      run: "run-test",
      task: "I#108",
      candidate,
      state: "READY",
      summary: "Evidence verified",
      checks: ["unit=PASS"],
      required_checks: ["unit"],
      evidence_binding: binding,
      providerVerifier: () => ({ status: "verified" }),
      silent: true,
      nonBlocking: true
    });
    assert.equal(replay.state, "READY");
    assert.equal(replay.seq, result.seq);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("report retries the same blocked terminal message when provider verification recovers", () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-evidence-provider-empty-"));
  try {
    const candidate = candidateAtHead();
    let available = false;
    const review = candidateReview("I#109", candidate, "4.6.0");
    const reviewRef = storeEvidence(dir, JSON.stringify(review));
    const result = report({
      dir,
      run: "run-test",
      task: "I#109",
      candidate,
      state: "READY",
      summary: "Provider returned no result",
      checks: ["unit=PASS"],
      required_checks: ["unit"],
      evidence_binding: {
        task: "I#109",
        run: "run-test",
        candidate,
        review: { ...review, ref: reviewRef },
        memory: memoryEvidence(dir, "I#109", candidate, "obs-109")
      },
      providerVerifier: () => available ? ({ status: "verified" }) : undefined,
      silent: true,
      nonBlocking: true
    });
    assert.equal(result.state, "BLOCKED");
    assert.equal(result.evidence_binding.status, "unverified");
    const eventsAfterBlocked = readFileSync(join(dir, "events.jsonl"), "utf8").trim().split("\n");

    available = true;
    const retry = report({
      dir,
      run: "run-test",
      task: "I#109",
      candidate,
      state: "READY",
      summary: "Provider returned no result",
      checks: ["unit=PASS"],
      required_checks: ["unit"],
      evidence_binding: {
        task: "I#109",
        run: "run-test",
        candidate,
        review: { ...review, ref: reviewRef },
        memory: memoryEvidence(dir, "I#109", candidate, "obs-109")
      },
      providerVerifier: () => ({ status: "verified" }),
      silent: true,
      nonBlocking: true
    });
    assert.equal(retry.state, "READY");
    const eventsAfterRetry = readFileSync(join(dir, "events.jsonl"), "utf8").trim().split("\n");
    assert.equal(eventsAfterRetry.length, eventsAfterBlocked.length + 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("report verifies merge candidates with complete changed-file coverage", () => {
  const root = mkdtempSync(join(tmpdir(), "orch-merge-candidate-"));
  const evidenceDir = mkdtempSync(join(tmpdir(), "orch-merge-evidence-"));
  const runGit = (args) => spawnSync("git", args, { cwd: root, encoding: "utf8" });
  const previousCwd = process.cwd();
  try {
    runGit(["init", "-b", "main"]);
    runGit(["config", "user.email", "test@example.invalid"]);
    runGit(["config", "user.name", "Test"]);
    writeFileSync(join(root, "AGENTS.md"), "# Test rules\\n");
    writeFileSync(join(root, ".gga"), "provider: test\\n");
    writeFileSync(join(root, "base.txt"), "base\\n");
    runGit(["add", "."]);
    runGit(["commit", "-m", "base"]);
    runGit(["checkout", "-b", "side"]);
    writeFileSync(join(root, "side-only.txt"), "side-only\\n");
    runGit(["add", "side-only.txt"]);
    runGit(["commit", "-m", "side"]);
    runGit(["checkout", "main"]);
    writeFileSync(join(root, "main.txt"), "main\\n");
    runGit(["add", "main.txt"]);
    runGit(["commit", "-m", "main"]);
    runGit(["merge", "--no-ff", "side", "--no-edit"]);
    const candidate = runGit(["rev-parse", "HEAD"]).stdout.trim();
    const parentResult = runGit(["rev-list", "--parents", "-n", "1", candidate]);
    const parents = parentResult.stdout.trim().split(/\s+/).slice(1);
    assert.equal(parents.length, 2);
    const changed = parents.flatMap((parent) => runGit(["diff", "--name-only", "-z", parent, candidate]).stdout.split("\0").filter(Boolean));
    const deleted_files = [];
    const file_hashes = {};
    for (const path of [...new Set(changed)]) {
      file_hashes[path] = createHash("sha256").update(runGit(["show", `${candidate}:${path}`]).stdout).digest("hex");
    }
    const config_digest = createHash("sha256")
      .update("AGENTS.md\\0").update(readFileSync(join(root, "AGENTS.md")))
      .update(".gga\\0").update(readFileSync(join(root, ".gga")))
      .digest("hex");
    const review = { task: "I#merge", run: "run-test", candidate, provider: "gga", status: "PASS", version: "2.10.1", config_digest, output_digest: "0".repeat(64), file_hashes, deleted_files };
    const reviewRef = storeEvidence(evidenceDir, JSON.stringify(review));
    process.chdir(root);
    const result = report({
      dir: evidenceDir,
      run: "run-test",
      task: "I#merge",
      candidate,
      state: "READY",
      summary: "Merge evidence verified",
      checks: ["unit=PASS"],
      required_checks: ["unit"],
      evidence_binding: {
        task: "I#merge",
        run: "run-test",
        candidate,
        review: { ...review, ref: reviewRef },
        memory: memoryEvidence(evidenceDir, "I#merge", candidate, "obs-merge")
      },
      providerVerifier: () => ({ status: "verified" }),
      silent: true,
      nonBlocking: true
    });
    assert.equal(result.state, "READY");
  } finally {
    process.chdir(previousCwd);
    rmSync(root, { recursive: true, force: true });
    rmSync(evidenceDir, { recursive: true, force: true });
  }
});

test("report blocks review hashes that do not match the immutable candidate", () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-evidence-candidate-"));
  try {
    const candidate = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
    const fileHashes = { "skills/pi-herdr-orchestrator/scripts/mailbox.mjs": "a".repeat(64) };
    const review = { task: "I#110", run: "run-test", candidate, provider: "gga", status: "PASS", version: "2.10.1", config_digest: "b".repeat(64), output_digest: "c".repeat(64), file_hashes: fileHashes };
    const reviewRef = storeEvidence(dir, JSON.stringify(review));
    const result = report({
      dir,
      run: "run-test",
      task: "I#110",
      candidate,
      state: "READY",
      summary: "Stale review",
      checks: ["unit=PASS"],
      evidence_binding: {
        task: "I#110",
        run: "run-test",
        candidate,
        review: { ...review, ref: reviewRef },
        memory: memoryEvidence(dir, "I#110", candidate, "obs-110")
      },
      silent: true,
      nonBlocking: true
    });

    assert.equal(result.state, "BLOCKED");
    assert.match(result.evidence_binding.reason, /do not match the candidate|cover every file changed/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("withLock protects critical sections", () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-lock-"));
  const testFile = join(dir, "data.json");
  try {
    let executed = false;
    withLock(testFile, () => {
      executed = true;
    });
    assert.equal(executed, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("fileFor sanitizes task names correctly", () => {
  assert.equal(fileFor("I#42"), "I-42.json");
  assert.equal(fileFor("PR#127"), "PR-127.json");
  assert.equal(fileFor("task:sub"), "task-sub.json");
});

test("parse maps the documented question-id and evidence-binding options", () => {
  assert.equal(parse(["--question-id", "ask-1"]).question_id, "ask-1");
  const binding = { task: "I#106", candidate: "commit-106" };
  assert.deepEqual(parse(["--evidence-binding", JSON.stringify(binding)]).evidence_binding, binding);
});

test("report refuses a sanitized task-name collision", () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-collision-"));
  try {
    report({ dir, run: "run-test", task: "I#42", state: "WORKING", summary: "first", silent: true, nonBlocking: true });
    assert.throws(
      () => report({ dir, run: "run-test", task: "I-42", state: "WORKING", summary: "second", silent: true, nonBlocking: true }),
      /task mailbox collision/
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("deriveLifecycle maps legacy uppercase states and respects overrides", () => {
  assert.deepEqual(STATES, ["ASSIGNED", "WORKING", "READY", "DEVELOPMENT", "BLOCKED", "FAILED", "CLOSED"]);
  assert.equal(deriveLifecycle("ASSIGNED"), "pending");
  assert.equal(deriveLifecycle("WORKING"), "running");
  assert.equal(deriveLifecycle("READY"), "ready");
  assert.equal(deriveLifecycle("DEVELOPMENT"), "running");
  assert.equal(deriveLifecycle("BLOCKED"), "blocked");
  assert.equal(deriveLifecycle("FAILED"), "failed");
  assert.equal(deriveLifecycle("CLOSED"), "closed");
  assert.equal(deriveLifecycle("running"), "running");
  assert.equal(deriveLifecycle("unknown-state"), "unknown");
});

test("runDir rejects path traversal in run identifiers", () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-run-"));
  const original = process.env.ORCH_DIR;
  process.env.ORCH_DIR = dir;
  try {
    assert.throws(() => runDir({ dir: "../outside" }), /invalid orchestration directory/);
    assert.throws(() => runDir({ dir: `${dir}/../outside` }), /invalid orchestration directory/);
    assert.throws(() => runDir({ run: "../outside" }), /invalid run identifier/);
    assert.throws(() => runDir({ run: "nested/run" }), /invalid run identifier/);
    assert.equal(runDir({ dir }), dir);
    assert.equal(runDir({ run: "repo-20261009" }), join(dir, "repo-20261009"));
  } finally {
    if (original === undefined) delete process.env.ORCH_DIR;
    else process.env.ORCH_DIR = original;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readEvidence rejects path traversal references", () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-ev-safe-"));
  try {
    assert.throws(() => readEvidence(dir, "ref:sha256:../../outside"), /invalid evidence reference/);
    assert.throws(() => readEvidence(dir, "ref:sha256:short"), /invalid evidence reference/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("withLock reclaims stale locks only when the recorded owner is gone", () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-lock-stale-"));
  const testFile = join(dir, "data.json");
  const lockDir = join(dir, ".data.json.lock");
  try {
    mkdirSync(lockDir);
    writeFileSync(join(lockDir, "owner.json"), JSON.stringify({ pid: Number.MAX_SAFE_INTEGER }));
    const stale = new Date(Date.now() - 60_000);
    utimesSync(lockDir, stale, stale);
    let executed = false;
    withLock(testFile, () => { executed = true; });
    assert.equal(executed, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("withLock does not reclaim stale locks owned by a live process", () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-lock-live-"));
  const testFile = join(dir, "data.json");
  const lockDir = join(dir, ".data.json.lock");
  try {
    mkdirSync(lockDir);
    writeFileSync(join(lockDir, "owner.json"), JSON.stringify({ pid: process.pid }));
    const stale = new Date(Date.now() - 60_000);
    utimesSync(lockDir, stale, stale);
    assert.throws(() => withLock(testFile, () => {}, 100), /Timed out waiting for lock/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("storeEvidence creates full SHA-256 reference and readEvidence retrieves content", () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-ev-"));
  try {
    const content = "Large diff content to be stored out-of-band";
    const ref = storeEvidence(dir, content);
    assert.match(ref, /^ref:sha256:[0-9a-f]{64}$/);
    const retrieved = readEvidence(dir, ref);
    assert.equal(retrieved, content);

    // Prefix reference backward compatibility
    const prefixRef = ref.slice(0, 27); // ref:sha256: + 16 hex chars
    const retrievedFromPrefix = readEvidence(dir, prefixRef);
    assert.equal(retrievedFromPrefix, content);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readEvidence rejects content changed after hashing", () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-ev-tamper-"));
  try {
    const ref = storeEvidence(dir, "original evidence");
    writeFileSync(join(dir, "evidence", `${ref.slice("ref:sha256:".length)}.txt`), "tampered evidence");
    assert.throws(() => readEvidence(dir, ref), /hash mismatch/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("report preserves uppercase state, adds derived lifecycle, and persists atomically", () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-rep-"));
  try {
    const candidate = candidateAtHead();
    const review = candidateReview("I#101", candidate);
    const reviewRef = storeEvidence(dir, JSON.stringify(review));
    const entry1 = report({
      dir,
      run: "run-test",
      task: "I#101",
      candidate,
      state: "READY",
      lifecycle: "closed",
      summary: "Completed work",
      checks: ["unit=PASS"],
      required_checks: ["unit"],
      evidence_binding: {
        task: "I#101",
        run: "run-test",
        candidate,
        review: { ...review, ref: reviewRef },
        memory: memoryEvidence(dir, "I#101", candidate, "obs-101")
      },
      providerVerifier: () => ({ status: "verified" }),
      silent: true,
      nonBlocking: true
    });
    assert.equal(entry1.state, "READY");
    assert.equal(entry1.lifecycle, "ready");
    assert.equal(entry1.checks[0].name, "unit");
    assert.equal(entry1.checks[0].status, "PASS");

    const saved = JSON.parse(readFileSync(join(dir, "I-101.json"), "utf8"));
    assert.equal(saved.state, "READY");
    assert.equal(saved.lifecycle, "ready");
    assert.equal(saved.task, "I#101");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CLOSED inherits a prior candidate when the master supplies fresh proof", () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-closed-inherit-candidate-"));
  try {
    const candidate = candidateAtHead();
    const firstReview = candidateReview("I#118", candidate);
    const firstReviewRef = storeEvidence(dir, JSON.stringify(firstReview));
    const first = report({
      dir,
      run: "run-test",
      task: "I#118",
      candidate,
      state: "READY",
      summary: "Ready for master decision",
      checks: ["unit=PASS"],
      required_checks: ["unit"],
      evidence_binding: {
        task: "I#118",
        run: "run-test",
        candidate,
        review: { ...firstReview, ref: firstReviewRef },
        memory: memoryEvidence(dir, "I#118", candidate, "obs-118-ready")
      },
      providerVerifier: () => ({ status: "verified" }),
      silent: true,
      nonBlocking: true
    });
    assert.equal(first.state, "READY");

    const closeReview = candidateReview("I#118", candidate);
    const closeReviewRef = storeEvidence(dir, JSON.stringify(closeReview));
    const closed = report({
      dir,
      run: "run-test",
      task: "I#118",
      state: "CLOSED",
      summary: "Master accepted the ready candidate",
      checks: ["unit=PASS"],
      required_checks: ["unit"],
      evidence_binding: {
        task: "I#118",
        run: "run-test",
        candidate,
        review: { ...closeReview, ref: closeReviewRef },
        memory: memoryEvidence(dir, "I#118", candidate, "obs-118-closed")
      },
      providerVerifier: () => ({ status: "verified" }),
      silent: true,
      nonBlocking: true
    });
    assert.equal(closed.state, "CLOSED");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("closed reports with failing checks stay blocked", () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-closed-checks-"));
  try {
    const reviewRef = storeEvidence(dir, JSON.stringify({ task: "I#109", run: "run-test", candidate: "commit-109", version: "2.10.1", config_digest: "b".repeat(64), file_hashes: { "mailbox.mjs": "a".repeat(64) } }));
    const result = report({
      dir,
      run: "run-test",
      task: "I#109",
      candidate: "commit-109",
      state: "CLOSED",
      summary: "Failed check",
      checks: ["unit=FAIL"],
      evidence_binding: {
        task: "I#109",
        run: "run-test",
        candidate: "commit-109",
        review: { task: "I#109", run: "run-test", candidate: "commit-109", provider: "gga", status: "PASS", ref: reviewRef, version: "2.10.1", config_digest: "b".repeat(64), output_digest: "c".repeat(64), file_hashes: { "mailbox.mjs": "a".repeat(64) } },
        memory: memoryEvidence(dir, "I#109", "commit-109", "obs-109")
      },
      silent: true,
      nonBlocking: true
    });
    assert.equal(result.state, "BLOCKED");
    assert.equal(result.checks[0].status, "FAIL");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("no-code CLOSED reports accept passing checks and cannot reopen", () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-closed-no-code-"));
  try {
    const result = report({
      dir,
      run: "run-test",
      task: "I#112",
      state: "CLOSED",
      summary: "Duplicate task; no code changes required",
      checks: ["unit=PASS"],
      required_checks: ["unit"],
      silent: true,
      nonBlocking: true
    });
    assert.equal(result.state, "CLOSED");
    assert.equal(result.lifecycle, "closed");
    assert.throws(
      () => report({ dir, run: "run-test", task: "I#112", state: "CLOSED", summary: "replace", checks: ["unit=PASS"], required_checks: ["unit"], silent: true, nonBlocking: true }),
      /cannot update CLOSED task/
    );
    assert.throws(
      () => report({ dir, run: "run-test", task: "I#112", state: "WORKING", summary: "reopen", silent: true, nonBlocking: true }),
      /cannot reopen CLOSED task/
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("notification failure does not block report persistence or turn report into failure", () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-notify-"));
  try {
    // Specify a notify target that fails or triggers non-blocking fallback
    const entryNotify = report({
      dir,
      run: "run-test",
      task: "I#102",
      state: "WORKING",
      summary: "In progress",
      notify: "nonexistent-agent-to-trigger-failed-notify",
      silent: true,
      nonBlocking: true
    });
    assert.equal(entryNotify.state, "WORKING");
    assert.equal(entryNotify.lifecycle, "running");

    const saved = JSON.parse(readFileSync(join(dir, "I-102.json"), "utf8"));
    assert.equal(saved.state, "WORKING");
    assert.equal(saved.summary, "In progress");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ask and reply update state and lifecycle consistently", () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-ask-reply-"));
  try {
    const askEntry = ask({
      dir,
      run: "run-test",
      task: "I#103",
      question: "Which schema version?",
      silent: true,
      nonBlocking: true
    });
    assert.equal(askEntry.state, "BLOCKED");
    assert.equal(askEntry.lifecycle, "blocked");
    assert.equal(askEntry.pending_ask.question, "Which schema version?");

    const replyEntry = reply({
      dir,
      run: "run-test",
      task: "I#103",
      question_id: askEntry.pending_ask.message_id,
      answer: "Use v1 schema",
      silent: true,
      nonBlocking: true
    });
    assert.equal(replyEntry.state, "WORKING");
    assert.equal(replyEntry.lifecycle, "running");
    assert.equal(replyEntry.pending_ask, null);
    assert.equal(replyEntry.last_reply.answer, "Use v1 schema");
    const pending = ask({ dir, run: "run-test", task: "I#103", question: "Which schema version?", silent: true, nonBlocking: true });
    const premature = report({ dir, run: "run-test", task: "I#103", state: "READY", summary: "Finished", silent: true, nonBlocking: true });
    assert.equal(premature.state, "BLOCKED");
    assert.deepEqual(premature.pending_ask, pending.pending_ask);
    const sameAnswerReply = reply({ dir, run: "run-test", task: "I#103", question_id: pending.pending_ask.message_id, answer: "Use v1 schema", silent: true, nonBlocking: true });
    assert.equal(sameAnswerReply.last_reply.answer, "Use v1 schema");
    assert.throws(
      () => reply({ dir, run: "run-test", task: "I#103", question_id: pending.pending_ask.message_id, answer: "Duplicate", silent: true, nonBlocking: true }),
      /no pending question/
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ask rejects a reused id after its question was answered", () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-ask-stale-"));
  try {
    const asked = ask({ dir, run: "run-test", task: "I#114", id: "ask-114", question: "Use which schema?", silent: true, nonBlocking: true });
    reply({ dir, run: "run-test", task: "I#114", question_id: asked.pending_ask.message_id, answer: "v1", silent: true, nonBlocking: true });
    assert.throws(
      () => ask({ dir, run: "run-test", task: "I#114", id: "ask-114", question: "Use which schema now?", silent: true, nonBlocking: true }),
      /stale ask message/
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a report with a new candidate does not inherit PASS checks from a prior candidate", () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-report-candidate-checks-"));
  try {
    report({
      dir,
      run: "run-test",
      task: "I#121",
      candidate: "commit-alpha",
      state: "WORKING",
      summary: "First candidate passed",
      checks: ["unit=PASS"],
      silent: true,
      nonBlocking: true
    });
    const updated = report({
      dir,
      run: "run-test",
      task: "I#121",
      candidate: "commit-beta",
      state: "WORKING",
      summary: "Second candidate with no checks yet",
      silent: true,
      nonBlocking: true
    });
    assert.deepEqual(updated.checks, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("reports retain prior check outcomes and append full check evidence", () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-report-check-history-"));
  try {
    report({ dir, run: "run-test", task: "I#120", state: "WORKING", summary: "checks", checks: ["lint=FAIL"], silent: true, nonBlocking: true });
    const updated = report({ dir, run: "run-test", task: "I#120", state: "WORKING", summary: "checks", checks: ["unit=PASS"], silent: true, nonBlocking: true });
    assert.deepEqual(updated.checks, [
      { name: "lint", status: "FAIL" },
      { name: "unit", status: "PASS" }
    ]);
    const events = readFileSync(join(dir, "events.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line));
    assert.deepEqual(events[1].checks, updated.checks);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("repeated WORKING reports advance the heartbeat sequence and event stream", () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-report-heartbeat-"));
  try {
    const first = report({ dir, run: "run-test", task: "I#119", state: "WORKING", summary: "same", silent: true, nonBlocking: true });
    const second = report({ dir, run: "run-test", task: "I#119", state: "WORKING", summary: "same", silent: true, nonBlocking: true });
    const events = readFileSync(join(dir, "events.jsonl"), "utf8").trim().split("\n");
    assert.equal(second.seq, first.seq + 1);
    assert.notEqual(second.message_id, first.message_id);
    assert.equal(events.length, 2);
    assert.equal(JSON.parse(events[1]).heartbeat, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("reports with the same no-id payload can return after an intervening state", () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-report-return-"));
  try {
    const first = report({ dir, run: "run-test", task: "I#111", state: "WORKING", summary: "same", silent: true, nonBlocking: true });
    report({ dir, run: "run-test", task: "I#111", state: "BLOCKED", summary: "waiting", silent: true, nonBlocking: true });
    const returned = report({ dir, run: "run-test", task: "I#111", state: "WORKING", summary: "same", silent: true, nonBlocking: true });
    assert.equal(returned.state, "WORKING");
    assert.equal(returned.summary, "same");
    assert.notEqual(returned.message_id, first.message_id);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("mailbox retries do not replay or reopen older messages", () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-replay-"));
  try {
    report({ dir, run: "run-test", task: "I#104", id: "report-old", state: "WORKING", summary: "old", silent: true, nonBlocking: true });
    report({ dir, run: "run-test", task: "I#104", id: "report-new", state: "WORKING", summary: "new", silent: true, nonBlocking: true });
    let current;
    for (let i = 0; i < 40; i++) {
      current = report({ dir, run: "run-test", task: "I#104", id: `report-${i}`, state: "WORKING", summary: `current-${i}`, silent: true, nonBlocking: true });
    }
    const replayedReport = report({ dir, run: "run-test", task: "I#104", id: "report-old", state: "FAILED", summary: "replayed", silent: true, nonBlocking: true });
    assert.equal(replayedReport.seq, current.seq);
    assert.equal(replayedReport.summary, current.summary);

    const pending = ask({ dir, run: "run-test", task: "I#104", question: "Which schema version?", silent: true, nonBlocking: true });
    const retriedAsk = ask({ dir, run: "run-test", task: "I#104", question: "Which schema version?", silent: true, nonBlocking: true });
    assert.equal(retriedAsk.seq, pending.seq);
    assert.equal(retriedAsk.pending_ask.question, pending.pending_ask.question);

    const answered = reply({ dir, run: "run-test", task: "I#104", question_id: pending.pending_ask.message_id, answer: "Use v1 schema", silent: true, nonBlocking: true });
    const retriedReply = reply({ dir, run: "run-test", task: "I#104", question_id: pending.pending_ask.message_id, answer: "Use v1 schema", silent: true, nonBlocking: true });
    assert.equal(retriedReply.seq, answered.seq);
    assert.equal(retriedReply.last_reply.answer, answered.last_reply.answer);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("reply rejects an out-of-order answer for a replaced question", () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-ask-order-"));
  try {
    const first = ask({ dir, run: "run-test", task: "I#105", question: "First?", silent: true, nonBlocking: true });
    const second = ask({ dir, run: "run-test", task: "I#105", question: "Second?", silent: true, nonBlocking: true });
    assert.notEqual(first.pending_ask.message_id, second.pending_ask.message_id);
    assert.throws(
      () => reply({ dir, run: "run-test", task: "I#105", question_id: first.pending_ask.message_id, answer: "First answer", silent: true, nonBlocking: true }),
      /stale question reply/
    );
    const answered = reply({ dir, run: "run-test", task: "I#105", question_id: second.pending_ask.message_id, answer: "Second answer", silent: true, nonBlocking: true });
    assert.equal(answered.state, "WORKING");
    assert.equal(answered.last_reply.question_id, second.pending_ask.message_id);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

async function runExtensionStatus({ identity, agent, missingHerdr = false }) {
  const root = mkdtempSync(join(tmpdir(), "orch-status-"));
  const dir = join(root, "status-run");
  const bin = join(root, "bin");
  const fixture = join(root, "herdr.json");
  const originalDir = process.env.ORCH_DIR;
  const originalPath = process.env.PATH;
  const originalFixture = process.env.HERDR_FIXTURE;

  try {
    process.env.ORCH_DIR = root;
    mkdirSync(bin);

  const reportOptions = {
    dir,
    run: "status-run",
    task: "I#301",
    state: "WORKING",
    summary: "Working",
    agent: "worker",
    silent: true,
    nonBlocking: true,
  };
  if (identity) {
    reportOptions.pane = identity.pane;
    reportOptions.session = identity.session;
  }
  report(reportOptions);

  if (!missingHerdr) {
    writeFileSync(fixture, JSON.stringify({ result: { agents: [{ name: "worker", ...agent }] } }));
    const herdr = join(bin, "herdr");
    writeFileSync(herdr, `#!/usr/bin/env node
const { readFileSync } = require("node:fs");
process.stdout.write(readFileSync(process.env.HERDR_FIXTURE));
`);
    chmodSync(herdr, 0o755);
    process.env.HERDR_FIXTURE = fixture;
  } else {
    delete process.env.HERDR_FIXTURE;
  }
  process.env.PATH = `${bin}${process.platform === "win32" ? ";" : ":"}${dirname(process.execPath)}`;

    const { default: registerExtension } = await import("../../../extensions/index.mjs");
    const tools = new Map();
    registerExtension({ registerTool: (tool) => tools.set(tool.name, tool), registerCommand: () => {} });
    const result = await tools.get("orch_status").execute("status", { run: "status-run", json: true });
    return JSON.parse(result.content[0].text)[0];
  } finally {
    if (originalDir === undefined) delete process.env.ORCH_DIR;
    else process.env.ORCH_DIR = originalDir;
    if (originalPath === undefined) delete process.env.PATH;
    else process.env.PATH = originalPath;
    if (originalFixture === undefined) delete process.env.HERDR_FIXTURE;
    else process.env.HERDR_FIXTURE = originalFixture;
    rmSync(root, { recursive: true, force: true });
  }
}

test("extension orch_status preserves liveness state and reason in JSON", async () => {
  const matching = await runExtensionStatus({
    identity: recorded,
    agent: { agent_status: "working", pane_id: "w7D:p1", agent_session: { value: sessionPath } },
  });
  assert.equal(matching.flag, "OK");
  assert.equal(matching.liveness, "live");
  assert.match(matching.reason, /identity matches/);

  const reusedPane = await runExtensionStatus({
    identity: recorded,
    agent: { agent_status: "working", pane_id: "w7D:p9", agent_session: { value: sessionPath } },
  });
  assert.equal(reusedPane.flag, "DECIDE");
  assert.equal(reusedPane.liveness, "decide");
  assert.match(reusedPane.reason, /identity mismatch/);

  const reusedSession = await runExtensionStatus({
    identity: recorded,
    agent: { agent_status: "working", pane_id: "w7D:p1", agent_session: { value: "/tmp/2026-10-31T15-47-02-621Z_01a19999-975c-7524-b395-6fc6e737f235.jsonl" } },
  });
  assert.equal(reusedSession.flag, "DECIDE");
  assert.equal(reusedSession.liveness, "decide");
  assert.match(reusedSession.reason, /identity mismatch/);

  const legacy = await runExtensionStatus({
    agent: { agent_status: "working", pane_id: "w7D:p1", agent_session: { value: sessionPath } },
  });
  assert.equal(legacy.flag, "DECIDE");
  assert.equal(legacy.liveness, "unverified");
  assert.match(legacy.reason, /legacy record/);

  const missingHerdr = await runExtensionStatus({ missingHerdr: true });
  assert.equal(missingHerdr.flag, "NO_HERDR");
  assert.equal(missingHerdr.liveness, "unverified");
  assert.equal(missingHerdr.reason, "Herdr liveness unavailable; mailbox and Git evidence decide");
});

test("extension tools integrate with mailbox and support evidence reading", async () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-ext-"));
  const origEnv = process.env.ORCH_DIR;
  process.env.ORCH_DIR = dir;
  try {
    const { default: registerExtension } = await import("../../../extensions/index.mjs");
    const tools = new Map();
    registerExtension({
      registerTool: (t) => tools.set(t.name, t),
      registerCommand: () => {}
    });

    assert.ok(tools.has("orch_report"));
    assert.ok(tools.has("orch_evidence"));
    assert.ok(tools.has("orch_ask"));
    assert.ok(tools.has("orch_reply"));
    assert.ok(tools.get("orch_report").parameters.properties.evidence_binding);
    assert.ok(tools.get("orch_report").parameters.properties.pane);
    assert.ok(tools.get("orch_report").parameters.properties.session);
    assert.ok(tools.get("orch_reply").parameters.properties.id);
    assert.ok(tools.get("orch_reply").parameters.properties.question_id);
    assert.deepEqual(tools.get("orch_reply").parameters.required, ["task", "question_id", "answer"]);

    const askRes = await tools.get("orch_ask").execute("call-ask", {
      run: "ext-run",
      task: "I#202",
      question: "Which contract?"
    });
    const questionId = askRes.content[0].text.match(/question_id=([^.;]+)/)?.[1];
    assert.ok(questionId);
    const statusRes = await tools.get("orch_status").execute("call-status", { run: "ext-run", json: true });
    const statusRows = JSON.parse(statusRes.content[0].text);
    assert.equal(statusRows.find((row) => row.task === "I#202").question_id, questionId);
    const replyRes = await tools.get("orch_reply").execute("call-reply", {
      run: "ext-run",
      task: "I#202",
      question_id: questionId,
      answer: "Use the current contract"
    });
    assert.match(replyRes.content[0].text, /Reply delivered/);

    // Test orch_report
    const reportRes = await tools.get("orch_report").execute("call-1", {
      run: "ext-run",
      task: "I#201",
      state: "ASSIGNED",
      summary: "Assigned worker"
    });
    assert.ok(reportRes.content[0].text.includes("I#201 ASSIGNED"));

    // Test orch_evidence store and read
    const evRes = await tools.get("orch_evidence").execute("call-2", {
      run: "ext-run",
      content: "Detailed error logs and stack trace"
    });
    const match = evRes.content[0].text.match(/ref:sha256:[0-9a-f]{64}/);
    assert.ok(match, "should return full sha256 ref");
    const evRef = match[0];

    // Read back via orch_evidence
    const readRes = await tools.get("orch_evidence").execute("call-3", {
      run: "ext-run",
      ref: evRef
    });
    assert.equal(readRes.content[0].text, "Detailed error logs and stack trace");

    const longRes = await tools.get("orch_evidence").execute("call-4", {
      run: "ext-run",
      content: "0123456789ABCDEFGHIJ"
    });
    const longRef = longRes.content[0].text.match(/ref:sha256:[0-9a-f]{64}/)[0];
    const previewRes = await tools.get("orch_evidence").execute("call-5", {
      run: "ext-run",
      ref: longRef,
      offset: 5,
      limit: 5
    });
    assert.equal(previewRes.content[0].text, "56789\n[truncated; read offset 10 to continue]");
  } finally {
    if (origEnv !== undefined) process.env.ORCH_DIR = origEnv;
    else delete process.env.ORCH_DIR;
    rmSync(dir, { recursive: true, force: true });
  }
});
