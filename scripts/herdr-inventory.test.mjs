import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { BOARD_COLUMNS } from "./task-map-envelope.mjs";
import { dedupeKey, renderBoardHtml } from "./task-board.mjs";
import { buildInventory } from "./herdr-inventory.mjs";

const SCRIPT = fileURLToPath(new URL("./herdr-inventory.mjs", import.meta.url));
const SOURCE = readFileSync(SCRIPT, "utf8");
const PI_PATH = "/root/.pi/agent/sessions/x/2026-11-28T09Z_01a20749-4385-74a6-b8ab-1411a7f8afc9.jsonl";
const PI_ID = "01a20749-4385-74a6-b8ab-1411a7f8afc9";

function agentSnapshot() {
  return {
    result: {
      agents: [{
        name: "lead",
        agent_status: "working",
        workspace_id: "wS1",
        tab_id: "wS1:t3",
        pane_id: "wS1:p7",
        worktree: "/repo/.worktrees/telegram-evidence-report",
        agent_session: { agent: "pi", kind: "path", value: PI_PATH },
      }],
    },
  };
}

function sessionSnapshot() {
  return {
    result: {
      sessions: [{
        name: "lead",
        agent: "lead",
        worktree: "/repo/.worktrees/telegram-evidence-report",
        path: PI_PATH,
      }],
    },
  };
}

function mailboxRows() {
  return [
    { task: "I#112", agent: "lead", state: "WORKING", summary: "inventory", evidence: "odd/tasks/feature.md", question_id: null, flag: "OK", reason: "-", budget_block: null },
    { task: "PR#98", agent: "scout", state: "READY", summary: "review", evidence: "-", question_id: null, flag: "OK", reason: "-", budget_block: null },
  ];
}

function snapshots() {
  return { agents: agentSnapshot(), sessions: sessionSnapshot(), mailbox: mailboxRows() };
}

test("buildInventory maps fixture identity and flags missing Herdr identity deterministically", () => {
  const input = snapshots();
  const result = buildInventory(input);

  assert.equal(result.counts.agents, 1);
  assert.equal(result.counts.sessions, 1);
  assert.equal(result.counts.mailbox, 2);
  assert.equal(result.counts.inventories, 2);
  assert.equal(result.counts.duplicates, 0);
  assert.equal(result.counts.missing_identity, 1);
  assert.equal(result.network, 0);
  assert.equal(result.mutations, 0);
  assert.deepEqual(buildInventory(input), result);

  const [lead, scout] = result.inventory;
  assert.equal(lead.agent, "lead");
  assert.equal(lead.session_name, "lead");
  assert.equal(lead.workspace_id, "wS1");
  assert.equal(lead.tab_id, "wS1:t3");
  assert.equal(lead.pane_id, "wS1:p7");
  assert.equal(lead.worktree, "/repo/.worktrees/telegram-evidence-report");
  assert.equal(lead.pi_session_id, PI_ID);
  assert.equal(lead.task, "I#112");
  assert.equal(lead.state, "WORKING");
  assert.equal(lead.missing_identity, false);
  assert.equal(lead.reason, null);

  assert.equal(scout.agent, "scout");
  assert.equal(scout.pi_session_id, null);
  assert.equal(scout.workspace_id, null);
  assert.equal(scout.task, "PR#98");
  assert.equal(scout.state, "READY");
  assert.equal(scout.missing_identity, true);
  assert.equal(scout.reason, "Herdr identity unavailable");
  assert.ok(scout.waiting.includes("Herdr identity unavailable"));
});

test("fixture envelopes reuse dedupe and board columns and render a full board", () => {
  const result = buildInventory(snapshots());
  assert.equal(result.envelopes.length, 2);
  assert.equal(result.envelopes[0].v, "task-map-envelope/v1");
  assert.equal(result.envelopes[0].source, "mailbox");
  assert.equal(result.envelopes[0].ticket, "I#112");
  assert.equal(result.envelopes[0].pi_session_id, PI_ID);
  assert.deepEqual(
    result.inventory.map((item) => item.dedupe_key),
    result.envelopes.map(dedupeKey),
  );
  assert.deepEqual(Object.keys(result.counts.columns), BOARD_COLUMNS);
  assert.equal(result.counts.columns["In Progress"], 1);
  assert.equal(result.counts.columns["Blocked/Waiting"], 1);

  const html = renderBoardHtml(result.envelopes);
  for (const column of BOARD_COLUMNS) {
    assert.ok(html.includes(`data-column="${column}"`), `missing column ${column}`);
  }
  assert.ok(html.includes(PI_ID));
  assert.ok(html.includes("Herdr identity unavailable"));
});

