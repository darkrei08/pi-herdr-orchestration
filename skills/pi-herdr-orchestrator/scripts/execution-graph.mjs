// Read-only adapter for PiWorkflow trajectory snapshots and orchestrator mailbox evidence.
// PiWorkflow owns execution; the mailbox owns supervisory evidence. This module only projects
// those existing records into a bounded, versioned report and never writes or controls state.

export const EXECUTION_GRAPH_SCHEMA = "repo-orchestrator/execution-graph/v1";
export const EXECUTION_REPORT_SCHEMA = "repo-orchestrator/execution-report/v1";

const NODE_KINDS = new Set(["master", "chief", "workflow", "subworkflow", "worker"]);
const EVENT_LIMIT = 256;

const record = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const text = (value) => typeof value === "string" && value.length > 0 ? value : undefined;
const array = (value) => Array.isArray(value) ? value : [];
const unique = (values) => [...new Set(values.filter((value) => value !== undefined && value !== null))];

function sourcesFor(source) {
  return source === undefined ? [] : [source];
}

function trajectoryRuns(input) {
  const source = input?.trajectory ?? input?.runtime ?? input;
  if (Array.isArray(source)) return source.map((run) => ({ run: record(run), publisher: undefined }));
  const root = record(source);
  if (Array.isArray(root.publishers)) {
    return root.publishers.flatMap((publisher) => array(record(publisher).runs).map((run) => ({ run: record(run), publisher })));
  }
  if (Array.isArray(root.runs)) return root.runs.map((run) => ({ run: record(run), publisher: undefined }));
  return root.run ? [{ run: root, publisher: undefined }] : [];
}

function runRecord(value) {
  const candidate = record(value);
  return candidate.run && typeof candidate.run === "object" ? record(candidate.run) : candidate;
}

function trajectorySubagents(input) {
  const source = input?.trajectory ?? input?.runtime ?? input;
  const publishers = Array.isArray(record(source).publishers) ? record(source).publishers : [];
  return publishers.flatMap((publisher) => array(record(publisher).subagents).map((subagent) => ({ subagent: record(subagent), publisher })));
}

function mailboxEntries(input) {
  const source = input?.mailbox ?? input?.reports ?? [];
  if (Array.isArray(source)) return source.map(record);
  const root = record(source);
  if (Array.isArray(root.entries)) return root.entries.map(record);
  if (Array.isArray(root.tasks)) return root.tasks.map(record);
  return Object.values(root).filter((value) => record(value).task).map(record);
}

function explicitActors(input) {
  const actors = [];
  if (input?.master) actors.push({ kind: "master", value: input.master });
  for (const chief of array(input?.chiefs ?? input?.supervisors)) actors.push({ kind: "chief", value: chief });
  return actors.map(({ kind, value }) => ({ kind, value: record(value) }));
}

function iso(value) {
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value).toISOString();
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
  return undefined;
}

function lastAttempt(agent) {
  return array(agent.attemptDetails).at(-1) ?? {};
}

function sessionId(agent) {
  const attempt = lastAttempt(agent);
  return text(agent.sessionId) ?? text(record(attempt.session).sessionId) ?? text(record(agent.session).sessionId);
}

function worktree(agent, run) {
  const attempt = lastAttempt(agent);
  const path = text(record(agent.worktree).path) ?? text(record(attempt.setup).cwd);
  const branch = text(record(agent.worktree).branch) ?? text(agent.branch);
  if (!path && !branch) return undefined;
  return { ...(path ? { path } : {}), ...(branch ? { branch } : {}) };
}

function evidenceFor(entry = {}) {
  const checks = array(entry.checks).map((check) => {
    const value = record(check);
    return { name: text(value.name) ?? "unknown", status: text(value.status) ?? "unknown" };
  });
  const commits = unique([
    ...array(entry.commits),
    entry.commit,
  ].map(text));
  const artifacts = unique([
    ...array(entry.artifacts),
    entry.evidence_ref,
    entry.evidenceRef,
  ].map(text));
  return {
    refs: artifacts,
    checks,
    commits,
    artifacts: unique(array(entry.artifacts).map(text)),
  };
}

