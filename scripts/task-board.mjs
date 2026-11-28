import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  BOARD_COLUMNS,
  ENVELOPE_VERSION,
  EVENT_FIELDS,
  migrateEnvelope,
  resolveColumn,
} from "./task-map-envelope.mjs";

export const EVENT_RENDER_LIMIT = 20;

const DEDUPE_FIELDS = [
  "org",
  "repo",
  "ticket",
  "source",
  "pi_session_id",
  "workspace_id",
  "tab_id",
  "pane_id",
];
const SORT_FIELDS = ["org", "repo", "ticket", "created_at", ...DEDUPE_FIELDS];
const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ESCAPES[character]);
}

function compare(a, b) {
  const left = String(a ?? "");
  const right = String(b ?? "");
  return left < right ? -1 : left > right ? 1 : 0;
}

export function dedupeKey(envelope) {
  return DEDUPE_FIELDS.map((field) => String(envelope?.[field] ?? "")).join("/");
}

function validateEnvelope(envelope) {
  if (!envelope || envelope.v !== ENVELOPE_VERSION) {
    throw new Error(`Invalid envelope version: expected ${ENVELOPE_VERSION}`);
  }
  if (!envelope.subject || !envelope.source || !envelope.ticket) {
    throw new Error("Invalid envelope: missing subject, source or ticket");
  }
  return migrateEnvelope(envelope);
}

