import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { withLock } from "./lock.mjs";

export const GRAPH_VERSION = "repo-orchestrator/graph-supervisor/v1";
export const NODE_TYPES = Object.freeze([
  "run", "phase", "task", "agent", "worktree", "pr", "gate", "wait", "decision", "artifact",
]);
export const EDGE_TYPES = Object.freeze([
  "contains", "delegates", "runs-in", "checks", "waits-for", "reports", "retries", "produces",
]);
const NODE_STATUSES = new Set(["pending", "ready", "running", "waiting", "blocked", "paused", "completed", "failed", "closed"]);
const SATISFIED = new Set(["ready", "completed", "closed"]);
const BLOCKING = new Set(["blocked", "failed"]);
const RUN_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function object(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value;
}

function identifier(value, label) {
  if (typeof value !== "string" || !value || value.length > 128 || /[\u0000-\u001f]/.test(value)) {
    throw new TypeError(`${label} must be a non-empty bounded identifier`);
  }
  return value;
}

function normalizeBudget(input = {}) {
  object(input, "budget");
  const budget = {};
  for (const key of ["maxTransitions", "maxRetries", "maxTokens", "maxWallMs"]) {
    if (input[key] === undefined) continue;
    if (!Number.isSafeInteger(input[key]) || input[key] < 0) {
      throw new TypeError(`budget.${key} must be a non-negative safe integer`);
    }
    budget[key] = input[key];
  }
  return budget;
}

function normalizeNode(input) {
  object(input, "node");
  const node = clone(input);
  identifier(node.id, "node.id");
  if (!NODE_TYPES.includes(node.type)) throw new TypeError(`node.type must be one of ${NODE_TYPES.join(", ")}`);
  node.status ??= "pending";
  if (!NODE_STATUSES.has(node.status)) throw new TypeError(`invalid node status: ${node.status}`);
  return node;
}

function normalizeEdge(input, nodeIds) {
  object(input, "edge");
  const edge = clone(input);
  identifier(edge.id, "edge.id");
  if (!EDGE_TYPES.includes(edge.type)) throw new TypeError(`edge.type must be one of ${EDGE_TYPES.join(", ")}`);
  identifier(edge.from, "edge.from");
  identifier(edge.to, "edge.to");
  if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
    throw new TypeError(`edge endpoints must reference graph nodes: ${edge.id}`);
  }
  return edge;
}

function normalizeState(input) {
  object(input, "graph state");
  if (input.version !== GRAPH_VERSION) throw new TypeError(`graph version must be ${GRAPH_VERSION}`);
  identifier(input.run_id, "run_id");
  if (!Array.isArray(input.nodes) || !Array.isArray(input.edges)) throw new TypeError("graph nodes and edges must be arrays");
  const nodes = input.nodes.map(normalizeNode);
  const nodeIds = new Set();
  for (const node of nodes) {
    if (nodeIds.has(node.id)) throw new TypeError(`duplicate graph node: ${node.id}`);
    nodeIds.add(node.id);
  }
  const edges = input.edges.map((edge) => normalizeEdge(edge, nodeIds));
  const edgeIds = new Set();
  for (const edge of edges) {
    if (edgeIds.has(edge.id)) throw new TypeError(`duplicate graph edge: ${edge.id}`);
    edgeIds.add(edge.id);
  }
  const state = clone(input);
  state.budget = normalizeBudget(input.budget);
  state.nodes = nodes;
  state.edges = edges;
  state.paused = Boolean(input.paused);
  state.transition_count ??= 0;
  state.revision ??= 0;
  state.transitions ??= [];
  if (!Number.isSafeInteger(state.transition_count) || state.transition_count < 0) throw new TypeError("transition_count must be a non-negative safe integer");
  if (!Number.isSafeInteger(state.revision) || state.revision < 0) throw new TypeError("revision must be a non-negative safe integer");
  if (!Array.isArray(state.transitions)) throw new TypeError("transitions must be an array");
  return state;
}

export function normalizeGraphInput(input) {
  return normalizeState(input);
}

function graphStatus(value) {
  const status = String(value ?? "pending").toLowerCase();
  return ({
    assigned: "pending",
    pending: "pending",
    working: "running",
    development: "running",
    running: "running",
    ready: "ready",
    blocked: "blocked",
    failed: "failed",
    closed: "closed",
    completed: "completed",
  })[status] ?? "pending";
}

function sourceNodes(source, sourceName) {
  const records = Array.isArray(source) ? source : source?.nodes ?? [];
  return records.map((record) => {
    const value = record?.node && typeof record.node === "object" ? record.node : record;
    if (value?.type && NODE_TYPES.includes(value.type) && value.id) return { ...clone(value), source: sourceName };
    if (!value?.task) return null;
    return {
      id: `task:${value.task}`,
      type: "task",
      status: graphStatus(value.state ?? value.lifecycle),
      title: value.title ?? value.task,
      summary: typeof value.summary === "string" ? value.summary.slice(0, 512) : undefined,
      agent: value.agent,
      source: sourceName,
      updated_at: value.updated_at,
    };
  }).filter(Boolean);
}

