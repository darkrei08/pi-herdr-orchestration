import assert from "node:assert/strict";
import { test } from "node:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { classify, classifyLiveness, storeEvidence, readEvidence, deriveLifecycle, fileFor, report, ask, reply, runDir, STATES, LIFECYCLE_STATES } from "./mailbox.mjs";
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
  assert.equal(classify(entry("WORKING"), live("working"), now, 10 * min), "OK");
  assert.equal(classify(entry("WORKING", 11), live("working"), now, 10 * min), "STALE");
  assert.equal(classify(entry("WORKING"), live("idle"), now, 10 * min), "SILENT");
  assert.equal(classify(entry("ASSIGNED"), live("done"), now, 10 * min), "SILENT");
  assert.equal(classify(entry("WORKING"), live("blocked"), now, 10 * min), "NEEDS_HUMAN");
  assert.equal(classify(entry("WORKING"), undefined, now, 10 * min), "GONE");
  assert.equal(classify(entry("READY"), live("idle"), now, 10 * min), "DECIDE");
  assert.equal(classify(entry("BLOCKED"), live("working"), now, 10 * min), "DECIDE");
  assert.equal(classify(entry("CLOSED"), undefined, now, 10 * min), "OK");
  assert.equal(classify(entry("WORKING"), live("unknown"), now, 10 * min), "DECIDE");
  assert.equal(classify(entry("BLOCKED", 0, { pending_ask: { question: "Q?" } }), live("idle"), now, 10 * min), "ASK");
});

const sessionPath = "/root/.pi/agent/sessions/x--/2026-10-31T15-47-02-621Z_01a192a4-975c-7524-b395-6fc6e737f235.jsonl";
const recorded = { pane: "w7D:p1", session: "01a192a4-975c-7524-b395-6fc6e737f235" };
const liveAgent = (agent_status, pane_id, session) => ({ agent_status, pane_id, agent_session: { value: session } });

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
  assert.equal(silentLive.flag, "OK");
  assert.equal(silentLive.state, "unverified");
});

test("legacy record without identity keeps its previous flag", () => {
  const legacy = classifyLiveness(entry("WORKING"), liveAgent("working", "w7D:p1", sessionPath), now, 10 * min);
  assert.equal(legacy.flag, "OK");
  assert.equal(legacy.state, "unverified");
  assert.match(legacy.reason, /no identity/);

  const closed = classifyLiveness(entry("CLOSED"), undefined, now, 10 * min);
  assert.equal(closed.flag, "OK");
  assert.equal(closed.state, "closed");
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

test("report preserves uppercase state, adds derived lifecycle, and persists atomically", () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-rep-"));
  try {
    const entry1 = report({
      dir,
      run: "run-test",
      task: "I#101",
      state: "READY",
      summary: "Completed work",
      checks: ["unit=PASS"],
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
      answer: "Use v1 schema",
      silent: true,
      nonBlocking: true
    });
    assert.equal(replyEntry.state, "WORKING");
    assert.equal(replyEntry.lifecycle, "running");
    assert.equal(replyEntry.pending_ask, null);
    assert.equal(replyEntry.last_reply.answer, "Use v1 schema");
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
    writeFileSync(herdr, `#!/bin/sh
/bin/cat "$HERDR_FIXTURE"
`);
    chmodSync(herdr, 0o755);
    process.env.HERDR_FIXTURE = fixture;
  } else {
    delete process.env.HERDR_FIXTURE;
  }
  process.env.PATH = bin;

  try {
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
  assert.equal(legacy.flag, "OK");
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
  } finally {
    if (origEnv !== undefined) process.env.ORCH_DIR = origEnv;
    else delete process.env.ORCH_DIR;
    rmSync(dir, { recursive: true, force: true });
  }
});
