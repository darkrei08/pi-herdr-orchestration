import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { after, test } from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BOARD_COLUMNS } from "./task-map-envelope.mjs";
import { projectFactoryEvidence } from "./factory-envelope-adapter.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const cli = join(here, "factory-envelope-adapter.mjs");
const scratch = mkdtempSync(join(tmpdir(), "factory-envelope-adapter-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

const authority = "odd/tasks/task-board-integration-20261128.md";
const repoA = "pi-herdr-orchestration";
const repoB = "pi-herdr-app";

function repo(name) {
  return {
    repo: name,
    labels: ["factory", "wayfinder"],
    permissions: { issues: { read: true, write: true }, wayfinder: true },
    audit: { scope: "full in-repo", report: authority },
  };
}

function stage(id, issue, kind, gate, repoName = repoA, extra = {}) {
  return {
    id,
    issue,
    repo: repoName,
    kind,
    gate,
    triage: "master",
    priority: "P1",
    concepts_source: "GPL reference",
    timestamp: "2026-11-28T10:00:00.000Z",
    subject: `Factory ${kind} ${id}`,
    local_authority: [authority, `odd/tasks/${id}.md`],
    evidence: [`factory ${kind}`, `gate ${gate}`],
    ...extra,
  };
}

const fixture = {
  org: "darkrei08",
  generated_at: "2026-11-28T10:00:00.000Z",
  repos: [repo(repoA), repo(repoB)],
  audit: { scope: "full in-repo", report: authority, approved: false },
  writeback_requested: true,
  stages: [
    stage("f1", 101, "intake", "PASS"),
    stage("f2", 102, "spec", "PASS"),
    stage("f3", 103, "ready", "PASS", repoB),
    stage("f4", 104, "development", "FAIL"),
    stage("f5", 105, "review", "BLOCKED", repoB),
    stage("f6", 106, "merged", "PASS"),
  ],
};

function runCli(args) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
}

test("projectFactoryEvidence maps intake and spec to Intake and gates to Blocked/Waiting", () => {
  const output = projectFactoryEvidence(fixture);
  assert.equal(output.mode, "dry-run");
  assert.equal(output.enabled, false);
  assert.deepEqual(output.columns, [...BOARD_COLUMNS]);
  assert.deepEqual(output.envelopes.map((item) => item.column), [
    "Intake",
    "Intake",
    "Ready",
    "Blocked/Waiting",
    "Blocked/Waiting",
    "Closed",
  ]);
  assert.deepEqual(output.envelopes.map((item) => item.gate), ["PASS", "PASS", "PASS", "FAIL", "BLOCKED", "PASS"]);
  assert.ok(output.envelopes.every((item) => BOARD_COLUMNS.includes(item.column)));
  assert.equal(output.envelopes[1].state, "INTAKE");
  assert.deepEqual(output.envelopes[1].local_authority, [authority, "odd/tasks/f2.md"]);
  assert.ok(output.envelopes[1].evidence.includes("factory spec"));
  assert.equal(output.envelopes[0].concepts_source, "GPL reference");
  assert.equal(output.envelopes[0].triage, "master");
  assert.equal(output.envelopes[0].priority, "P1");
  assert.deepEqual(output.counts, { stages: 6, envelopes: 6, writeback: 6, blocked: 2 });
});

test("projectFactoryEvidence emits full writeback projection without live writes", () => {
  const output = projectFactoryEvidence(fixture, { mode: "write", enabled: true });
  assert.equal(output.network, 0);
  assert.equal(output.enabled, true);
  assert.equal(output.writeback.length, 6);
  assert.equal(output.writeback[0].target, "darkrei08/pi-herdr-orchestration/I#101");
  assert.equal(output.writeback[0].authority, "local");
  assert.equal(output.writeback[0].live_write, false);
  assert.deepEqual(output.writeback.map((item) => item.column), output.envelopes.map((item) => item.column));
});

test("projectFactoryEvidence rejects malformed or unapproved factory fixtures", () => {
  assert.throws(() => projectFactoryEvidence({ ...fixture, org: "other" }), /org must be darkrei08/);
  assert.throws(() => projectFactoryEvidence({ ...fixture, repos: [{ ...repo(repoA), labels: ["other"] }] }), /factory label required/);
  assert.throws(() => projectFactoryEvidence({ ...fixture, repos: [{ ...repo(repoA), permissions: { issues: { read: true, write: false }, wayfinder: true } }] }), /read\/write issues and Wayfinder required/);
  assert.throws(() => projectFactoryEvidence({ ...fixture, stages: [{ ...fixture.stages[0], gate: "UNKNOWN" }] }), /gate must be PASS, FAIL or BLOCKED/);
  assert.throws(() => projectFactoryEvidence({ ...fixture, stages: [{ ...fixture.stages[0], concepts_source: "proprietary" }] }), /concepts must come from the GPL reference/);
  assert.throws(() => projectFactoryEvidence({ ...fixture, stages: [{ ...fixture.stages[0], triage: "" }] }), /master triage and priority required/);
  assert.throws(() => projectFactoryEvidence({ ...fixture, stages: [{ ...fixture.stages[0], local_authority: [] }] }), /ODD task docs and logs remain local authority/);
  assert.throws(() => projectFactoryEvidence({ ...fixture, stages: Array.from({ length: 501 }, (_, index) => stage(`f${index}`, index + 1, "intake", "PASS")) }), /too many stages/);
});

test("CLI prints help without requiring input or output", () => {
  const result = runCli(["--help"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /usage: factory-envelope-adapter\.mjs --input <path> --output <path>/);
});

test("CLI stays disabled in default dry-run and writes deterministic counts", () => {
  const input = join(scratch, "factory.json");
  const output = join(scratch, "factory-out.json");
  writeFileSync(input, `${JSON.stringify(fixture, null, 2)}\n`);
  const first = runCli(["--input", input, "--output", output]);
  assert.equal(first.status, 0);
  assert.match(first.stdout, new RegExp(`wrote ${output.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} envelopes=6 writeback=6 blocked=2 mode=dry-run enabled=false`));
  const bytes = readFileSync(output, "utf8");
  assert.equal(JSON.parse(bytes).enabled, false);
  const second = runCli(["--input", input, "--output", output]);
  assert.equal(second.status, 0);
  assert.equal(readFileSync(output, "utf8"), bytes);
});

test("CLI requires an approved in-repo audit and an approved audit file for write mode", () => {
  const input = join(scratch, "factory.json");
  const output = join(scratch, "factory-write.json");
  const audit = join(scratch, "factory-audit.json");
  writeFileSync(audit, `${JSON.stringify({ approved: true, scope: "factory-envelope-adapter" })}\n`);

  const gated = runCli(["--input", input, "--output", output, "--write", "--audit", audit]);
  assert.equal(gated.status, 1);
  assert.match(gated.stderr, /audit report not approved/);

  const approvedInput = join(scratch, "factory-approved.json");
  writeFileSync(approvedInput, `${JSON.stringify({ ...fixture, audit: { ...fixture.audit, approved: true } }, null, 2)}\n`);
  const enabled = runCli(["--input", approvedInput, "--output", output, "--write", "--audit", audit]);
  assert.equal(enabled.status, 0);
  assert.match(enabled.stdout, /mode=write enabled=true/);
  assert.equal(JSON.parse(readFileSync(output, "utf8")).network, 0);

  const badAudit = join(scratch, "factory-audit-no.json");
  writeFileSync(badAudit, `${JSON.stringify({ approved: false, scope: "factory-envelope-adapter" })}\n`);
  const denied = runCli(["--input", approvedInput, "--output", output, "--write", "--audit", badAudit]);
  assert.equal(denied.status, 1);
  assert.match(denied.stderr, /audit not approved/);

  const noFile = runCli(["--input", approvedInput, "--output", output, "--write"]);
  assert.equal(noFile.status, 1);
  assert.match(noFile.stderr, /--write requires --audit/);
});