function sourceEdges(source) {
  return (Array.isArray(source) ? [] : source?.edges ?? []).map(clone);
}

export function buildGraphState({ runId, budget, trajectory = [], mailbox = [], edges = [] }, options = {}) {
  const records = new Map();
  for (const node of sourceNodes(trajectory, "trajectory")) records.set(node.id, node);
  for (const node of sourceNodes(mailbox, "mailbox")) records.set(node.id, node);
  if (![...records.values()].some((node) => node.type === "run")) {
    records.set(`run:${runId}`, { id: `run:${runId}`, type: "run", status: "running", source: "derived" });
  }
  return createGraphState({
    runId,
    budget,
    nodes: [...records.values()],
    edges: [...sourceEdges(trajectory), ...sourceEdges(mailbox), ...clone(edges)],
  }, options);
}

export function createGraphState(specification, { now = new Date().toISOString() } = {}) {
  object(specification, "graph specification");
  const runId = specification.runId ?? specification.run_id;
  if (typeof runId !== "string" || !RUN_ID.test(runId)) throw new TypeError(`invalid run identifier: ${runId}`);
  const nodes = (specification.nodes ?? []).map(normalizeNode);
  const nodeIds = new Set(nodes.map((node) => node.id));
  if (nodeIds.size !== nodes.length) throw new TypeError("duplicate graph node");
  const edges = (specification.edges ?? []).map((edge) => normalizeEdge(edge, nodeIds));
  const edgeIds = new Set(edges.map((edge) => edge.id));
  if (edgeIds.size !== edges.length) throw new TypeError("duplicate graph edge");
  const state = {
    version: GRAPH_VERSION,
    run_id: runId,
    status: "running",
    budget: normalizeBudget(specification.budget),
    paused: false,
    transition_count: 0,
    revision: 0,
    created_at: now,
    updated_at: now,
    nodes,
    edges,
    transitions: [],
  };
  return normalizeState(state);
}

export function planGraph(input) {
  const state = normalizeState(input);
  const nodes = new Map(state.nodes.map((node) => [node.id, node]));
  const dependencies = new Map();
  for (const edge of state.edges) {
    if (edge.type !== "waits-for") continue;
    const list = dependencies.get(edge.to) ?? [];
    list.push(edge.from);
    dependencies.set(edge.to, list);
  }
  const ready = [];
  const blocked = [];
  const pending = [];
  for (const node of state.nodes) {
    if (node.status !== "pending") continue;
    const dependencyIds = dependencies.get(node.id) ?? [];
    const dependencyNodes = dependencyIds.map((id) => nodes.get(id));
    if (dependencyNodes.some((dependency) => BLOCKING.has(dependency.status))) blocked.push(node.id);
    else if (dependencyNodes.every((dependency) => SATISFIED.has(dependency.status))) ready.push(node.id);
    else pending.push(node.id);
  }
  return { ready, blocked, pending };
}

function nodeFor(state, nodeId) {
  identifier(nodeId, "action.nodeId");
  const node = state.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) throw new Error(`graph node not found: ${nodeId}`);
  return node;
}

function transitionAction(action) {
  return Object.fromEntries(Object.entries(action)
    .filter(([key]) => ["type", "nodeId", "status", "reason", "satisfied"].includes(key))
    .map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 512) : value]));
}

function budgetBlocked(state, now) {
  const next = clone(state);
  next.status = "blocked";
  next.paused = false;
  next.budget_reason = "budget-exhausted";
  next.updated_at = now;
  return next;
}

function setRunStatus(state) {
  if (state.paused || state.status === "blocked") return;
  const terminal = new Set(["completed", "closed", "failed"]);
  if (state.nodes.length > 0 && state.nodes.every((node) => terminal.has(node.status))) state.status = "completed";
  else state.status = "running";
}

function recordTransition(state, action, now, changes) {
  const next = clone(state);
  next.transition_count += 1;
  next.revision += 1;
  next.updated_at = now;
  next.transitions.push({
    index: next.transition_count,
    at: now,
    action: transitionAction(action),
    changes,
  });
  setRunStatus(next);
  return next;
}

