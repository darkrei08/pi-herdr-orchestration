#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const file = process.env.FLOW_SOURCES_FILE ?? join(root, "odd", "skill-sources", "sources.json");
const allowedKinds = new Set(["local", "github", "site", "registry"]);
const allowedTrust = new Set(["primary", "secondary", "unsure"]);
const cadenceDays = new Map([
  ["daily", 1],
  ["weekly", 7],
  ["monthly", 30],
]);
const requiredPoolFields = ["schema", "updated", "sources"];
const requiredSourceFields = ["id", "kind", "url", "look_for", "trust", "cadence", "enabled", "last_checked", "notes"];
const isoDate = /^\d{4}-\d{2}-\d{2}$/;

function isIsoDate(value) {
  if (typeof value !== "string" || !isoDate.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function rowLabel(index, source) {
  return `sources[${index}]${source?.id ? ` (${source.id})` : ""}`;
}

function addRequiredFieldErrors(value, fields, label, errors) {
  for (const field of fields) {
    if (!(field in (value ?? {}))) errors.push(`${label}.${field}: required field is missing`);
  }
}

let data;
try {
  data = JSON.parse(readFileSync(file, "utf8"));
} catch (error) {
  console.error(`Invalid source pool: ${error.message}`);
  process.exit(1);
}

const errors = [];
addRequiredFieldErrors(data, requiredPoolFields, "pool", errors);
if (data?.schema !== "pi-herdr-orchestration/skill-sources/v1") {
  errors.push(`pool.schema: unknown value ${JSON.stringify(data?.schema)}`);
}
if (!isIsoDate(data?.updated)) errors.push("pool.updated: must be an ISO date (YYYY-MM-DD)");
if (!Array.isArray(data?.sources)) errors.push("pool.sources: must be an array");
const sources = Array.isArray(data?.sources) ? data.sources : [];

const ids = new Set();
for (const [index, source] of sources.entries()) {
  const label = rowLabel(index, source);
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    errors.push(`${label}: must be an object`);
    continue;
  }
  addRequiredFieldErrors(source, requiredSourceFields, label, errors);
  if (typeof source.id !== "string" || source.id.length === 0) errors.push(`${label}.id: must be a non-empty string`);
  else if (ids.has(source.id)) errors.push(`${label}.id: duplicate value ${JSON.stringify(source.id)}`);
  else ids.add(source.id);
  if (!allowedKinds.has(source.kind)) errors.push(`${label}.kind: unknown value ${JSON.stringify(source.kind)}`);
  if (typeof source.url !== "string" || source.url.length === 0) errors.push(`${label}.url: must be a non-empty string`);
  if (typeof source.look_for !== "string" || source.look_for.length === 0) errors.push(`${label}.look_for: must be a non-empty string`);
  if (!allowedTrust.has(source.trust)) errors.push(`${label}.trust: unknown value ${JSON.stringify(source.trust)}`);
  if (!cadenceDays.has(source.cadence) && source.cadence !== "on demand") errors.push(`${label}.cadence: unknown value ${JSON.stringify(source.cadence)}`);
  if (typeof source.enabled !== "boolean") errors.push(`${label}.enabled: must be boolean`);
  if (source.last_checked !== null && !isIsoDate(source.last_checked)) errors.push(`${label}.last_checked: must be null or an ISO date (YYYY-MM-DD)`);
  if (typeof source.notes !== "string" || source.notes.length === 0) errors.push(`${label}.notes: must be a non-empty string`);
}

if (errors.length) {
  console.error(errors.map((error) => `ERROR ${error}`).join("\n"));
  process.exit(1);
}

const today = new Date();
const stale = sources.filter((source) => {
  if (!source.enabled || source.last_checked === null || source.cadence === "on demand") return false;
  const ageDays = (today - new Date(`${source.last_checked}T00:00:00Z`)) / 86400000;
  return ageDays > cadenceDays.get(source.cadence);
});

console.log(`Source pool valid: ${sources.length} sources`);
if (stale.length === 0) {
  console.log("Stale sources: none");
} else {
  console.log(`Stale sources: ${stale.length}`);
  for (const source of stale) console.log(`- ${source.id}: last_checked=${source.last_checked}, cadence=${source.cadence}`);
}
