import assert from "node:assert/strict";
import test from "node:test";
import {
  BOARD_COLUMNS,
  ENVELOPE_VERSION,
  EVENT_FIELDS,
  appendEvent,
  applyCorrection,
  buildEnvelope,
  fromMailboxAndHerdr,
  migrateEnvelope,
  resolveColumn,
  toTelegramReportInput,
  transitionEnvelope,
} from "./task-map-envelope.mjs";

const now = new Date("2026-11-28T10:00:00.000Z");

const base = {
  subject: "Evidence update",
  source: "/factory run",
  ticket: "I#42",
  org: "personale",
  team: "lead",
  project: "pi-herdr",
  repo: "pi-herdr-orchestration",
  session_name: "lead",
  pi_session_id: "01a20749-4385-74a6-b8ab-1411a7f8afc9",
  workspace_id: "wK0",
  tab_id: "wK0:t4",
  pane_id: "wK0:p4",
  worktree: ".worktrees/issue-42",
  branch: "fix/42",
  state: "WORKING",
  evidence: ["npm test PASS"],
  blockers: [],
  waiting: ["CI runner"],
  next: ["review PR"],
};

test("buildEnvelope creates a versioned canonical envelope", () => {
  const envelope = buildEnvelope(base, now);
  assert.equal(envelope.v, ENVELOPE_VERSION);
  assert.equal(envelope.created_at, now.toISOString());
  assert.equal(envelope.ticket, "I#42");
  assert.equal(envelope.session_name, "lead");
  assert.equal(envelope.pane_id, "wK0:p4");
  assert.deepEqual(envelope.evidence, ["npm test PASS"]);
});

test("buildEnvelope rejects missing identity fields", () => {
  assert.throws(() => buildEnvelope({ source: "mailbox" }, now), /Missing subject, source or ticket/);
});

test("fromMailboxAndHerdr maps mailbox state and Herdr identity", () => {
  const rows = [{
    task: "I#42",
    agent: "lead",
    state: "BLOCKED",
    summary: "waiting CI",
    evidence: "ref:sha256:abc",
    question_id: null,
    flag: "STALE",
    reason: "stale mailbox record",
    budget_block: "budget exceeded",
  }];
  const herdr = {
    result: {
      agents: [{
        name: "lead",
        pane_id: "wS1:p7",
        tab_id: "wS1:t3",
        workspace_id: "wS1",
        agent_session: {
          agent: "pi",
          kind: "path",
          value: "/root/.pi/agent/sessions/x/2026-11-28T09Z_01a20749-4385-74a6-b8ab-1411a7f8afc9.jsonl",
        },
      }],
    },
  };
  const envelopes = fromMailboxAndHerdr(
    rows,
    herdr,
    { repo: "pi-herdr-orchestration", subject: "Session evidence", source: "mailbox" },
    now,
  );
  assert.equal(envelopes.length, 1);
  assert.equal(envelopes[0].ticket, "I#42");
  assert.equal(envelopes[0].state, "BLOCKED");
  assert.equal(envelopes[0].pi_session_id, "01a20749-4385-74a6-b8ab-1411a7f8afc9");
  assert.equal(envelopes[0].workspace_id, "wS1");
  assert.equal(envelopes[0].tab_id, "wS1:t3");
  assert.equal(envelopes[0].pane_id, "wS1:p7");
  assert.deepEqual(envelopes[0].evidence, ["ref:sha256:abc"]);
  assert.ok(envelopes[0].waiting.includes("stale mailbox record"));
  assert.ok(envelopes[0].waiting.includes("budget exceeded"));
});

test("fromMailboxAndHerdr fails closed when Herdr identity is absent", () => {
  const rows = [{ task: "PR#51", agent: "reviewer", state: "READY", summary: "review", evidence: "-" }];
  const envelopes = fromMailboxAndHerdr(rows, { result: { agents: [] } }, { repo: "repo", source: "mailbox" }, now);
  assert.equal(envelopes[0].session_name, "reviewer");
  assert.equal(envelopes[0].pi_session_id, null);
  assert.ok(envelopes[0].waiting.includes("Herdr identity unavailable"));
});

test("toTelegramReportInput preserves identity and follow-up fields", () => {
  const input = toTelegramReportInput(buildEnvelope(base, now));
  assert.equal(input.title, "Evidence update");
  assert.equal(input.sessions[0].name, "lead");
  assert.equal(input.sessions[0].pane, "wK0:p4");
  assert.deepEqual(input.evidence, ["npm test PASS"]);
  assert.deepEqual(input.waiting, ["CI runner"]);
  assert.deepEqual(input.next, ["review PR"]);
});