export function stepGraphState(input, action, { now = new Date().toISOString() } = {}) {
  const state = normalizeState(input);
  object(action, "action");
  identifier(action.type, "action.type");
  if (state.paused && action.type !== "resume") return state;
  if (action.type !== "resume" && Number.isSafeInteger(state.budget.maxTransitions)
    && state.transition_count >= state.budget.maxTransitions) {
    return budgetBlocked(state, now);
  }

  if (action.type === "pause") {
    const next = clone(state);
    next.paused = true;
    next.status = "paused";
    next.pause_reason = typeof action.reason === "string" ? action.reason.slice(0, 512) : "human checkpoint";
    return recordTransition(next, action, now, [{ field: "status", from: state.status, to: "paused" }]);
  }
  if (action.type === "resume") {
    const next = clone(state);
    next.paused = false;
    next.pause_reason = undefined;
    next.status = "running";
    return recordTransition(next, action, now, [{ field: "status", from: state.status, to: "running" }]);
  }

  if (action.type === "advance") {
    const next = clone(state);
    const plan = planGraph(state);
    const changes = [];
    for (const nodeId of plan.ready) {
      const node = next.nodes.find((candidate) => candidate.id === nodeId);
      node.status = "ready";
      changes.push({ node_id: nodeId, from: "pending", to: "ready" });
    }
    for (const nodeId of plan.blocked) {
      const node = next.nodes.find((candidate) => candidate.id === nodeId);
      node.status = "blocked";
      node.blocked_reason = "dependency-blocked";
      changes.push({ node_id: nodeId, from: "pending", to: "blocked" });
    }
    return recordTransition(next, action, now, changes);
  }

  const node = nodeFor(state, action.nodeId);
  const next = clone(state);
  const nextNode = next.nodes.find((candidate) => candidate.id === node.id);
  let to = nextNode.status;
  if (action.type === "start") {
    if (node.status !== "ready") throw new Error(`node is not ready: ${node.id}`);
    to = "running";
  } else if (action.type === "complete") {
    if (!["running", "waiting", "ready"].includes(node.status)) throw new Error(`node cannot complete: ${node.id}`);
    to = action.status ?? "completed";
    if (!["completed", "closed"].includes(to)) throw new Error("complete status must be completed or closed");
  } else if (action.type === "wait") {
    if (!["pending", "ready", "running"].includes(node.status)) throw new Error(`node cannot wait: ${node.id}`);
    to = "waiting";
  } else if (action.type === "poll") {
    if (node.status !== "waiting") throw new Error(`node is not waiting: ${node.id}`);
    to = action.satisfied ? "completed" : "waiting";
  } else if (action.type === "retry") {
    if (!["failed", "blocked"].includes(node.status)) throw new Error(`node cannot retry: ${node.id}`);
    const retries = Number(node.retry_count ?? 0);
    if (Number.isSafeInteger(state.budget.maxRetries) && retries >= state.budget.maxRetries) {
      return budgetBlocked(state, now);
    }
    to = "pending";
    nextNode.retry_count = retries + 1;
  } else {
    throw new Error(`unsupported graph action: ${action.type}`);
  }
  nextNode.status = to;
  return recordTransition(next, action, now, [{ node_id: node.id, from: node.status, to }]);
}

export function projectHerdrState(input, liveAgents = []) {
  const state = normalizeState(input);
  const agents = Array.isArray(liveAgents) ? liveAgents : [];
  return state.nodes
    .filter((node) => node.type === "task" && typeof (node.agent ?? node.agent_id) === "string")
    .map((node) => {
      const agent = node.agent ?? node.agent_id;
      const herdr = agents.find((candidate) => (candidate.name ?? candidate.agent) === agent) ?? null;
      const lifecycle = ["ready", "running", "blocked", "failed", "closed"].includes(node.status)
        ? node.status
        : node.status === "completed" ? "closed" : "pending";
      return {
        node_id: node.id,
        agent,
        label: `[${node.status.toUpperCase()}] ${node.title ?? node.id}`,
        lifecycle,
        herdr: herdr ? clone(herdr) : null,
      };
    });
}

function graphFile(directory) {
  return join(directory, "graph.json");
}

export function loadGraphState(directory) {
  const file = graphFile(directory);
  if (!existsSync(file)) return null;
  return normalizeState(JSON.parse(readFileSync(file, "utf8")));
}

export function saveGraphState(directory, state) {
  const normalized = normalizeState(state);
  mkdirSync(directory, { recursive: true });
  const file = graphFile(directory);
  return withLock(file, () => {
    const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
    try {
      writeFileSync(temporary, `${JSON.stringify(normalized, null, 2)}\n`, { flag: "wx" });
      renameSync(temporary, file);
    } finally {
      if (existsSync(temporary)) unlinkSync(temporary);
    }
    if (normalized.transitions.length > 0) {
      const eventsFile = join(directory, "events.jsonl");
      const events = existsSync(eventsFile)
        ? readFileSync(eventsFile, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line))
        : [];
      const event = normalized.transitions.at(-1);
      if (!events.some((candidate) => candidate.index === event.index)) {
        appendFileSync(eventsFile, `${JSON.stringify(event)}\n`);
      }
    }
    return normalized;
  });
}

export const persistGraphState = saveGraphState;