function stateFor(value) {
  return text(value.state) ?? text(value.lifecycle) ?? "unknown";
}

function addSource(node, source) {
  node.sources = unique([...array(node.sources), source]);
}

function mergeEvidence(node, entry) {
  const evidence = evidenceFor(entry);
  node.evidence = {
    refs: unique([...array(node.evidence?.refs), ...evidence.refs]),
    checks: [...array(node.evidence?.checks), ...evidence.checks.filter((check) => !array(node.evidence?.checks).some((known) => known.name === check.name && known.status === check.status))],
    commits: unique([...array(node.evidence?.commits), ...evidence.commits]),
    artifacts: unique([...array(node.evidence?.artifacts), ...evidence.artifacts]),
  };
}

function nodeBase(id, kind, value, source) {
  const node = {
    id,
    kind,
    label: text(value.label) ?? text(value.name) ?? id,
    state: stateFor(value),
    sources: sourcesFor(source),
    evidence: { refs: [], checks: [], commits: [], artifacts: [] },
  };
  const parentId = text(value.parentId);
  const taskId = text(value.taskId) ?? text(value.task);
  const session = text(value.sessionId) ?? text(value.session);
  const repository = text(value.repository) ?? text(value.cwd);
  if (parentId) node.parentRef = parentId;
  if (taskId) node.taskId = taskId;
  if (text(value.lifecycle)) node.lifecycle = value.lifecycle;
  if (session) node.sessionId = session;
  if (repository) node.repository = repository;
  if (value.startedAt !== undefined) node.startedAt = value.startedAt;
  if (value.finishedAt !== undefined) node.finishedAt = value.finishedAt;
  if (value.updated_at !== undefined) node.updatedAt = iso(value.updated_at) ?? value.updated_at;
  return node;
}

function addNode(nodes, node) {
  const existing = nodes.get(node.id);
  if (!existing) {
    nodes.set(node.id, node);
    return node;
  }
  if (node.label && existing.label === existing.id) existing.label = node.label;
  if (node.state !== "unknown") existing.state = node.state;
  for (const source of array(node.sources)) addSource(existing, source);
  if (node.taskId) existing.taskId = node.taskId;
  if (node.lifecycle) existing.lifecycle = node.lifecycle;
  if (node.sessionId) existing.sessionId = node.sessionId;
  if (node.repository) existing.repository = node.repository;
  if (node.worktree) existing.worktree = node.worktree;
  if (node.parentRef) existing.parentRef = node.parentRef;
  if (node.startedAt !== undefined) existing.startedAt = node.startedAt;
  if (node.finishedAt !== undefined) existing.finishedAt = node.finishedAt;
  if (node.updatedAt !== undefined) existing.updatedAt = node.updatedAt;
  mergeEvidence(existing, node.evidence ?? {});
  return existing;
}

function addEdge(edges, from, to, kind) {
  if (typeof from !== "string" || typeof to !== "string" || from === to) return;
  const edge = { from, to, kind };
  if (!edges.some((known) => known.from === from && known.to === to && known.kind === kind)) edges.push(edge);
}

function referenceId(reference, nodes) {
  if (!reference) return undefined;
  if (nodes.has(reference)) return reference;
  for (const prefix of ["master:", "chief:", "worker:", "workflow:"]) if (nodes.has(`${prefix}${reference}`)) return `${prefix}${reference}`;
  return undefined;
}

