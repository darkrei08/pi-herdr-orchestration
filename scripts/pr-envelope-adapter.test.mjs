import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { after, test } from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BOARD_COLUMNS } from "./task-map-envelope.mjs";
import { PR_EVENTS, projectPrEvents } from "./pr-envelope-adapter.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const cli = join(here, "pr-envelope-adapter.mjs");
const scratch = mkdtempSync(join(tmpdir(), "pr-envelope-adapter-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

const org = "darkrei08";
const repo = "pi-herdr-orchestration";
const generated_at = "2026-11-28T10:00:00.000Z";

const ports = {
  inspect: { exists: true, pullRequest: true },
  botFindings: { pending: true, findings: [] },
  ci: { pending: true, state: "pending" },
  approval: { pending: true, approved: false },
  mergeability: { pending: true, merged: false, merge_state: "UNKNOWN" },
};

function event(id, name, at, overrides = {}) {
  return { id, event: name, pr: 98, issue: 97, timestamp: at, ports: { ...ports, ...overrides } };
}

const fixture = {
  org,
  repo,
  generated_at,
  events: [
    event("evt-1", "opened", "2026-11-28T10:01:00.000Z"),
    event("evt-2", "ready_for_review", "2026-11-28T10:02:00.000Z"),
    event("evt-3", "review", "2026-11-28T10:03:00.000Z", {
      botFindings: { pending: false, findings: [] },
    }),
    event("evt-4", "checks", "2026-11-28T10:04:00.000Z", {
      ci: { pending: false, state: "success" },
      approval: { pending: false, approved: true },
    }),
    event("evt-5", "changes_requested", "2026-11-28T10:05:00.000Z", {
      botFindings: { pending: false, findings: ["fix review note"] },
      approval: { pending: false, approved: false },
    }),
    event("evt-6", "approved", "2026-11-28T10:06:00.000Z", {
      botFindings: { pending: false, findings: [] },
      ci: { pending: false, state: "success" },
      approval: { pending: false, approved: true },
    }),
    event("evt-7", "merged", "2026-11-28T10:07:00.000Z", {
      botFindings: { pending: false, findings: [] },
      ci: { pending: false, state: "success" },
      approval: { pending: false, approved: true },
      mergeability: { pending: false, merged: true, merge_state: "CLEAN" },
    }),
    event("evt-8", "closed", "2026-11-28T10:08:00.000Z", {
      mergeability: { pending: false, merged: false, merge_state: "DIRTY" },
    }),
    event("evt-1", "opened", "2026-11-28T10:01:00.000Z"),
  ],
};

function runCli(args) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
}

test("PR_EVENTS exposes the eight normalized fixture event names", () => {
  assert.deepEqual([...PR_EVENTS], [
    "opened",
    "ready_for_review",
    "review",
    "checks",
    "changes_requested",
    "approved",
    "merged",
    "closed",
  ]);
});

test("projectPrEvents maps all events through the shared eight columns and dual-writes records", () => {
  const output = projectPrEvents(fixture);
  assert.equal(output.mode, "dry-run");
  assert.deepEqual(output.counts, { events: 9, envelopes: 8, mailbox: 8, duplicates: 1 });
  assert.equal(output.envelopes.length, 8);
  assert.equal(output.mailbox.length, 8);
  assert.deepEqual(output.envelopes.map((item) => item.column), [
    "Review",
    "Review",
    "Review",
    "Ready to Merge",
    "Blocked/Waiting",
    "Ready to Merge",
    "Closed",
    "Closed",
  ]);
  assert.deepEqual(output.envelopes.map((item) => item.state), [
    "PR_OPEN",
    "PR_OPEN",
    "PR_OPEN",
    "READY_TO_MERGE",
    "BLOCKED",
    "READY_TO_MERGE",
    "MERGED",
    "MERGED",
  ]);
  assert.ok(output.envelopes.every((item) => BOARD_COLUMNS.includes(item.column)));
  assert.equal(output.envelopes[0].idempotency_key, "darkrei08/pi-herdr-orchestration/PR#98/opened/evt-1");
  assert.equal(output.envelopes[0].ticket, "PR#98");
  assert.ok(output.envelopes[0].next.includes("I#97"));
  assert.ok(output.envelopes[3].evidence.includes("checks PASS"));
  assert.ok(output.envelopes[3].evidence.includes("approved by reviewer"));
  assert.ok(output.envelopes[4].evidence.includes("bot_review=FAIL"));
  assert.ok(output.envelopes[6].evidence.includes("merge=PASS"));
  assert.ok(output.envelopes[6].evidence.includes("verified merge"));
  assert.deepEqual(output.mailbox.map((item) => item.task), Array(8).fill("PR#98"));
  assert.deepEqual(output.mailbox.map((item) => item.column), output.envelopes.map((item) => item.column));
  assert.equal(output.mailbox[0].related_task, "I#97");
});

test("projectPrEvents rejects malformed and unbounded normalized fixtures", () => {
  assert.throws(() => projectPrEvents({ ...fixture, events: {} }), /events must be an array/);
  assert.throws(() => projectPrEvents({ ...fixture, events: [{ ...fixture.events[0], event: "push" }] }), /unsupported PR event/);
  assert.throws(() => projectPrEvents({ ...fixture, events: [{ ...fixture.events[0], id: "" }] }), /event id is required/);
  assert.throws(() => projectPrEvents({ ...fixture, events: Array.from({ length: 501 }, (_, index) => event(`evt-${index}`, "opened", "2026-11-28T10:01:00.000Z")) }), /too many events/);
});

test("CLI prints help without requiring input or output", () => {
  const result = runCli(["--help"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /usage: pr-envelope-adapter\.mjs --input <path> --output <path>/);
});

test("CLI writes deterministic output and reports path plus counts", () => {
  const input = join(scratch, "events.json");
  const output = join(scratch, "out.json");
  writeFileSync(input, `${JSON.stringify(fixture, null, 2)}\n`);
  const first = runCli(["--input", input, "--output", output]);
  assert.equal(first.status, 0);
  assert.match(first.stdout, new RegExp(`wrote ${output.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} envelopes=8 mailbox=8 duplicates=1 mode=dry-run`));
  const bytes = readFileSync(output, "utf8");
  const second = runCli(["--input", input, "--output", output]);
  assert.equal(second.status, 0);
  assert.equal(readFileSync(output, "utf8"), bytes);
});

test("CLI rejects malformed input and unapproved write mode", () => {
  const bad = join(scratch, "bad.json");
  const output = join(scratch, "bad-out.json");
  writeFileSync(bad, "not json");
  const malformed = runCli(["--input", bad, "--output", output]);
  assert.equal(malformed.status, 1);
  assert.match(malformed.stderr, /invalid JSON/);

  const input = join(scratch, "events.json");
  const noAudit = runCli(["--input", input, "--output", output, "--write"]);
  assert.equal(noAudit.status, 1);
  assert.match(noAudit.stderr, /--write requires --audit/);

  const rejectedAudit = join(scratch, "audit-no.json");
  writeFileSync(rejectedAudit, `${JSON.stringify({ approved: false, scope: "pr-envelope-adapter" })}\n`);
  const denied = runCli(["--input", input, "--output", output, "--write", "--audit", rejectedAudit]);
  assert.equal(denied.status, 1);
  assert.match(denied.stderr, /audit not approved/);

  const approvedAudit = join(scratch, "audit-yes.json");
  writeFileSync(approvedAudit, `${JSON.stringify({ approved: true, scope: "pr-envelope-adapter" })}\n`);
  const allowed = runCli(["--input", input, "--output", output, "--write", "--audit", approvedAudit]);
  assert.equal(allowed.status, 0);
  assert.match(allowed.stdout, /mode=write/);
});
