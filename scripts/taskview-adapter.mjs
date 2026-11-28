import { createHash, createHmac } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BOARD_COLUMNS,
  ENVELOPE_VERSION,
  EVENT_FIELDS,
  applyCorrection,
  buildEnvelope,
  createEvent,
  migrateEnvelope,
  resolveColumn,
  transitionEnvelope,
} from "./task-map-envelope.mjs";
import { dedupeKey, normalizeEnvelopes } from "./task-board.mjs";

const SCOPE = "taskview-adapter";
const FIXTURE_NOW = new Date("2000-01-01T00:00:00.000Z");
const FIXTURE_TIMESTAMP = FIXTURE_NOW.toISOString();
const SIGNING_LABEL = "taskview-fixture-signature";

function compare(a, b) {
  const left = String(a ?? "");
  const right = String(b ?? "");
  return left < right ? -1 : left > right ? 1 : 0;
}

function domainCompare(a, b) {
  for (const field of ["org", "repo", "ticket", "source", "state", "subject"]) {
    const result = compare(a[field], b[field]);
    if (result !== 0) return result;
  }
  return compare(dedupeKey(a), dedupeKey(b));
}

function prepareEnvelope(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || raw.v !== ENVELOPE_VERSION) return raw;
  return migrateEnvelope(raw, FIXTURE_NOW);
}

function normalizeEvent(envelope, event) {
  return createEvent(envelope, { source: SCOPE, ...event }, FIXTURE_NOW);
}

function assertEventSchema(events) {
  for (const event of events) {
    if (!EVENT_FIELDS.every((field) => Object.hasOwn(event, field))) {
      throw new Error("event does not use the twenty-field schema");
    }
  }
}

export function projectTaskView(input, options = {}) {
  const mode = options.mode ?? "fixture";
  if (mode !== "fixture") throw new Error(`unsupported mode ${String(mode)}`);
  if (!Array.isArray(input)) throw new Error("input must be an envelope array");

  const seen = new Set();
  const unique = [];
  let duplicates = 0;
  for (const raw of input) {
    const envelope = normalizeEnvelopes([prepareEnvelope(raw)])[0];
    if (envelope.events.some((event) => !event || typeof event !== "object" || Array.isArray(event))) {
      throw new Error("each event must be an object");
    }
    const key = dedupeKey(envelope);
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);
    unique.push(envelope);
  }
  unique.sort(domainCompare);

  const columns = Object.fromEntries(BOARD_COLUMNS.map((column) => [column, 0]));
  const envelopes = [];
  const writeback = [];
  const webhooks = [];
  let eventCount = 0;

  for (const envelope of unique) {
    const key = dedupeKey(envelope);
    const resolved = resolveColumn(envelope);
    if (!BOARD_COLUMNS.includes(resolved.column)) throw new Error(`unmapped board column ${resolved.column}`);
    columns[resolved.column] += 1;

    const normalizedEvents = envelope.events.map((event) => normalizeEvent(envelope, event));
    const transitioned = transitionEnvelope(
      { ...envelope, events: normalizedEvents },
      {},
      {
        source: SCOPE,
        reason: resolved.reason ?? "fixture projection",
        event_type: "projection",
        correlation_id: normalizedEvents[0]?.correlation_id ?? normalizedEvents[0]?.id ?? null,
      },
      FIXTURE_NOW,
    );
    const corrected = applyCorrection(transitioned, {
      timestamp: FIXTURE_TIMESTAMP,
      source: SCOPE,
      from: resolved.column,
      to: resolved.column,
      reason: "fixture writeback prepared",
      event_type: "writeback_fixture",
      correlation_id: normalizedEvents[0]?.correlation_id ?? normalizedEvents[0]?.id ?? null,
    }, FIXTURE_NOW);
    assertEventSchema(corrected.events);
    eventCount += corrected.events.length;

    const blocked = envelope.blockers.length > 0 || envelope.waiting.length > 0;
    const event = corrected.events[corrected.events.length - 1];
    envelopes.push({
      dedupe_key: key,
      ticket: envelope.ticket,
      subject: envelope.subject,
      source: envelope.source,
      state: envelope.state,
      column: resolved.column,
      reason: resolved.reason,
      blocked,
      revision: corrected.revision,
      events: corrected.events,
    });
    writeback.push({
      dedupe_key: key,
      ticket: envelope.ticket,
      state: envelope.state,
      column: resolved.column,
      reason: resolved.reason,
      blocked,
      revision: corrected.revision,
      event_id: event.id,
      correlation_id: event.correlation_id,
      mode,
      network: 0,
      live_write: false,
    });

    const payload = buildEnvelope({
      ...envelope,
      revision: corrected.revision,
      events: corrected.events,
    }, FIXTURE_NOW);
    const serialized = JSON.stringify(payload);
    webhooks.push({
      delivery_id: createHash("sha256").update(`${key}\n${event.id}`).digest("hex").slice(0, 16),
      dedupe_key: key,
      event_id: event.id,
      event_type: event.event_type,
      algorithm: "hmac-sha256-fixture",
      signature: createHmac("sha256", SIGNING_LABEL).update(serialized).digest("hex"),
      payload,
    });
  }

  return {
    mode,
    source: SCOPE,
    network: 0,
    live_write: false,
    counts: {
      input: input.length,
      envelopes: envelopes.length,
      duplicates,
      writeback: writeback.length,
      webhooks: webhooks.length,
      events: eventCount,
      columns,
    },
    envelopes,
    writeback,
    webhooks,
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help") args.help = true;
    else if (argument === "--input" || argument === "--output") {
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
    process.stdout.write("usage: taskview-adapter.mjs --input envelopes.json --output projection.json [--help]\n");
    return;
  }
  if (!args.input || !args.output) throw new Error("--input and --output are required");
  const output = projectTaskView(readJson(args.input, "input"));
  mkdirSync(dirname(args.output), { recursive: true });
  writeFileSync(args.output, `${JSON.stringify(output, null, 2)}\n`);
  process.stdout.write(
    `wrote ${args.output} envelopes=${output.counts.envelopes} duplicates=${output.counts.duplicates} `
    + `writeback=${output.counts.writeback} webhooks=${output.counts.webhooks} events=${output.counts.events} `
    + `mode=${output.mode} network=0 live_write=false\n`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`taskview-adapter: ${error.message}\n`);
    process.exitCode = 1;
  }
}
