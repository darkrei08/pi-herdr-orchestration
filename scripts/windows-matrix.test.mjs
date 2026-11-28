import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CHECKS,
  UsageError,
  classifyRow,
  exitCodeFor,
  main,
  parseArguments,
  planMatrix,
  renderResults,
  validateTarget,
} from "./windows-matrix.mjs";

const VALID = {
  mode: "plan",
  target: {
    host: "win-qa-01",
    user: "qa-runner",
    scope: "full-ssh+full-suite",
    backup: "snapshot://win-qa-01/pre-run",
    approval: "ticket-113-approved-by-lead",
  },
  envelope: {
    evidence: ["artifact://session/abc", "artifact://screenshot/01"],
    events: [
      {
        id: "evt-1",
        type: "approval",
        ticket: "113",
        evidence_ref: "artifact://session/abc",
      },
    ],
  },
};

function without(target, key) {
  const copy = { ...target };
  delete copy[key];
  return copy;
}

test("CHECKS pins the full read-only Windows matrix in deterministic order", () => {
  assert.deepEqual(CHECKS.map((check) => check.id), [
    "herdr-app-version",
    "os",
    "session-inventory",
    "workspace-tab-pane",
    "ui",
    "screenshots",
    "connectivity",
    "full-ssh",
    "full-suite",
  ]);
  const labels = CHECKS.map((check) => check.label);
  for (const label of [
    "Herdr App version",
    "OS",
    "session inventory",
    "workspace/tab/pane",
    "UI",
    "screenshots",
    "connectivity",
    "full SSH",
    "full test suite",
  ]) {
    assert.ok(labels.includes(label), `missing full-plan check: ${label}`);
  }
});

test("validateTarget accepts explicit plan and dry-run fixtures", () => {
  for (const mode of ["plan", "dry-run"]) {
    const outcome = validateTarget({ ...VALID, mode });
    assert.equal(outcome.ok, true, JSON.stringify(outcome.errors));
    assert.deepEqual(outcome.errors, []);
    assert.equal(outcome.mode, mode);
    assert.equal(outcome.target.host, "win-qa-01");
    assert.equal(outcome.target.user, "qa-runner");
    assert.equal(outcome.target.scope, "full-ssh+full-suite");
    assert.equal(outcome.target.backup, "snapshot://win-qa-01/pre-run");
    assert.equal(outcome.target.approval, "ticket-113-approved-by-lead");
    assert.equal(outcome.destructive, false);
    assert.equal(outcome.executionRequested, false);
  }
});

test("validateTarget fails closed for each missing gate", () => {
  for (const key of ["host", "user", "scope", "backup", "approval"]) {
    const outcome = validateTarget({ ...VALID, target: without(VALID.target, key) });
    assert.equal(outcome.ok, false, `expected ${key} gate to fail`);
    assert.ok(outcome.errors.some((error) => error.includes(key)), `${key}: ${outcome.errors.join("; ")}`);
  }
  const partialScope = validateTarget({ ...VALID, target: { ...VALID.target, scope: "full-ssh" } });
  assert.equal(partialScope.ok, false);
  assert.ok(partialScope.errors.some((error) => error.includes("full-suite")));
});

test("validateTarget supports an explicit approval object and snapshot alias", () => {
  const outcome = validateTarget({
    ...VALID,
    target: {
      ...without(VALID.target, "backup"),
      snapshotTarget: "snapshot://win-qa-01/alias",
      approval: { granted: true, by: "lead" },
    },
  });
  assert.equal(outcome.ok, true, JSON.stringify(outcome.errors));
  assert.equal(outcome.target.backup, "snapshot://win-qa-01/alias");
  assert.equal(outcome.target.approval, "lead");
});

test("validateTarget rejects execution modes and destructive execution locally", () => {
  const execute = validateTarget({ ...VALID, mode: "execute" });
  assert.equal(execute.ok, false);
  assert.equal(execute.executionRequested, true);
  assert.ok(execute.errors.some((error) => error.includes("only plan and dry-run")));

  const explicitExecute = validateTarget({ ...VALID, execute: true, destructive: true });
  assert.equal(explicitExecute.ok, false);
  assert.equal(explicitExecute.executionRequested, true);
  assert.ok(explicitExecute.errors.some((error) => error.includes("rejected locally")));

  const noBackup = validateTarget({
    ...VALID,
    destructive: true,
    target: without(VALID.target, "backup"),
  });
  assert.equal(noBackup.ok, false);
  assert.ok(noBackup.errors.some((error) => error.includes("destructive request requires backup/snapshot")));
});

test("classifyRow keeps read-only plans honest", () => {
  const valid = validateTarget(VALID);
  const planned = classifyRow({ validation: valid, check: CHECKS[0] });
  assert.equal(planned.status, "NOT RUN");
  assert.match(planned.detail, /live execution not attempted/);

  const blocked = classifyRow({ validation: validateTarget({ ...VALID, target: {} }), check: CHECKS[0] });
  assert.equal(blocked.status, "BLOCKED");
  assert.match(blocked.detail, /gate:/);

  const rejected = classifyRow({ validation: validateTarget({ ...VALID, mode: "run" }), check: CHECKS[0] });
  assert.equal(rejected.status, "FAIL");
  assert.match(rejected.detail, /rejected locally|only plan and dry-run/);
});

test("exitCodeFor ranks FAIL over BLOCKED over NOT RUN over PASS", () => {
  assert.equal(exitCodeFor([{ status: "PASS" }]), 0);
  assert.equal(exitCodeFor([{ status: "NOT RUN" }]), 1);
  assert.equal(exitCodeFor([{ status: "BLOCKED" }]), 2);
  assert.equal(exitCodeFor([{ status: "FAIL" }]), 3);
});

