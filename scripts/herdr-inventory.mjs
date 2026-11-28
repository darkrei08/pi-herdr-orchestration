import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BOARD_COLUMNS, fromMailboxAndHerdr, resolveColumn } from "./task-map-envelope.mjs";
import { dedupeKey } from "./task-board.mjs";

const SOURCE = "herdr-inventory";
const FIXTURE_NOW = new Date("2000-01-01T00:00:00.000Z");
const MISSING_IDENTITY = "Herdr identity unavailable";

function compare(a, b) {
  const left = String(a ?? "");
  const right = String(b ?? "");
  return left < right ? -1 : left > right ? 1 : 0;
}

function snapshotRows(snapshot, key, label) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    throw new Error(`invalid ${label} snapshot: expected an object`);
  }
  const rows = snapshot.result?.[key] ?? snapshot[key] ?? [];
  if (!Array.isArray(rows)) throw new Error(`invalid ${label} snapshot: ${key} must be an array`);
  return rows;
}

function sessionIndex(sessions) {
  const index = new Map();
  for (const session of sessions) {
    for (const key of [session?.name, session?.agent, session?.task]) {
      if (typeof key === "string" && key && !index.has(key)) index.set(key, session);
    }
  }
  return index;
}

export function buildInventory(snapshots, options = {}) {
  const agents = snapshotRows(snapshots?.agents, "agents", "herdr agent list");
  const sessions = snapshotRows(snapshots?.sessions, "sessions", "herdr session list");
  const mailbox = snapshots?.mailbox;
  if (!Array.isArray(mailbox)) throw new Error("invalid mailbox snapshot: expected an array");

  const envelopes = fromMailboxAndHerdr(mailbox, { result: { agents } }, options.meta ?? {}, options.now ?? FIXTURE_NOW);
  const bySession = sessionIndex(sessions);
  const seen = new Set();
  const uniqueEnvelopes = [];
  const inventory = [];
  let duplicates = 0;

  for (const envelope of envelopes) {
    const key = dedupeKey(envelope);
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);
    uniqueEnvelopes.push(envelope);

    const session = bySession.get(envelope.session_name) ?? bySession.get(envelope.ticket);
    const hasIdentity = [envelope.pi_session_id, envelope.workspace_id, envelope.tab_id, envelope.pane_id]
      .some((value) => value !== null && value !== undefined && value !== "");
    const missingIdentity = envelope.waiting.includes(MISSING_IDENTITY) || !hasIdentity;
    inventory.push({
      dedupe_key: key,
      agent: envelope.session_name ?? null,
      session_name: session?.name ?? envelope.session_name ?? null,
      workspace_id: envelope.workspace_id ?? null,
      tab_id: envelope.tab_id ?? null,
      pane_id: envelope.pane_id ?? null,
      worktree: envelope.worktree ?? session?.worktree ?? null,
      pi_session_id: envelope.pi_session_id ?? null,
      task: envelope.ticket,
      state: envelope.state,
      missing_identity: missingIdentity,
      reason: missingIdentity ? MISSING_IDENTITY : null,
      waiting: envelope.waiting,
    });
  }

  const sorted = inventory.map((item, index) => ({ item, envelope: uniqueEnvelopes[index] }));
  sorted.sort((a, b) => compare(a.item.task, b.item.task)
    || compare(a.item.agent, b.item.agent)
    || compare(a.item.dedupe_key, b.item.dedupe_key));

  const columns = Object.fromEntries(BOARD_COLUMNS.map((column) => [column, 0]));
  for (const { envelope } of sorted) {
    const column = resolveColumn(envelope).column;
    if (!BOARD_COLUMNS.includes(column)) throw new Error(`unmapped board column ${column}`);
    columns[column] += 1;
  }

  return {
    source: SOURCE,
    network: 0,
    mutations: 0,
    live: false,
    counts: {
      agents: agents.length,
      sessions: sessions.length,
      mailbox: mailbox.length,
      inventories: inventory.length,
      envelopes: uniqueEnvelopes.length,
      duplicates,
      missing_identity: inventory.filter((item) => item.missing_identity).length,
      columns,
    },
    inventory: sorted.map(({ item }) => item),
    envelopes: sorted.map(({ envelope }) => envelope),
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help") args.help = true;
    else if (["--agents", "--sessions", "--mailbox", "--output"].includes(argument)) {
      const value = argv[++index];
      if (!value || value.startsWith("--")) throw new Error(`${argument} requires a path`);
      args[argument.slice(2)] = value;
    } else throw new Error(`unknown argument ${argument}`);
  }
  return args;
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`invalid JSON in ${label}: ${error.message}`);
    throw error;
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write("usage: herdr-inventory.mjs --agents agents.json --sessions sessions.json --mailbox rows.json --output inventory.json [--help]\n");
    return;
  }
  for (const flag of ["agents", "sessions", "mailbox", "output"]) {
    if (!args[flag]) throw new Error(`missing --${flag} path`);
  }

  const result = buildInventory({
    agents: readJson(args.agents, "agents"),
    sessions: readJson(args.sessions, "sessions"),
    mailbox: readJson(args.mailbox, "mailbox"),
  });
  mkdirSync(dirname(args.output), { recursive: true });
  writeFileSync(args.output, `${JSON.stringify(result, null, 2)}\n`);

  const { counts } = result;
  const countsLine = [
    `agents=${counts.agents}`,
    `sessions=${counts.sessions}`,
    `mailbox=${counts.mailbox}`,
    `inventories=${counts.inventories}`,
    `envelopes=${counts.envelopes}`,
    `duplicates=${counts.duplicates}`,
    `missing_identity=${counts.missing_identity}`,
    `network=${result.network}`,
    `mutations=${result.mutations}`,
  ].join(" ");
  const columns = BOARD_COLUMNS.map((column) => `${column}=${counts.columns[column]}`).join(" ");
  process.stdout.write(`${args.output}\n${countsLine}\n${columns}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`${SOURCE}: ${error.message}`);
    process.exitCode = 1;
  }
}
