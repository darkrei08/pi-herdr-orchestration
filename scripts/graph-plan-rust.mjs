#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = resolve(root, "rust/orchestrator-core/Cargo.toml");
const binary = process.env.RUST_GRAPH_PLAN_BIN;
const PLAN_KEYS = Object.freeze({ READY: "ready", BLOCKED: "blocked", PENDING: "pending" });

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

function protocol(state) {
  if (!state || typeof state !== "object" || !Array.isArray(state.nodes) || !Array.isArray(state.edges)) {
    throw new TypeError("graph state must contain nodes and edges arrays");
  }
  const lines = [];
  for (const node of state.nodes) {
    if (!node || typeof node.id !== "string" || typeof node.status !== "string") {
      throw new TypeError("graph nodes require string id and status");
    }
    lines.push(`NODE\t${node.id}\t${node.status}`);
  }
  for (const edge of state.edges) {
    if (edge?.type !== "waits-for") continue;
    if (typeof edge.from !== "string" || typeof edge.to !== "string") {
      throw new TypeError("waits-for edges require string endpoints");
    }
    lines.push(`WAIT\t${edge.from}\t${edge.to}`);
  }
  lines.push("END", "");
  return lines.join("\n");
}

function run(input) {
  if (!existsSync(manifest)) throw new Error(`Rust manifest not found: ${manifest}`);
  const command = binary && existsSync(binary)
    ? { file: binary, args: [], cwd: root }
    : { file: "cargo", args: ["run", "--quiet", "--manifest-path", manifest, "--bin", "graph-plan"], cwd: root };
  const result = spawnSync(command.file, command.args, {
    cwd: command.cwd,
    input,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    stdio: ["pipe", "pipe", "pipe"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.trim() || `Rust graph planner exited with ${result.status}`);
  return result.stdout;
}

function parse(output) {
  const result = { ready: [], blocked: [], pending: [] };
  for (const line of output.split(/\r?\n/).filter(Boolean)) {
    const [kind, id, ...rest] = line.split("\t");
    const key = PLAN_KEYS[kind];
    if (rest.length > 0 || key === undefined) {
      throw new Error("Rust graph planner returned an invalid record");
    }
    if (!id) throw new Error("Rust graph planner returned an empty node id");
    result[key].push(id);
  }
  return result;
}

try {
  const input = readFileSync(0, "utf8");
  const state = JSON.parse(input);
  process.stdout.write(`${JSON.stringify(parse(run(protocol(state))))}\n`);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
