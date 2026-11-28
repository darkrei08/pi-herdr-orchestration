import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { BOARD_COLUMNS, EVENT_FIELDS, buildEnvelope } from "./task-map-envelope.mjs";
import { dedupeKey } from "./task-board.mjs";
import { projectTaskView } from "./taskview-adapter.mjs";

const SCRIPT = fileURLToPath(new URL("./taskview-adapter.mjs", import.meta.url));
const FIXTURE_DATE = new Date("2024-01-01T00:00:00.000Z");

function envelope(overrides = {}) {
  return buildEnvelope({
    org: "acme",
    repo: "repo",
    ticket: "T-1",
    subject: "Fixture ticket",
    source: "fixture",
    state: "WORKING",
    summary: "fixture summary",
    ...overrides,
  }, FIXTURE_DATE);
}

test("projectTaskView defaults to fixture mode and declares no network or live write", () => {
  const result = projectTaskView([envelope()]);
  assert.equal(result.mode, "fixture");
  assert.equal(result.source, "taskview-adapter");
  assert.equal(result.network, 0);
  assert.equal(result.live_write, false);
  assert.throws(() => projectTaskView([envelope()], { mode: "live" }), /unsupported mode/);

  const text = JSON.stringify(result).toLowerCase();
  for (const forbidden of ["http://", "https://", "url", "token", "secret"]) {
    assert.ok(!text.includes(forbidden), `output must not contain ${forbidden}`);
  }
});

test("projection is deterministic and emits writeback plus signed webhook fixtures", () => {
  const input = [envelope({ ticket: "T-2", state: "READY" }), envelope({ ticket: "T-1" })];
  const first = projectTaskView(input);
  const second = projectTaskView(input);

  assert.deepEqual(first, second);
  assert.deepEqual(first.envelopes.map((item) => item.ticket), ["T-1", "T-2"]);
  assert.equal(first.counts.input, 2);
  assert.equal(first.counts.envelopes, 2);
  assert.equal(first.counts.writeback, 2);
  assert.equal(first.counts.webhooks, 2);
  assert.equal(first.writeback.length, 2);
  assert.equal(first.webhooks.length, 2);

  for (const request of first.writeback) {
    assert.equal(request.mode, "fixture");
    assert.equal(request.network, 0);
    assert.equal(request.live_write, false);
    assert.ok(BOARD_COLUMNS.includes(request.column));
    assert.ok(request.dedupe_key);
    assert.equal(request.blocked, false);
  }
  for (const hook of first.webhooks) {
    assert.match(hook.signature, /^[a-f0-9]{64}$/);
    assert.equal(hook.algorithm, "hmac-sha256-fixture");
    assert.match(hook.delivery_id, /^[a-f0-9]{16}$/);
    assert.equal(hook.payload.v, "task-map-envelope/v1");
  }
});

test("duplicate count uses the shared extended dedupe key", () => {
  const first = envelope({ ticket: "T-3", pi_session_id: "session-1" });
  const duplicate = { ...first, state: "MERGED", summary: "different summary" };
  const other = envelope({ ticket: "T-4" });
  const result = projectTaskView([first, duplicate, other]);

  assert.equal(result.counts.input, 3);
  assert.equal(result.counts.duplicates, 1);
  assert.equal(result.counts.envelopes, 2);
  assert.deepEqual(
    result.envelopes.map((item) => item.dedupe_key).sort(),
    [dedupeKey(first), dedupeKey(other)].sort(),
  );
  assert.equal(result.writeback.length, 2);
  assert.equal(result.webhooks.length, 2);
});

test("events use all twenty fields and timestamps do not decide domain authority", () => {
  const base = envelope({ ticket: "T-5", state: "PR_OPEN", evidence: ["PR#7 opened"] });
  const shifted = { ...base, created_at: "2099-01-01T00:00:00.000Z" };
  const withEvent = {
    ...base,
    events: [{ event_type: "transition", timestamp: "2020-01-01T00:00:00.000Z" }],
  };
  const shiftedEvent = {
    ...withEvent,
    events: [{ ...withEvent.events[0], timestamp: "2030-01-01T00:00:00.000Z" }],
  };

  const original = projectTaskView([base]);
  const moved = projectTaskView([shifted]);
  const withInputEvent = projectTaskView([withEvent]);
  const movedInputEvent = projectTaskView([shiftedEvent]);

  const domain = (result) => result.writeback.map(({ dedupe_key, column, state, blocked }) => (
    { dedupe_key, column, state, blocked }
  ));
  assert.deepEqual(domain(original), domain(moved));
  assert.deepEqual(domain(withInputEvent), domain(movedInputEvent));

  assert.equal(EVENT_FIELDS.length, 20);
  const events = [
    ...original.envelopes.flatMap((item) => item.events),
    ...original.webhooks.flatMap((hook) => hook.payload.events),
  ];
  assert.ok(events.length > 0);
  for (const event of events) {
    assert.deepEqual(Object.keys(event), EVENT_FIELDS);
    assert.equal(event.source, "taskview-adapter");
  }
});

test("CLI prints help, writes output and prints path and counts", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "taskview-adapter-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const inputPath = join(dir, "input.json");
  const outputPath = join(dir, "nested", "output.json");
  writeFileSync(inputPath, `${JSON.stringify([envelope({ ticket: "T-6" })])}\n`);

  const help = spawnSync(process.execPath, [SCRIPT, "--help"], { encoding: "utf8" });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /--input/);
  assert.match(help.stdout, /--output/);

  const run = spawnSync(process.execPath, [SCRIPT, "--input", inputPath, "--output", outputPath], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  assert.ok(run.stdout.includes(outputPath), run.stdout);
  for (const expected of ["envelopes=1", "writeback=1", "webhooks=1", "duplicates=0", "network=0", "live_write=false"]) {
    assert.ok(run.stdout.includes(expected), `${expected} missing from ${run.stdout}`);
  }
  const written = JSON.parse(readFileSync(outputPath, "utf8"));
  assert.equal(written.mode, "fixture");
  assert.equal(written.counts.envelopes, 1);
});

test("CLI rejects malformed input and missing arguments without writing output", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "taskview-adapter-invalid-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const badJson = join(dir, "bad.json");
  const badShape = join(dir, "shape.json");
  const badEnvelope = join(dir, "bad-envelope.json");
  writeFileSync(badJson, "{not json");
  writeFileSync(badShape, `${JSON.stringify({ envelopes: [] })}\n`);
  writeFileSync(badEnvelope, `${JSON.stringify([{ ticket: "T-7" }])}\n`);

  for (const [index, path] of [badJson, badShape, badEnvelope].entries()) {
    const output = join(dir, `invalid-${index}.json`);
    const run = spawnSync(process.execPath, [SCRIPT, "--input", path, "--output", output], { encoding: "utf8" });
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /^taskview-adapter:/);
    assert.ok(!existsSync(output));
  }
  const missingOutput = spawnSync(process.execPath, [SCRIPT, "--input", badShape], { encoding: "utf8" });
  assert.notEqual(missingOutput.status, 0);
  const unknown = spawnSync(process.execPath, [SCRIPT, "--bogus"], { encoding: "utf8" });
  assert.notEqual(unknown.status, 0);
});