function addRelationships(value, nodeId, edges, nodes) {
  const parent = referenceId(text(value.parentRef) ?? text(value.parentId) ?? text(value.parent), nodes);
  if (parent) addEdge(edges, nodeId, parent, "parent");
  for (const dependency of array(value.depends_on ?? value.dependencies ?? value.dependsOn)) {
    const dependencyName = text(dependency);
    const target = referenceId(dependencyName, nodes) ?? (dependencyName ? `worker:mailbox:${dependencyName}` : undefined);
    if (!target) continue;
    if (!nodes.has(target)) addNode(nodes, nodeBase(target, "worker", { label: dependencyName, taskId: dependencyName, state: "unknown" }, "mailbox"));
    addEdge(edges, nodeId, target, "depends_on");
  }
}

function eventFrom(value, source, fallbackType, ids = {}) {
  const input = record(value);
  const timestamp = input.timestamp ?? input.at ?? input.updated_at ?? input.asked_at;
  return {
    type: text(input.type) ?? fallbackType,
    source,
    ...(ids.runId ? { runId: ids.runId } : {}),
    ...(ids.taskId ? { taskId: ids.taskId } : {}),
    ...(timestamp !== undefined ? { timestamp: typeof timestamp === "number" ? timestamp : iso(timestamp) ?? timestamp } : {}),
    ...(text(input.state) ? { state: input.state } : {}),
    ...(text(input.evidence_ref) ? { evidenceRef: input.evidence_ref } : {}),
  };
}

function eventOrder(event, index) {
  const timestamp = typeof event.timestamp === "number" ? event.timestamp : Date.parse(event.timestamp ?? "");
  return { event, timestamp: Number.isFinite(timestamp) ? timestamp : 0, index };
}