test("envelope carries the twenty-field event schema and an empty history", () => {
  const envelope = buildEnvelope(base, now);
  assert.equal(envelope.revision, 0);
  assert.deepEqual(envelope.events, []);

  const withEvent = appendEvent(envelope, {
    id: "e1",
    timestamp: now.toISOString(),
    source: "github",
    from: "WORKING",
    to: "In Progress",
    reason: "state WORKING",
    actor: "lead",
    commit: "abc123",
    evidence_ref: "ref:sha256:abc",
    event_type: "transition",
    correlation_id: "c1",
    payload: { action: "started" },
  }, now);
  const event = withEvent.events[0];
  assert.deepEqual(Object.keys(event), EVENT_FIELDS);
  assert.equal(event.revision, 0);
  assert.equal(event.ticket, "I#42");
  assert.equal(event.repo, "pi-herdr-orchestration");
  assert.equal(event.pi_session_id, "01a20749-4385-74a6-b8ab-1411a7f8afc9");
  assert.equal(event.payload_hash.length, 64);
});

test("migrateEnvelope adds an empty history and one migrated event", () => {
  const legacy = buildEnvelope(base, now);
  delete legacy.events;
  delete legacy.revision;

  const migrated = migrateEnvelope(legacy, now);
  assert.equal(migrated.revision, 0);
  assert.equal(migrated.events.length, 1);
  assert.equal(migrated.events[0].event_type, "migrated");
  assert.equal(migrated.events[0].to, resolveColumn(legacy).column);
  assert.deepEqual(Object.keys(migrated.events[0]), EVENT_FIELDS);
});

test("applyCorrection increments revision and adds a correlated event", () => {
  const withEvent = appendEvent(buildEnvelope(base, now), {
    id: "e1",
    timestamp: now.toISOString(),
  }, now);
  const corrected = applyCorrection(withEvent, {
    id: "e2",
    timestamp: now.toISOString(),
    reason: "wrong summary",
  }, now);

  assert.equal(corrected.revision, 1);
  assert.equal(corrected.events.length, 2);
  assert.equal(corrected.events[1].event_type, "correction");
  assert.equal(corrected.events[1].revision, 1);
  assert.equal(corrected.events[1].correlation_id, "e1");
});

test("resolveColumn maps issue 95 states, evidence and blockers", () => {
  const envelope = (patch) => ({
    ...base,
    blockers: [],
    waiting: [],
    evidence: [],
    ...patch,
  });

  assert.equal(resolveColumn(envelope({ state: "ASSIGNED" })).column, "Intake");
  assert.equal(resolveColumn(envelope({
    state: "ASSIGNED",
    evidence: ["odd/tasks/task-board-integration-20261128.md"],
  })).column, "Spec");
  assert.equal(resolveColumn(envelope({ state: "READY" })).column, "Ready");
  assert.equal(resolveColumn(envelope({ state: "WORKING" })).column, "In Progress");
  assert.equal(resolveColumn(envelope({ state: "DEVELOPMENT" })).column, "In Progress");
  assert.equal(resolveColumn(envelope({ state: "PR_OPEN" })).column, "Review");
  assert.equal(resolveColumn(envelope({ state: "BLOCKED" })).column, "Blocked/Waiting");
  assert.equal(resolveColumn(envelope({
    state: "OPEN",
    evidence: ["checks PASS", "approved by reviewer"],
  })).column, "Ready to Merge");
  assert.equal(resolveColumn(envelope({
    state: "OPEN",
    evidence: ["verified merge"],
  })).column, "Closed");
  assert.ok(BOARD_COLUMNS.includes("Blocked/Waiting"));

  const unknown = resolveColumn(envelope({ state: "MYSTERY" }));
  assert.equal(unknown.column, "Blocked/Waiting");
  assert.match(unknown.reason, /MYSTERY/);

  const overridden = resolveColumn(envelope({
    state: "MERGED",
    blockers: ["question 9"],
  }));
  assert.equal(overridden.column, "Blocked/Waiting");
  assert.match(overridden.reason, /blockers\/waiting/);
});

test("transitionEnvelope moves forward, rejects silent reopens and records every transition", () => {
  const start = buildEnvelope({ ...base, state: "ASSIGNED", blockers: [], waiting: [] }, now);
  const working = transitionEnvelope(start, { state: "WORKING" }, { reason: "started" }, now);

  assert.equal(resolveColumn(working).column, "In Progress");
  assert.equal(working.events.length, 1);
  assert.equal(working.events[0].event_type, "transition");
  assert.equal(working.events[0].from, "Intake");
  assert.equal(working.events[0].to, "In Progress");
  assert.equal(working.events[0].reason, "started");

  assert.throws(
    () => transitionEnvelope(working, { state: "ASSIGNED" }, {}, now),
    /reopen requires reason/i,
  );

  const reopened = transitionEnvelope(
    working,
    { state: "ASSIGNED" },
    { reason: "incorrect ticket" },
    now,
  );
  assert.equal(reopened.events.length, 2);
  assert.equal(reopened.events[1].from, "In Progress");
  assert.equal(reopened.events[1].to, "Intake");
  assert.equal(reopened.events[1].reason, "incorrect ticket");
});

test("appendEvent keeps logical history unbounded", () => {
  let envelope = buildEnvelope(base, now);
  for (let index = 0; index < 25; index += 1) {
    envelope = appendEvent(envelope, { id: `e${index}`, timestamp: now.toISOString() }, now);
  }
  assert.equal(envelope.events.length, 25);
  assert.equal(envelope.events[24].id, "e24");
});