test("sessions snapshot supplies worktree and duplicate mailbox rows are counted once", () => {
  const agents = agentSnapshot();
  delete agents.result.agents[0].worktree;
  const mailbox = [...mailboxRows(), { ...mailboxRows()[0], state: "MERGED" }];
  const result = buildInventory({ agents, sessions: sessionSnapshot(), mailbox });

  assert.equal(result.counts.mailbox, 3);
  assert.equal(result.counts.duplicates, 1);
  assert.equal(result.counts.inventories, 2);
  assert.equal(result.inventory[0].worktree, "/repo/.worktrees/telegram-evidence-report");
  assert.equal(result.inventory[0].missing_identity, false);
});

test("implementation is stdlib-only and declares zero network and zero Herdr mutations", () => {
  const result = buildInventory(snapshots());
  for (const forbidden of ["node:child_process", "node:http", "node:https", "node:net", "spawn(", "fetch(", "kill(", "rename("]) {
    assert.ok(!SOURCE.includes(forbidden), `source must not use ${forbidden}`);
  }
  assert.match(SOURCE, /from "node:fs"/);
  assert.equal(result.network, 0);
  assert.equal(result.mutations, 0);
  assert.equal(result.live, false);
});

test("CLI prints help, writes output and prints path plus counts", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "herdr-inventory-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const agentsPath = join(dir, "agents.json");
  const sessionsPath = join(dir, "sessions.json");
  const mailboxPath = join(dir, "mailbox.json");
  const outputPath = join(dir, "nested", "inventory.json");
  writeFileSync(agentsPath, `${JSON.stringify(agentSnapshot())}\n`);
  writeFileSync(sessionsPath, `${JSON.stringify(sessionSnapshot())}\n`);
  writeFileSync(mailboxPath, `${JSON.stringify(mailboxRows())}\n`);

  const help = spawnSync(process.execPath, [SCRIPT, "--help"], { encoding: "utf8" });
  assert.equal(help.status, 0, help.stderr);
  for (const flag of ["--agents", "--sessions", "--mailbox", "--output", "--help"]) {
    assert.ok(help.stdout.includes(flag), `help must mention ${flag}`);
  }

  const run = spawnSync(process.execPath, [
    SCRIPT, "--agents", agentsPath, "--sessions", sessionsPath, "--mailbox", mailboxPath, "--output", outputPath,
  ], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  assert.ok(run.stdout.includes(outputPath), run.stdout);
  for (const expected of ["agents=1", "sessions=1", "mailbox=2", "inventories=2", "envelopes=2", "duplicates=0", "missing_identity=1", "network=0", "mutations=0", "In Progress=1"]) {
    assert.ok(run.stdout.includes(expected), `${expected} missing from ${run.stdout}`);
  }
  const written = JSON.parse(readFileSync(outputPath, "utf8"));
  assert.equal(written.inventory.length, 2);
  assert.equal(written.envelopes.length, 2);
});

test("CLI fails closed on invalid snapshots and missing arguments without writing output", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "herdr-inventory-invalid-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const agentsPath = join(dir, "agents.json");
  const sessionsPath = join(dir, "sessions.json");
  const mailboxPath = join(dir, "mailbox.json");
  writeFileSync(agentsPath, `${JSON.stringify(agentSnapshot())}\n`);
  writeFileSync(sessionsPath, `${JSON.stringify(sessionSnapshot())}\n`);
  writeFileSync(mailboxPath, "{not json");

  const invalid = join(dir, "invalid.json");
  const run = spawnSync(process.execPath, [
    SCRIPT, "--agents", agentsPath, "--sessions", sessionsPath, "--mailbox", mailboxPath, "--output", invalid,
  ], { encoding: "utf8" });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /^herdr-inventory:/);
  assert.ok(!existsSync(invalid));

  const missing = spawnSync(process.execPath, [SCRIPT, "--agents", agentsPath], { encoding: "utf8" });
  assert.notEqual(missing.status, 0);
  const unknown = spawnSync(process.execPath, [SCRIPT, "--bogus"], { encoding: "utf8" });
  assert.notEqual(unknown.status, 0);
});
