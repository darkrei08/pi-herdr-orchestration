#!/usr/bin/env node
import { readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { option } from "./cli-options.mjs";

export const DEFAULT_ROSTER_ROOT = join(homedir(), ".pi", "agent", "agents");
export const ROSTER_MODES = ["task", "background"];
export const ROSTER_THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];

const TOOL_NAME = /^[A-Za-z0-9_.:-]+$/;

function unquote(value) {
  const trimmed = value.trim();
  const quoted = (trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"));
  return quoted && trimmed.length >= 2 ? trimmed.slice(1, -1) : trimmed;
}

function inlineList(value) {
  return value.slice(1, -1).split(",").map(unquote).filter((item) => item.length > 0);
}

// Just enough YAML for Agent frontmatter: `key: scalar`, `key: [a, b]` and
// `key:` followed by `- item` lines. Values are strings or string arrays.
function parseFrontmatter(source) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(source);
  if (!match) return { data: {}, body: source.trim() };
  const data = {};
  let listKey;
  for (const raw of match[1].split(/\r?\n/)) {
    const item = /^\s*-\s+(.*)$/.exec(raw);
    if (item && listKey !== undefined) {
      data[listKey].push(unquote(item[1]));
      continue;
    }
    const pair = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(raw);
    if (!pair) continue;
    const [, key, value] = pair;
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      data[key] = [];
      listKey = key;
      continue;
    }
    listKey = undefined;
    data[key] = trimmed.startsWith("[") && trimmed.endsWith("]") ? inlineList(trimmed) : unquote(trimmed);
  }
  return { data, body: match[2].trim() };
}

function scalar(value) {
  return typeof value === "string" ? value.trim() : undefined;
}

function inspectDefinition({ path, source }) {
  if (typeof path !== "string" || path.trim() === "") {
    return { problems: [{ path: null, field: "path", error: "definition path is required" }] };
  }
  if (typeof source !== "string") {
    return { problems: [{ path, field: "source", error: "definition source is unavailable" }] };
  }

  const problems = [];
  const fail = (field, error) => problems.push({ path, field, error });
  const { data, body } = parseFrontmatter(source);

  if (body.length === 0) fail("instructions", "no instructions after the frontmatter");

  // Pi derives a missing name from the definition filename, so this mirrors discovery.
  const name = scalar(data.name) || basename(path).replace(/\.md$/i, "");

  const tools = [];
  const declared = data.tools;
  const tokens = Array.isArray(declared) ? declared : scalar(declared)?.split(",") ?? [];
  for (const token of tokens) {
    const tool = token.trim();
    if (tool.length === 0) continue;
    if (TOOL_NAME.test(tool)) tools.push(tool);
    else fail("tools", `invalid tool name: ${tool}`);
  }

  const mode = scalar(data.subagent_mode) ?? scalar(data.mode);
  if (mode !== undefined && !ROSTER_MODES.includes(mode.toLowerCase())) {
    fail("mode", `mode "${mode}" is not one of ${ROSTER_MODES.join(", ")}`);
  }

  const thinking = scalar(data.thinking) ?? scalar(data.effort) ?? scalar(data.thinking_level);
  if (thinking !== undefined && !ROSTER_THINKING_LEVELS.includes(thinking.toLowerCase())) {
    fail("thinking", `thinking "${thinking}" is not one of ${ROSTER_THINKING_LEVELS.join(", ")}`);
  }

  return { name, tools, problems };
}

// Validates a roster result read-only. Any rejected or unreadable definition makes the
// whole roster unusable: a malformed roster authorizes no Agent and never a simulation.
export function inspectAgentRoster({ definitions = [], errors = [] } = {}) {
  const problems = [];
  const usableAgents = [];
  if (!Array.isArray(definitions)) {
    return {
      state: "malformed",
      verdict: "blocked",
      usableAgents: [],
      problems: [{ path: null, field: "definitions", error: "definitions must be an array" }],
    };
  }

  for (const error of Array.isArray(errors) ? errors : []) {
    const path = typeof error?.path === "string" && error.path.length > 0 ? error.path : null;
    const message = typeof error?.error === "string" && error.error.length > 0 ? error.error : "unreadable definition";
    problems.push({ path, field: "definition", error: message });
  }

  for (const definition of definitions) {
    const inspected = inspectDefinition(definition ?? {});
    if (inspected.problems.length > 0) problems.push(...inspected.problems);
    else usableAgents.push({ name: inspected.name, path: definition.path, tools: inspected.tools });
  }

  const seen = new Map();
  for (const agent of usableAgents) {
    const first = seen.get(agent.name);
    if (first !== undefined) problems.push({ path: agent.path, field: "name", error: `duplicate Agent name: ${agent.name} (also ${first})` });
    else seen.set(agent.name, agent.path);
  }

  if (problems.length > 0) return { state: "malformed", verdict: "blocked", usableAgents: [], problems };
  if (definitions.length === 0) {
    return {
      state: "unavailable",
      verdict: "blocked",
      usableAgents: [],
      problems: [{ path: null, field: "roster", error: "roster reports no Agent definitions" }],
    };
  }
  usableAgents.sort((left, right) => left.name.localeCompare(right.name));
  return { state: "healthy", verdict: "usable", usableAgents, problems: [] };
}

export function readAgentRoster({ root = DEFAULT_ROSTER_ROOT, readdir = readdirSync, readFile = readFileSync } = {}) {
  let entries;
  try {
    entries = readdir(root);
  } catch (error) {
    return {
      state: "unavailable",
      verdict: "blocked",
      usableAgents: [],
      problems: [{ path: root, field: "root", error: `definition directory unavailable: ${error.message}` }],
    };
  }

  const definitions = [];
  const errors = [];
  const files = entries.filter((entry) => typeof entry === "string" && entry.toLowerCase().endsWith(".md")).sort();
  for (const file of files) {
    const path = join(root, file);
    try {
      definitions.push({ path, source: readFile(path, "utf8") });
    } catch (error) {
      errors.push({ path, error: `unreadable definition: ${error.message}` });
    }
  }
  return inspectAgentRoster({ definitions, errors });
}

export function assertUsableRoster(report) {
  if (report.verdict !== "usable") {
    const detail = report.problems
      .map(({ path, field, error }) => `${path ?? "<roster>"}: ${field}: ${error}`)
      .join("; ");
    throw new Error(`Agent roster is not usable (${report.state}): ${detail}. Do not simulate delegation from a roster that does not validate.`);
  }
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = resolve(option("root", DEFAULT_ROSTER_ROOT));
  const report = readAgentRoster({ root });
  process.stdout.write(`${JSON.stringify({ root, ...report }, null, 2)}\n`);
  process.exitCode = report.verdict === "usable" ? 0 : 1;
}
