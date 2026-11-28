import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { BOARD_COLUMNS, ENVELOPE_VERSION } from "./task-map-envelope.mjs";

const cli = fileURLToPath(new URL("./task-board.mjs", import.meta.url));
const now = new Date("2026-11-28T10:00:00.000Z");

function envelope(patch = {}) {
  return {
    v: ENVELOPE_VERSION,
    created_at: now.toISOString(),
    org: "darkrei08",
    repo: "pi-herdr-orchestration",
    ticket: "I#42",
    subject: "Evidence update",
    source: "github",
    session_name: "lead",
    pi_session_id: "pi-1",
    workspace_id: "w1",
    tab_id: "t1",
    pane_id: "p1",
    state: "READY",
    evidence: ["npm test PASS"],
    blockers: [],
    waiting: [],
    next: ["review PR"],
    summary: "short summary",
    revision: 0,
    events: [],
    ...patch,
  };
}

function run(args, input = "") {
  return spawnSync(process.execPath, [cli, ...args], { encoding: "utf8", input });
}

function scratch(t) {
  const dir = mkdtempSync(join(tmpdir(), "task-board-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test("task-board CLI validates input, writes self-contained HTML and prints the output path", (t) => {
  const dir = scratch(t);
  const inputPath = join(dir, "input.json");
  const outputPath = join(dir, "board.html");
  const longEvidence = `npm test PASS ${"x".repeat(240)}`;
  writeFileSync(inputPath, JSON.stringify([
    envelope({
      pi_session_id: null,
      workspace_id: null,
      tab_id: null,
      pane_id: null,
      state: "WORKING",
      evidence: [longEvidence],
    }),
  ]));

  const result = run(
    ["--input", inputPath, "--output", outputPath],
    JSON.stringify({ v: "ignored-stdin" }),
  );
  assert.equal(result.status, 0, result.stderr);
  const stdoutLines = result.stdout.trim().split(/\r?\n/);
  assert.equal(stdoutLines[0], outputPath);
  assert.equal(stdoutLines[1], "Intake=0 Spec=0 Ready=0 In Progress=1 Review=0 Ready to Merge=0 Blocked/Waiting=0 Closed=0");

  const html = readFileSync(outputPath, "utf8");
  for (const column of BOARD_COLUMNS) {
    assert.ok(html.includes(`data-column="${column}"`), `missing column ${column}`);
  }
  assert.equal((html.match(/data-column="/g) ?? []).length, 8);
  assert.ok(html.includes(longEvidence));
  assert.ok(html.includes("session unavailable"));
  assert.ok(html.includes("<style>"));
  assert.ok(html.includes("<script>"));
  assert.ok(html.includes("@media (prefers-reduced-motion: reduce)"));
  assert.ok(!html.includes("<link"));
  assert.ok(!html.includes("src="));
  assert.ok(!html.includes("https://"));
});

test("task-board CLI dedupes the extended identity and sorts deterministically", (t) => {
  const dir = scratch(t);
  const inputPath = join(dir, "input.json");
  const outputPath = join(dir, "board.html");
  const common = {
    org: "darkrei08",
    repo: "pi-herdr-orchestration",
    source: "github",
    pi_session_id: "pi-1",
    workspace_id: "w1",
    tab_id: "t1",
    pane_id: "p1",
    evidence: [],
    blockers: [],
    waiting: [],
  };
  writeFileSync(inputPath, JSON.stringify([
    envelope({ ...common, ticket: "I#2", created_at: "2026-11-28T12:00:00.000Z", summary: "LATE" }),
    envelope({ ...common, ticket: "I#2", pi_session_id: "pi-2", summary: "OTHER SESSION" }),
    envelope({ ...common, org: "aaa", ticket: "I#1", created_at: "2026-11-29T00:00:00.000Z" }),
    envelope({ ...common, ticket: "I#2", summary: "EARLY" }),
  ]));

  const result = run(["--input", inputPath, "--output", outputPath]);
  assert.equal(result.status, 0, result.stderr);
  const html = readFileSync(outputPath, "utf8");
  assert.equal((html.match(/data-dedupe-key="/g) ?? []).length, 3);
  assert.ok(html.indexOf("aaa/I#1") < html.indexOf("darkrei08/I#2"));
  assert.ok(html.includes("EARLY"));
  assert.ok(!html.includes("LATE"));
  assert.ok(html.includes("OTHER SESSION"));
});

test("task-board CLI requires an input path and rejects invalid envelope versions", (t) => {
  const dir = scratch(t);
  const outputPath = join(dir, "board.html");

  const missing = run(["--output", outputPath]);
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /--input/);

  const stdinPath = run(["--input", "-", "--output", outputPath], "{}");
  assert.notEqual(stdinPath.status, 0);
  assert.match(stdinPath.stderr, /stdin/);

  const inputPath = join(dir, "invalid.json");
  writeFileSync(inputPath, JSON.stringify({ ...envelope(), v: "task-map-envelope/v2" }));
  const invalid = run(["--input", inputPath, "--output", outputPath]);
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /task-map-envelope\/v1/);
});

test("task-board renders all envelope fields", (t) => {
  const dir = scratch(t);
  const inputPath = join(dir, "input.json");
  const outputPath = join(dir, "board.html");
  writeFileSync(inputPath, JSON.stringify([envelope({
    created_at: "2026-01-02T03:04:05.000Z",
    team: "TEAM_SENTINEL",
    project: "PROJECT_SENTINEL",
  })]));
  const result = run(["--input", inputPath, "--output", outputPath]);
  assert.equal(result.status, 0, result.stderr);
  const html = readFileSync(outputPath, "utf8");
  for (const value of ["2026-01-02T03:04:05.000Z", "TEAM_SENTINEL", "PROJECT_SENTINEL"]) {
    assert.ok(html.includes(value), `missing envelope field value ${value}`);
  }
});

test("task-board uses keyboard-operable column toggles and stable dedup order", (t) => {
  const dir = scratch(t);
  const inputPath = join(dir, "input.json");
  const outputPath = join(dir, "board.html");
  const common = {
    org: "darkrei08",
    repo: "pi-herdr-orchestration",
    source: "github",
    ticket: "I#2",
    created_at: "2026-11-28T12:00:00.000Z",
    state: "READY",
    evidence: [],
    blockers: [],
    waiting: [],
  };
  const records = [
    envelope({ ...common, pi_session_id: "pi-9", summary: "SECOND" }),
    envelope({ ...common, pi_session_id: "pi-1", summary: "FIRST" }),
  ];
  writeFileSync(inputPath, JSON.stringify(records));
  const result = run(["--input", inputPath, "--output", outputPath]);
  assert.equal(result.status, 0, result.stderr);
  const html = readFileSync(outputPath, "utf8");
  assert.match(html, /<button[^>]*class="column-toggle"/);
  assert.ok(html.indexOf("FIRST") < html.indexOf("SECOND"));
});

test("task-board docs specify path and counts output", () => {
  const doc = readFileSync(new URL("../docs/task-board.md", import.meta.url), "utf8");
  assert.match(doc, /counts/i);
});

test("task-board CLI caps rendered events with explicit truncation and total count", (t) => {
  const dir = scratch(t);
  const inputPath = join(dir, "input.json");
  const outputPath = join(dir, "board.html");
  const events = Array.from({ length: 25 }, (_, index) => ({
    id: `e${String(index).padStart(2, "0")}`,
    timestamp: now.toISOString(),
    source: "github",
    from: "Ready",
    to: "In Progress",
    reason: "state changed",
    actor: "lead",
    commit: null,
    evidence_ref: null,
    revision: 0,
    event_type: "transition",
    provider: "github",
    repo: "pi-herdr-orchestration",
    ticket: "I#42",
    pi_session_id: "pi-1",
    workspace_id: "w1",
    tab_id: "t1",
    pane_id: "p1",
    payload_hash: "0".repeat(64),
    correlation_id: null,
  }));
  writeFileSync(inputPath, JSON.stringify([envelope({ events })]));

  const result = run(["--input", inputPath, "--output", outputPath]);
  assert.equal(result.status, 0, result.stderr);
  const html = readFileSync(outputPath, "utf8");
  assert.ok(html.includes("25 events"));
  assert.ok(html.includes("5 events omitted"));
  assert.ok(html.includes("e00"));
  assert.ok(html.includes("e24"));
  assert.ok(!html.includes("e12"));
});