export function normalizeEnvelopes(input) {
  const envelopes = (Array.isArray(input) ? input : [input]).map(validateEnvelope);
  envelopes.sort((a, b) => {
    for (const field of SORT_FIELDS) {
      const result = compare(a[field], b[field]);
      if (result !== 0) return result;
    }
    return 0;
  });
  const seen = new Set();
  return envelopes.filter((envelope) => {
    const key = dedupeKey(envelope);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function field(label, value) {
  return `<div class="field"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`;
}

function listField(label, values) {
  return field(label, (Array.isArray(values) ? values : []).map((value) => String(value)).join(", "));
}

export function renderEvents(events = [], options = {}) {
  const all = Array.isArray(events) ? events : [];
  const cap = Math.max(2, Number(options.cap ?? EVENT_RENDER_LIMIT));
  const headCount = Math.min(Math.ceil(cap / 2), all.length);
  const tailCount = Math.min(Math.floor(cap / 2), Math.max(0, all.length - headCount));
  const omitted = Math.max(0, all.length - headCount - tailCount);
  const item = (event) => `<li class="event"><dl>${EVENT_FIELDS.map((name) => (
    `<dt>${escapeHtml(name)}</dt><dd>${escapeHtml(event?.[name])}</dd>`
  )).join("")}</dl></li>`;
  const rows = [
    ...all.slice(0, headCount).map(item),
    ...(omitted ? [`<li class="truncated">${omitted} events omitted (head/tail cap ${cap}; ${all.length} total)</li>`] : []),
    ...all.slice(all.length - tailCount).map(item),
  ];
  return `<section class="events" data-total="${all.length}"><h4>${all.length} events</h4><ol>${rows.join("")}</ol></section>`;
}

function renderCard(envelope) {
  const resolved = resolveColumn(envelope);
  const hasSession = [envelope.pi_session_id, envelope.workspace_id, envelope.tab_id, envelope.pane_id]
    .some((value) => value !== null && value !== undefined && value !== "");
  const session = hasSession ? {
    pi_session_id: envelope.pi_session_id,
    workspace_id: envelope.workspace_id,
    tab_id: envelope.tab_id,
    pane_id: envelope.pane_id,
  } : "session unavailable";
  const fields = [
    field("Column", resolved.column),
    ...(resolved.reason ? [field("Reason", resolved.reason)] : []),
    field("Key", dedupeKey(envelope)),
    field("v", envelope.v),
    field("created_at", envelope.created_at),
    field("org", envelope.org),
    field("team", envelope.team),
    field("project", envelope.project),
    field("repo", envelope.repo),
    field("ticket", envelope.ticket),
    field("source", envelope.source),
    field("state", envelope.state),
    field("subject", envelope.subject),
    field("session", hasSession ? JSON.stringify(session) : session),
    field("session_name", envelope.session_name),
    field("pi_session_id", envelope.pi_session_id),
    field("workspace_id", envelope.workspace_id),
    field("tab_id", envelope.tab_id),
    field("pane_id", envelope.pane_id),
    field("worktree", envelope.worktree),
    field("branch", envelope.branch),
    listField("evidence", envelope.evidence),
    listField("blockers", envelope.blockers),
    listField("waiting", envelope.waiting),
    listField("next", envelope.next),
    field("summary", envelope.summary),
    field("revision", envelope.revision ?? 0),
  ].join("");
  return `<article class="card" data-lane="${escapeHtml(resolved.column)}" data-dedupe-key="${escapeHtml(dedupeKey(envelope))}">
    <h3>${escapeHtml(envelope.org ?? "")}/${escapeHtml(envelope.ticket)}: ${escapeHtml(envelope.subject)}</h3>
    <div class="fields">${fields}</div>
    ${renderEvents(envelope.events)}
  </article>`;
}

export function renderBoardHtml(input, options = {}) {
  const byColumn = new Map(BOARD_COLUMNS.map((column) => [column, []]));
  const envelopes = normalizeEnvelopes(input);
  for (const envelope of envelopes) {
    byColumn.get(resolveColumn(envelope).column).push(renderCard(envelope));
  }
  const columns = BOARD_COLUMNS.map((column) => `
    <section class="column" data-column="${escapeHtml(column)}">
      <h2><button class="column-toggle" type="button" aria-expanded="true">${escapeHtml(column)}</button></h2>
      <div class="cards">${byColumn.get(column).join("") || '<p class="empty">No cards</p>'}</div>
    </section>`).join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Task map board</title>
<style>
body{font-family:system-ui,sans-serif;margin:1rem;background:#f6f7f9;color:#1b1f24}
.board{display:grid;grid-template-columns:repeat(8,minmax(14rem,1fr));gap:.75rem;overflow-x:auto}
.column{background:#fff;border:1px solid #d7dce2;border-radius:.5rem;padding:.5rem}
.column h2{font-size:1rem;margin:0 0 .5rem}
.column-toggle{background:none;border:0;cursor:pointer;font:inherit;padding:0;text-align:left}
.card{background:#fafbfc;border:1px solid #ccd3da;border-radius:.4rem;margin-bottom:.5rem;padding:.5rem;transition:transform .15s ease}
.card:hover{transform:translateY(-2px)}
.field{display:grid;grid-template-columns:7rem 1fr;gap:.25rem;font-size:.8rem;overflow-wrap:anywhere}
.field span:first-child{font-weight:600}
.events ol{margin:0;padding-left:1.1rem}
.events dt{font-weight:600;font-size:.75rem}
.events dd{margin:0 0 .25rem .5rem;font-size:.75rem;overflow-wrap:anywhere}
.truncated{font-weight:600;color:#8a4b00}
@media (prefers-reduced-motion: reduce){*{animation:none!important;transition:none!important}}
</style>
</head>
<body>
<h1>Task map board</h1>
<label for="filter">Filter cards</label>
<input id="filter" type="search" placeholder="Filter cards">
<main class="board">${columns}</main>
<script>
(function () {
  var filter = document.getElementById("filter");
  var cards = Array.from(document.querySelectorAll(".card"));
  filter.addEventListener("input", function () {
    var needle = filter.value.trim().toLowerCase();
    cards.forEach(function (card) {
      card.hidden = needle !== "" && card.textContent.toLowerCase().indexOf(needle) === -1;
    });
  });
  Array.from(document.querySelectorAll(".column-toggle")).forEach(function (toggle) {
    toggle.addEventListener("click", function () {
      var list = toggle.closest(".column").querySelector(".cards");
      list.hidden = !list.hidden;
      toggle.setAttribute("aria-expanded", String(!list.hidden));
    });
  });
})();
</script>
</body>
</html>
`;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help") args.help = true;
    else if (argument === "--input" || argument === "--output") {
      const value = argv[++index];
      if (!value) throw new Error(`${argument} requires a path`);
      if (argument === "--input" && value === "-") {
        throw new Error("--input requires a file path; stdin is ignored");
      }
      args[argument.slice(2)] = value;
    } else throw new Error(`unknown argument ${argument}`);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write("usage: task-board.mjs --input envelope.json --output board.html\n");
    return;
  }
  if (!args.input) throw new Error("missing --input path");
  if (!args.output) throw new Error("missing --output path");
  const input = JSON.parse(readFileSync(args.input, "utf8"));
  writeFileSync(args.output, renderBoardHtml(input));
  const envelopes = normalizeEnvelopes(input);
  const counts = BOARD_COLUMNS.map((column) => `${column}=${envelopes.filter((envelope) => resolveColumn(envelope).column === column).length}`).join(" ");
  process.stdout.write(`${args.output}\n${counts}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