test("planMatrix emits the full SSH and full suite plan with envelope audit records", () => {
  const plan = planMatrix(VALID);
  assert.equal(plan.mode, "plan");
  assert.equal(plan.rows.length, 9);
  assert.deepEqual(plan.rows.map((row) => row.id), CHECKS.map((check) => check.id));
  assert.deepEqual(new Set(plan.rows.map((row) => row.status)), new Set(["NOT RUN"]));
  assert.deepEqual(plan.counts, { pass: 0, blocked: 0, fail: 0, "not-run": 9 });
  assert.equal(plan.audit.envelopeCount, 1);
  assert.deepEqual(plan.audit.evidence, VALID.envelope.evidence);
  assert.equal(plan.audit.events.length, 1);
  assert.equal(plan.audit.events[0].evidence_ref, "artifact://session/abc");
  assert.equal(plan.network, 0);
  assert.equal(plan.ssh, 0);
  assert.equal(plan.spawn, 0);
  assert.equal(plan.changes, 0);
});

test("planMatrix blocks every check when any gate is missing", () => {
  const plan = planMatrix({ ...VALID, target: { ...VALID.target, user: "" } });
  assert.deepEqual(plan.counts, { pass: 0, blocked: 9, fail: 0, "not-run": 0 });
  assert.deepEqual(new Set(plan.rows.map((row) => row.status)), new Set(["BLOCKED"]));
  assert.ok(plan.rows.every((row) => row.detail.includes("missing user")));
  assert.match(renderResults(plan), /summary pass=0 blocked=9 fail=0 not-run=0/);
});

test("planMatrix rejects destructive execution but plans destructive checks with a snapshot", () => {
  const rejected = planMatrix({ ...VALID, mode: "execute", destructive: true });
  assert.deepEqual(rejected.counts, { pass: 0, blocked: 0, fail: 9, "not-run": 0 });

  const planned = planMatrix({ ...VALID, destructive: true });
  assert.deepEqual(planned.counts, { pass: 0, blocked: 0, fail: 0, "not-run": 9 });
  assert.match(renderResults(planned), /destructive=planned/);
  assert.match(renderResults(planned), /execution=0/);
});

test("renderResults is deterministic and prints explicit counts", () => {
  const first = renderResults(planMatrix(VALID));
  const second = renderResults(planMatrix(VALID));
  assert.equal(first, second);
  assert.match(first, /^mode=plan$/m);
  assert.match(first, /^host=win-qa-01$/m);
  assert.match(first, /^user=qa-runner$/m);
  assert.match(first, /^scope=full-ssh\+full-suite$/m);
  assert.match(first, /^execution=0 network=0 ssh=0 spawn=0 changes=0$/m);
  assert.match(first, /^evidence\[0\]=artifact:\/\/session\/abc$/m);
  assert.match(first, /^event\[0\]=id=evt-1 type=approval ticket=113 evidence_ref=artifact:\/\/session\/abc$/m);
  assert.match(first, /^checks=9$/m);
  assert.match(first, /summary pass=0 blocked=0 fail=0 not-run=9$/);
});

test("parseArguments accepts help, input and output only", () => {
  assert.deepEqual(parseArguments(["--help"]), { help: true, input: null, output: null });
  assert.deepEqual(parseArguments(["--input", "in.json", "--output", "out.txt"]), {
    help: false,
    input: "in.json",
    output: "out.txt",
  });
  assert.throws(() => parseArguments([]), UsageError);
  assert.throws(() => parseArguments(["run"]), UsageError);
  assert.throws(() => parseArguments(["--input"]), UsageError);
});

test("main prints path plus counts and writes only the requested output", () => {
  const stdout = [];
  const writes = [];
  const reads = [];
  const code = main(["--input", "/tmp/windows-input.json", "--output", "/tmp/windows-report.txt"], {
    stdout: { write: (chunk) => stdout.push(chunk) },
    readFile: (path) => {
      reads.push(path);
      return JSON.stringify(VALID);
    },
    writeFile: (path, content) => writes.push({ path, content }),
  });
  assert.equal(code, 0);
  assert.deepEqual(reads, ["/tmp/windows-input.json"]);
  assert.deepEqual(writes.map((write) => write.path), ["/tmp/windows-report.txt"]);
  assert.match(writes[0].content, /summary pass=0 blocked=0 fail=0 not-run=9/);
  const output = stdout.join("");
  assert.match(output, /input=\/tmp\/windows-input\.json/);
  assert.match(output, /output=\/tmp\/windows-report\.txt/);
  assert.match(output, /summary pass=0 blocked=0 fail=0 not-run=9/);
});

test("main help writes usage without reading or writing files", () => {
  const stdout = [];
  const code = main(["--help"], {
    stdout: { write: (chunk) => stdout.push(chunk) },
    readFile: () => {
      throw new Error("help must not read input");
    },
    writeFile: () => {
      throw new Error("help must not write output");
    },
  });
  assert.equal(code, 0);
  const output = stdout.join("");
  assert.match(output, /--input/);
  assert.match(output, /--output/);
  assert.match(output, /--help/);
});

test("windows-matrix source has no spawn, network or SSH transport", () => {
  const source = readFileSync(new URL("./windows-matrix.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /from ["']node:(child_process|net|http|https|dgram|tls)["']/);
  assert.doesNotMatch(source, /\bspawn(?:Sync)?\s*\(/);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /\bcreateConnection\s*\(/);
  assert.doesNotMatch(source, /\bexec(?:File|Sync)?\s*\(/);
});
