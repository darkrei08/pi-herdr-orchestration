import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { withLock } from "./lock.mjs";

export const DIRECTIVE_STATES = Object.freeze([
  "ASSIGNED",
  "ACKNOWLEDGED",
  "WORKING",
  "WAITING_PARENT",
  "READY",
  "BLOCKED",
  "FAILED",
  "REASSIGNED",
  "ACCEPTED",
  "CLOSED",
]);

const WORKER_STATES = new Set(["WORKING", "WAITING_PARENT", "READY", "BLOCKED", "FAILED"]);
const DECISIONS = new Set(["continue", "accept", "escalate", "stop"]);

const directivesDir = (dir) => join(dir, "directives");
const fileFor = (dir, assignmentId) => join(directivesDir(dir), `${assignmentId}.json`);
const eventFile = (dir) => join(directivesDir(dir), "events.jsonl");

function requireString(value, name) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${name} is required`);
  return value.trim();
}

function requireArray(value, name) {
  if (!Array.isArray(value)) throw new Error(`${name} must be an array`);
  return [...value];
}

function timestamp(value) {
  return value ?? new Date().toISOString();
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function authority(record, actor, expected) {
  if (actor !== record[expected]) throw new Error("directive authority mismatch");
}

function readFile(dir, assignmentId) {
  const file = fileFor(dir, assignmentId);
  if (!existsSync(file)) throw new Error(`directive not found: ${assignmentId}`);
  return JSON.parse(readFileSync(file, "utf8"));
}

function appendEvent(dir, event) {
  const file = eventFile(dir);
  withLock(file, () => {
    appendFileSync(file, `${JSON.stringify(event)}\n`);
  });
}

function writeRecord(dir, record) {
  const file = fileFor(dir, record.assignment_id);
  mkdirSync(directivesDir(dir), { recursive: true });
  withLock(file, () => {
    writeFileSync(`${file}.tmp`, `${JSON.stringify(record, null, 2)}\n`);
    renameSync(`${file}.tmp`, file);
  });
  appendEvent(dir, {
    kind: record.kind,
    assignment_id: record.assignment_id,
    state: record.state,
    sequence: record.sequence,
    timestamp: record.updated_at,
  });
  return record;
}

function mutate(dir, assignmentId, mutateRecord) {
  const current = readFile(dir, assignmentId);
  const next = mutateRecord({ ...current });
  if (!DIRECTIVE_STATES.includes(next.state)) throw new Error(`invalid directive state: ${next.state}`);
  next.sequence = current.sequence + 1;
  next.updated_at = timestamp();
  return writeRecord(dir, next);
}

export function createDirective(input) {
  const dir = requireString(input.dir, "dir");
  const assignment_id = requireString(input.assignment_id, "assignment_id");
  const record = {
    v: "repo-orchestrator/v1",
    kind: "directive",
    assignment_id,
    run: requireString(input.run, "run"),
    parent: requireString(input.parent, "parent"),
    supervisor: requireString(input.supervisor, "supervisor"),
    worker: requireString(input.worker, "worker"),
    task: requireString(input.task, "task"),
    branch: requireString(input.branch, "branch"),
    worktree: requireString(input.worktree, "worktree"),
    allowed_paths: requireArray(input.allowed_paths, "allowed_paths"),
    dependencies: requireArray(input.dependencies ?? [], "dependencies"),
    retry: { attempt: 0, max: Number.isInteger(input.max_retries) && input.max_retries >= 0 ? input.max_retries : 2 },
    state: "ASSIGNED",
    sequence: 1,
    nudge_count: 0,
    decision: null,
    result_id: null,
    parent_receipt: null,
    created_at: timestamp(input.created_at),
    updated_at: timestamp(input.created_at),
  };
  if (record.allowed_paths.length === 0) throw new Error("allowed_paths must not be empty");
  if (existsSync(fileFor(dir, assignment_id))) throw new Error(`directive already exists: ${assignment_id}`);
  record.directive_digest = digest({
    assignment_id: record.assignment_id,
    run: record.run,
    parent: record.parent,
    supervisor: record.supervisor,
    worker: record.worker,
    task: record.task,
    branch: record.branch,
    worktree: record.worktree,
    allowed_paths: record.allowed_paths,
    dependencies: record.dependencies,
    retry: record.retry,
  });
  return writeRecord(dir, record);
}

export function readDirective(dir, assignmentId) {
  return readFile(requireString(dir, "dir"), requireString(assignmentId, "assignment_id"));
}

export function listDirectives(dir) {
  const directory = directivesDir(requireString(dir, "dir"));
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => JSON.parse(readFileSync(join(directory, name), "utf8")));
}

export function acknowledgeDirective(input) {
  const dir = requireString(input.dir, "dir");
  const assignmentId = requireString(input.assignment_id, "assignment_id");
  const actor = requireString(input.actor, "actor");
  return mutate(dir, assignmentId, (record) => {
    authority(record, actor, "worker");
    if (!["ASSIGNED", "REASSIGNED"].includes(record.state)) throw new Error(`cannot acknowledge directive in state ${record.state}`);
    record.state = "ACKNOWLEDGED";
    record.acknowledged_at = timestamp(input.at);
    return record;
  });
}

export function recordWorkerState(input) {
  const dir = requireString(input.dir, "dir");
  const assignmentId = requireString(input.assignment_id, "assignment_id");
  const actor = requireString(input.actor, "actor");
  const state = requireString(input.state, "state").toUpperCase();
  if (!WORKER_STATES.has(state)) throw new Error(`invalid worker state: ${state}`);
  return mutate(dir, assignmentId, (record) => {
    authority(record, actor, "worker");
    if (!["ACKNOWLEDGED", "WORKING", "WAITING_PARENT", "REASSIGNED", "BLOCKED"].includes(record.state)) {
      throw new Error(`cannot record worker state from ${record.state}`);
    }
    if (state === "READY" && !input.result_id) throw new Error("result_id is required for READY");
    record.state = state;
    record.result_id = input.result_id ?? record.result_id;
    record.worker_summary = input.summary ?? record.worker_summary ?? null;
    return record;
  });
}

export function recordDecision(input) {
  const dir = requireString(input.dir, "dir");
  const assignmentId = requireString(input.assignment_id, "assignment_id");
  const actor = requireString(input.actor, "actor");
  const decision = requireString(input.decision, "decision");
  if (!DECISIONS.has(decision)) throw new Error(`invalid directive decision: ${decision}`);
  return mutate(dir, assignmentId, (record) => {
    authority(record, actor, "parent");
    if (decision === "accept") {
      if (record.state !== "READY") throw new Error(`cannot accept directive in state ${record.state}`);
      if (!input.result_id || input.result_id !== record.result_id) throw new Error("result_id does not match directive");
      record.state = "ACCEPTED";
    } else if (decision === "continue") {
      if (["CLOSED", "ACCEPTED"].includes(record.state)) throw new Error(`cannot continue directive in state ${record.state}`);
      record.state = "WORKING";
    } else {
      record.state = "BLOCKED";
    }
    record.decision = { value: decision, reason: input.reason ?? null, result_id: input.result_id ?? null, at: timestamp(input.at) };
    return record;
  });
}

export function recordParentReceipt(input) {
  const dir = requireString(input.dir, "dir");
  const assignmentId = requireString(input.assignment_id, "assignment_id");
  const actor = requireString(input.actor, "actor");
  const resultId = requireString(input.result_id, "result_id");
  return mutate(dir, assignmentId, (record) => {
    authority(record, actor, "parent");
    if (record.state !== "ACCEPTED") throw new Error(`cannot close directive in state ${record.state}`);
    if (record.result_id !== resultId) throw new Error("result_id does not match directive");
    record.parent_receipt = {
      receipt_id: digest({ assignment_id: record.assignment_id, result_id: resultId, sequence: record.sequence }),
      result_id: resultId,
      parent: actor,
      at: timestamp(input.at),
    };
    record.state = "CLOSED";
    return record;
  });
}

export function reassignDirective(input) {
  const dir = requireString(input.dir, "dir");
  const assignmentId = requireString(input.assignment_id, "assignment_id");
  const actor = requireString(input.actor, "actor");
  const worker = requireString(input.worker, "worker");
  return mutate(dir, assignmentId, (record) => {
    authority(record, actor, "parent");
    if (record.state === "CLOSED") throw new Error("cannot reassign a closed directive");
    if (worker === record.worker) throw new Error("replacement worker must differ");
    if (record.retry.attempt >= record.retry.max) throw new Error("retry budget exhausted");
    record.previous_worker = record.worker;
    record.worker = worker;
    record.retry = { ...record.retry, attempt: record.retry.attempt + 1 };
    record.state = "REASSIGNED";
    record.decision = { value: "reassign", reason: input.reason ?? null, at: timestamp(input.at) };
    record.result_id = null;
    record.parent_receipt = null;
    record.acknowledged_at = null;
    return record;
  });
}
