// Pi Native Extension for Pi Herdr Orchestration
// Registers model-facing orchestration tools and a /orch interactive command.
// Avoids spawning shell sub-processes and context pollution.
import {
  STATES,
  LIFECYCLE_STATES,
  deriveLifecycle,
  classifyLiveness,
  liveAgents,
  runDir,
  storeEvidence,
  readEvidence,
  paneLabel,
  renamePane,
  report,
  usageSummary,
  ask,
  reply,
} from "../skills/pi-herdr-orchestrator/scripts/mailbox.mjs";
import { buildExecutionReport } from "../skills/pi-herdr-orchestrator/scripts/execution-graph.mjs";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  loadGraphState,
  persistGraphState,
  planGraph,
  projectHerdrState,
  stepGraphState,
} from "../skills/pi-herdr-orchestrator/scripts/graph-supervisor.mjs";

export default function (pi, deps = {}) {
  // 1. Tool: orch_report
  pi.registerTool({
    name: "orch_report",
    label: "Orchestrator Report",
    description: "Report task status to the shared orchestration mailbox with atomic writes, optional evidence storage, and derived lifecycle metadata.",
    parameters: {
      type: "object",
      properties: {
        task: { type: "string", description: "Task identifier, e.g. 'I#84' or 'PR#127'" },
        id: { type: "string", description: "Stable message identifier for replay-safe delivery" },
        state: {
          type: "string",
          enum: STATES,
          description: "Task lifecycle state (legacy uppercase: ASSIGNED, WORKING, READY, DEVELOPMENT, BLOCKED, FAILED, CLOSED)"
        },
        lifecycle: {
          type: "string",
          enum: LIFECYCLE_STATES,
          description: "Optional derived lifecycle state (pending, running, ready, blocked, failed, closed). Derived automatically if omitted."
        },
        summary: { type: "string", description: "One-line factual summary of progress or outcome" },
        phase: { type: "string", description: "Lifecycle phase (e.g. PLAN, IMPLEMENT, VERIFY)" },
        branch: { type: "string", description: "Working Git branch" },
        checks: {
          type: "array",
          items: { type: "string" },
          description: "Validation checks, format 'name=PASS|FAIL|BLOCKED|NOT RUN'"
        },
        required_checks: {
          type: "array",
          items: { type: "string" },
          description: "Check names that must be explicitly reported as PASS for READY or evidence-bound CLOSED"
        },
        evidence: { type: "string", description: "Large log, test output, or diff to save to disk as a semantic ref" },
        candidate: { type: "string", description: "Exact immutable candidate identity; Git candidates must be full commit IDs" },
        pane: { type: "string", description: "Herdr pane identity for liveness correlation" },
        session: { type: "string", description: "Pi session identity for liveness correlation" },
        evidence_binding: {
          type: "object",
          description: "Task/run/candidate-bound GGA or Gentle review evidence and Engram observation reference; passing review refs are JSON attestations checked against immutable candidate hashes",
          properties: {
            task: { type: "string" },
            run: { type: "string" },
            candidate: { type: "string" },
            review: {
              type: "object",
              properties: {
                task: { type: "string" },
                run: { type: "string" },
                candidate: { type: "string" },
                provider: { type: "string", enum: ["gga", "gentle"] },
                status: { type: "string", enum: ["PASS", "FAIL", "BLOCKED", "NOT RUN", "UNVERIFIED"] },
                ref: { type: "string" },
                version: { type: "string" },
                config_digest: { type: "string" },
                output_digest: { type: "string" },
                file_hashes: { type: "object", additionalProperties: { type: "string" } },
                deleted_files: { type: "array", items: { type: "object" } },
                reason: { type: "string" }
              }
            },
            memory: {
              type: "object",
              properties: {
                task: { type: "string" },
                run: { type: "string" },
                candidate: { type: "string" },
                provider: { type: "string", const: "engram" },
                status: { type: "string", enum: ["PERSISTED", "BLOCKED", "NOT RUN", "UNVERIFIED"] },
                ref: { type: "string" },
                receipt: { type: "string", description: "Stored provider receipt proving the observation reference and identity" },
                reason: { type: "string" }
              }
            }
          }
        },
        run: { type: "string", description: "Run identifier (defaults to ORCH_RUN env)" },
        agent: { type: "string", description: "Herdr agent name" },
        usage: {
          type: "object",
          description: "Usage deltas since the previous report; omit any metric the runtime does not expose so it stays 'unknown' rather than zero",
          properties: {
            agent_launches: { type: "number", minimum: 0, description: "Child agent launches since the previous report" },
            tokens: { type: "number", minimum: 0, description: "Tokens consumed since the previous report" },
            cost_usd: { type: "number", minimum: 0, description: "Provider cost in USD since the previous report" }
          }
        },
        budget: {
          type: "object",
          description: "Per-run ceiling for this report; defaults to ORCH_RUN_BUDGET as JSON. Any dimension over its limit blocks the transition",
          properties: {
            agent_launches: { type: "number", minimum: 0 },
            wall_ms: { type: "number", minimum: 0 },
            tokens: { type: "number", minimum: 0 },
            cost_usd: { type: "number", minimum: 0 }
          }
        },
        notify: { type: "string", description: "Distinct Herdr agent name to nudge; never the current Pi session or sender" }
      },
      required: ["task", "state"]
    },
    async execute(_id, params) {
      const entry = report({ ...params, silent: true, nonBlocking: true });
      // Talking label: presentation only, derived from the persisted task and
      // state, never from caller free text. A skip is a warning, not a failure.
      renamePane(entry.identity?.pane ?? params.pane ?? process.env.HERDR_PANE_ID, paneLabel(entry.task, entry.state), deps);
      const out = `${entry.task} ${entry.state} (seq=${entry.seq})${entry.evidence_ref ? ` [evidence ${entry.evidence_ref}]` : ""}${entry.budget_block ? ` [BUDGET ${entry.budget_block.dimension} ${entry.budget_block.observed}>${entry.budget_block.limit}]` : ""} [${usageSummary(entry.usage, entry.budget_block)}]`;
      return { content: [{ type: "text", text: out }] };
    }
  });

  // 2. Tool: orch_status
  pi.registerTool({
    name: "orch_status",
    label: "Orchestrator Status",
    description: "Read the orchestrator supervision dashboard, joining mailbox states with live Herdr agent status.",
    parameters: {
      type: "object",
      properties: {
        run: { type: "string", description: "Run identifier" },
        stale_min: { type: "number", description: "Minutes before an agent is considered stale (default 10)" },
        json: { type: "boolean", description: "Return raw JSON array instead of text table" }
      }
    },
    async execute(_id, params) {
      const run = params.run ?? process.env.ORCH_RUN;
      const dir = runDir({ run });
      const staleMs = Number(params.stale_min ?? 10) * 60_000;
      const live = liveAgents();
      const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")) : [];
      const rows = files.map((f) => {
        const e = JSON.parse(readFileSync(join(dir, f), "utf8"));
        const agent = live?.get(e.agent);
        const assessment = live
          ? classifyLiveness(e, agent, Date.now(), staleMs)
          : { flag: "NO_HERDR", state: "unverified", reason: "Herdr liveness unavailable; mailbox and Git evidence decide" };
        const age = Math.round((Date.now() - Date.parse(e.updated_at)) / 60_000);
        return {
          task: e.task,
          agent: e.agent,
          herdr: agent?.agent_status ?? "-",
          state: e.state,
          lifecycle: e.lifecycle ?? deriveLifecycle(e.state),
          seq: e.seq,
          age_min: age,
          flag: assessment.flag,
          liveness: assessment.state,
          reason: assessment.reason,
          summary: e.summary.slice(0, 60),
          question_id: e.pending_ask?.message_id ?? null,
          evidence: e.evidence_ref ?? "-",
          run_budget: e.run_budget ?? null,
          budget_block: e.budget_block ?? null,
          usage: usageSummary(e.usage, e.budget_block),
        };
      });

      if (params.json) {
        return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
      }

      if (rows.length === 0) {
        return { content: [{ type: "text", text: "No active or recorded tasks in this run." }] };
      }

      const header = "Task       | Agent      | Herdr   | State       | Lifecycle   | Seq | Age(m) | Flag        | Liveness    | Question ID                         | Usage                                                    | Summary";
      const sep    = "-----------+------------+---------+-------------+-------------+-----+--------+-------------+-------------+-------------------------------------+----------------------------------------------------------+-----------------------------";
      const lines = rows.map((r) =>
        `${(r.task || "").padEnd(10)} | ${(r.agent || "-").padEnd(10)} | ${(r.herdr || "-").padEnd(7)} | ${(r.state || "-").padEnd(11)} | ${(r.lifecycle || "-").padEnd(11)} | ${(String(r.seq) || "1").padStart(3)} | ${String(r.age_min).padStart(6)} | ${(r.flag || "OK").padEnd(11)} | ${(r.liveness || "-").padEnd(11)} | ${(r.question_id || "-").padEnd(35)} | ${(r.usage || "-").padEnd(56)} | ${r.summary} (${r.reason || "no reason"})`
      );
      const text = [header, sep, ...lines].join("\n");
      return { content: [{ type: "text", text }] };
    }
  });

  // 3. Tool: orch_graph_status
  pi.registerTool({
    name: "orch_graph_status",
    label: "Orchestrator Graph Status",
    description: "Read a bounded persisted graph supervisor snapshot and its deterministic plan. Herdr is presentation-only.",
    parameters: {
      type: "object",
      properties: {
        run: { type: "string", description: "Run identifier" },
        max_nodes: { type: "integer", minimum: 1, maximum: 1000, description: "Maximum node rows in the response (default 100)" },
      },
    },
    async execute(_id, params) {
      const directory = join(runDir({ run: params.run ?? process.env.ORCH_RUN }), "graph");
      const state = loadGraphState(directory);
      if (!state) return { content: [{ type: "text", text: "No persisted graph for this run." }] };
      const maxNodes = params.max_nodes ?? 100;
      const snapshot = {
        version: state.version,
        run_id: state.run_id,
        status: state.status,
        paused: state.paused,
        revision: state.revision,
        transition_count: state.transition_count,
        budget: state.budget,
        plan: planGraph(state),
        nodes: state.nodes.slice(0, maxNodes),
        node_count: state.nodes.length,
        nodes_truncated: state.nodes.length > maxNodes,
        projection: projectHerdrState(state, liveAgents()),
      };
      return { content: [{ type: "text", text: JSON.stringify(snapshot) }] };
    },
  });

  // 4. Tool: orch_graph_step
  pi.registerTool({
    name: "orch_graph_step",
    label: "Advance Orchestrator Graph",
    description: "Apply one bounded deterministic graph action and persist the transition; does not invoke a model or publish work.",
    parameters: {
      type: "object",
      properties: {
        run: { type: "string", description: "Run identifier" },
        action: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["advance", "start", "complete", "wait", "poll", "pause", "resume", "fail", "retry"] },
            nodeId: { type: "string" },
            // complete only; fail always records the failed status itself.
            status: { type: "string", enum: ["completed", "closed"] },
            // fail and pause; fail defaults to "unreported" when omitted.
            reason: { type: "string", maxLength: 512 },
            satisfied: { type: "boolean" },
          },
          required: ["type"],
          additionalProperties: false,
        },
      },
      required: ["action"],
    },
    async execute(_id, params) {
      const directory = join(runDir({ run: params.run ?? process.env.ORCH_RUN }), "graph");
      const state = loadGraphState(directory);
      if (!state) throw new Error("No persisted graph for this run.");
      const next = stepGraphState(state, params.action);
      persistGraphState(directory, next);
      return { content: [{ type: "text", text: JSON.stringify({ run_id: next.run_id, status: next.status, revision: next.revision, transition_count: next.transition_count, budget_reason: next.budget_reason ?? null }) }] };
    },
  });

  // 5. Tool: orch_ask
  pi.registerTool({
    name: "orch_ask",
    label: "Orchestrator Ask Master",
    description: "Ask a blocking question to the master orchestrator session without exiting or looping.",
    parameters: {
      type: "object",
      properties: {
        task: { type: "string", description: "Task identifier" },
        id: { type: "string", description: "Stable message identifier for replay-safe delivery" },
        question: { type: "string", description: "The specific question or decision needed" },
        run: { type: "string", description: "Run identifier" },
        notify: { type: "string", description: "Distinct Herdr master agent name; never the current Pi session or sender" }
      },
      required: ["task", "question"]
    },
    async execute(_id, params) {
      const entry = ask({ ...params, silent: true, nonBlocking: true });
      return { content: [{ type: "text", text: `Question submitted for ${params.task}. question_id=${entry.pending_ask?.message_id ?? "-"}. State marked BLOCKED awaiting master reply.` }] };
    }
  });

  // 4. Tool: orch_reply
  pi.registerTool({
    name: "orch_reply",
    label: "Orchestrator Reply to Worker",
    description: "Reply to a worker's pending question and transition its state back to WORKING.",
    parameters: {
      type: "object",
      properties: {
        task: { type: "string", description: "Task identifier" },
        id: { type: "string", description: "Stable message identifier for replay-safe delivery" },
        question_id: { type: "string", description: "Exact message_id returned by orch_ask for the question being answered" },
        answer: { type: "string", description: "Decision or instructions for the worker" },
        run: { type: "string", description: "Run identifier" }
      },
      required: ["task", "question_id", "answer"]
    },
    async execute(_id, params) {
      reply({ ...params, silent: true, nonBlocking: true });
      return { content: [{ type: "text", text: `Reply delivered to worker for task ${params.task}.` }] };
    }
  });

  // 5. Tool: orch_execution_graph
  pi.registerTool({
    name: "orch_execution_graph",
    label: "Execution Graph Report",
    description: "Project supplied PiWorkflow trajectory data and orchestrator mailbox evidence into a bounded, versioned, read-only execution report.",
    parameters: {
      type: "object",
      properties: {
        trajectory: { type: "object", description: "PiWorkflow trajectory publisher or run snapshot" },
        mailbox: { type: "array", items: { type: "object" }, description: "Orchestrator mailbox report entries" },
        master: { type: "object", description: "Explicit master identity metadata" },
        chiefs: { type: "array", items: { type: "object" }, description: "Explicit chief identity metadata" },
        now: { type: "string", description: "Optional report timestamp" },
        maxEvents: { type: "number", description: "Maximum events retained in the report" }
      }
    },
    async execute(_id, params) {
      const result = buildExecutionReport(params);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  });

  // 6. Tool: orch_evidence
  pi.registerTool({
    name: "orch_evidence",
    label: "Orchestrator Store or Read Evidence",
    description: "Save long output/logs to an on-disk deduplicated file and return a compact semantic reference (ref:sha256), or read previously stored evidence without copying large payloads into prompts.",
    parameters: {
      type: "object",
      properties: {
        content: { type: "string", description: "Raw content to store (omit if reading ref)" },
        ref: { type: "string", description: "Evidence reference to read, e.g. 'ref:sha256:...'" },
        run: { type: "string", description: "Run identifier" },
        offset: { type: "integer", minimum: 0, description: "Read offset in characters (default 0)" },
        limit: { type: "integer", minimum: 1, maximum: 65536, description: "Maximum characters to return when reading (default 4096)" }
      }
    },
    async execute(_id, params) {
      const run = params.run ?? process.env.ORCH_RUN;
      const dir = runDir({ run });
      if (params.ref) {
        const text = readEvidence(dir, params.ref);
        const offset = params.offset ?? 0;
        const limit = params.limit ?? 4096;
        const preview = text.slice(offset, offset + limit);
        const end = offset + preview.length;
        const suffix = end < text.length ? `\n[truncated; read offset ${end} to continue]` : "";
        return { content: [{ type: "text", text: preview + suffix }] };
      }
      if (!params.content) {
        throw new Error("Either 'content' to store or 'ref' to read is required");
      }
      const ref = storeEvidence(dir, params.content);
      return { content: [{ type: "text", text: `Stored evidence: ${ref}` }] };
    }
  });

  // 6. Interactive Command: /orch
  if (typeof pi.registerCommand === "function") {
    pi.registerCommand("orch", {
      description: "Display current multi-agent orchestration status",
      async handler(_args, ctx) {
        const run = process.env.ORCH_RUN ?? "default";
        try {
          const dir = runDir({ run });
          const live = liveAgents();
          const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")) : [];
          if (files.length === 0) {
            ctx.ui?.notify?.("No orchestration tasks in current run", "info");
            return;
          }
          const rows = files.map((f) => {
            const e = JSON.parse(readFileSync(join(dir, f), "utf8"));
            const agent = live?.get(e.agent);
            const lifecycle = e.lifecycle ?? deriveLifecycle(e.state);
            return `${e.task}: ${e.state} (${lifecycle}) [${agent?.agent_status ?? "-"}] - ${e.summary.slice(0, 40)}`;
          });
          ctx.ui?.notify?.(rows.join("\n"), "info");
        } catch (err) {
          ctx.ui?.notify?.(`Orchestrator error: ${err.message}`, "error");
        }
      }
    });
  }
}