export function buildExecutionGraph(input = {}) {
  input ??= {};
  const nodes = new Map();
  const edges = [];
  const events = [];
  const runs = trajectoryRuns(input);
  const mail = mailboxEntries(input);

  for (const { kind, value } of explicitActors(input)) {
    const id = `${kind}:${text(value.id) ?? text(value.name) ?? kind}`;
    const node = nodeBase(id, kind, value, "supervision");
    addNode(nodes, node);
    if (value.parentId) node.parentRef = value.parentId;
    addRelationships(value, id, edges, nodes);
  }

  for (const { run: rawRun } of runs) {
    const run = runRecord(rawRun);
    const runId = text(run.id);
    if (!runId) continue;
    const workflowId = `workflow:${runId}`;
    const workflow = nodeBase(workflowId, run.parentRunId ? "subworkflow" : "workflow", {
      id: runId,
      name: run.workflowName,
      label: run.workflowName,
      state: run.state,
      sessionId: run.sessionId,
      cwd: run.cwd,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      parentId: run.parentRunId ? `workflow:${run.parentRunId}` : undefined,
    }, "trajectory");
    workflow.runId = runId;
    workflow.workflowName = text(run.workflowName) ?? runId;
    if (run.retry?.sourceRunId) workflow.retryOf = `workflow:${run.retry.sourceRunId}`;
    addNode(nodes, workflow);
    if (run.parentRunId) addEdge(edges, workflowId, `workflow:${run.parentRunId}`, "parent");
    if (run.retry?.sourceRunId) addEdge(edges, workflowId, `workflow:${run.retry.sourceRunId}`, "retry_of");
    for (const event of array(run.events)) events.push(eventFrom(event, "trajectory", "workflow:event", { runId }));

    for (const rawAgent of array(run.agents)) {
      const agent = record(rawAgent);
      const agentId = text(agent.id);
      if (!agentId) continue;
      const workerId = `worker:${runId}:${agentId}`;
      const attempt = lastAttempt(agent);
      const worker = nodeBase(workerId, "worker", {
        ...agent,
        label: agent.label ?? agent.name,
        sessionId: sessionId(agent),
        repository: run.cwd,
        parentId: agent.parentId ? `worker:${runId}:${agent.parentId}` : workflowId,
      }, "trajectory");
      worker.runId = runId;
      worker.agentId = agentId;
      if (agent.name) worker.agentName = agent.name;
      worker.path = agent.path;
      if (agent.worktreeOwner) worker.worktreeOwner = agent.worktreeOwner;
      const tree = worktree(agent, run);
      if (tree) worker.worktree = tree;
      if (agent.resultPath) worker.evidence.artifacts.push(agent.resultPath);
      if (agent.output?.path) worker.evidence.artifacts.push(agent.output.path);
      addNode(nodes, worker);
      addEdge(edges, workerId, agent.parentId ? `worker:${runId}:${agent.parentId}` : workflowId, "parent");
      for (const detail of array(agent.attemptDetails)) {
        if (detail.error?.code) events.push(eventFrom({ type: "worker:error", ...detail, state: agent.state }, "trajectory", "worker:error", { runId }));
      }
    }
  }

  for (const { subagent } of trajectorySubagents(input)) {
    const id = text(subagent.id);
    if (!id) continue;
    const workerId = `worker:subagent:${id}`;
    const worker = nodeBase(workerId, "worker", { ...subagent, sessionId: subagent.sessionId, repository: subagent.cwd }, "trajectory");
    worker.subagentId = id;
    if (subagent.worktree) worker.worktree = subagent.worktree;
    addNode(nodes, worker);
  }

  for (const entry of mail) {
    const taskId = text(entry.task) ?? text(entry.id);
    if (!taskId) continue;
    const agent = text(entry.agent);
    const candidate = [...nodes.values()].find((node) => node.kind === "worker" && (node.agentId === agent || node.agentName === agent || node.label === agent || node.sessionId === agent));
    const nodeId = candidate?.id ?? `worker:mailbox:${taskId}`;
    const node = addNode(nodes, nodeBase(nodeId, "worker", { label: agent ?? taskId, state: entry.state, lifecycle: entry.lifecycle, taskId, sessionId: entry.sessionId, repository: entry.repository ?? entry.cwd, updated_at: entry.updated_at }, "mailbox"));
    node.taskId = taskId;
    addSource(node, "mailbox");
    mergeEvidence(node, entry);
    if (entry.branch) node.worktree = { ...(node.worktree ?? {}), branch: entry.branch };
    addRelationships({ ...entry, parentRef: entry.parent_task ?? entry.parentTask }, nodeId, edges, nodes);
    events.push(eventFrom(entry, "mailbox", "mailbox:report", { taskId }));
    if (candidate && text(entry.run)) addEdge(edges, nodeId, `workflow:${entry.run}`, "reports");
  }

  const maxEvents = Number.isInteger(input.maxEvents) && input.maxEvents >= 0 ? input.maxEvents : EVENT_LIMIT;
  const boundedEvents = maxEvents === 0 ? [] : events.map(eventOrder).sort((left, right) => left.timestamp - right.timestamp || left.index - right.index).slice(-maxEvents).map(({ event }) => event);
  const nodeList = [...nodes.values()].map((node) => {
    node.evidence.refs = unique(node.evidence.refs);
    node.evidence.artifacts = unique(node.evidence.artifacts);
    return node;
  }).sort((left, right) => left.id.localeCompare(right.id));
  edges.sort((left, right) => `${left.from}:${left.kind}:${left.to}`.localeCompare(`${right.from}:${right.kind}:${right.to}`));
  return {
    schema: EXECUTION_GRAPH_SCHEMA,
    version: 1,
    readOnly: true,
    generatedAt: iso(input.now) ?? new Date().toISOString(),
    nodes: nodeList,
    edges,
    events: boundedEvents,
  };
}

export function buildExecutionReport(input = {}) {
  const graph = buildExecutionGraph(input ?? {});
  const states = {};
  for (const node of graph.nodes) states[node.state] = (states[node.state] ?? 0) + 1;
  return {
    schema: EXECUTION_REPORT_SCHEMA,
    version: 1,
    readOnly: true,
    generatedAt: graph.generatedAt,
    graph,
    summary: {
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      events: graph.events.length,
      states,
    },
  };
}

export function serializeExecutionReport(report) {
  return JSON.stringify(report);
}
