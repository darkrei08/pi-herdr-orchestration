// Pi Native Extension for Pi Herdr Orchestration
// Registers model-facing orchestration tools and a /orch interactive command.
// Avoids spawning shell sub-processes and context pollution.
import {
  STATES,
  LIFECYCLE_STATES,
  deriveLifecycle,
  classify,
  liveAgents,
  runDir,
  storeEvidence,
  readEvidence,
  report,
  ask,
  reply,
} from "../skills/pi-herdr-orchestrator/scripts/mailbox.mjs";
import {
  acknowledgeDirective,
  createDirective,
  recordDecision,
  recordParentReceipt,
  recordWorkerState,
  reassignDirective,
} from "../skills/pi-herdr-orchestrator/scripts/directives.mjs";
import { planSupervision } from "../skills/pi-herdr-orchestrator/scripts/supervisor.mjs";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export default function (pi) {
  const directiveOptions = (params) => ({
    ...params,
    dir: runDir({ run: params.run ?? process.env.ORCH_RUN }),
  });

  // 1. Tool: orch_report
  pi.registerTool({
    name: "orch_report",
    label: "Orchestrator Report",
    description: "Report task status to the shared orchestration mailbox with atomic writes, optional evidence storage, and derived lifecycle metadata.",
    parameters: {
      type: "object",
      properties: {
        task: { type: "string", description: "Task identifier, e.g. 'I#84' or 'PR#127'" },
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
        evidence: { type: "string", description: "Large log, test output, or diff to save to disk as a semantic ref" },
        run: { type: "string", description: "Run identifier (defaults to ORCH_RUN env)" },
        agent: { type: "string", description: "Herdr agent name" },
        notify: { type: "string", description: "Master agent name to nudge via Herdr" }
      },
      required: ["task", "state"]
    },
    async execute(_id, params) {
      const entry = report({ ...params, silent: true, nonBlocking: true });
      const out = `${entry.task} ${entry.state} (seq=${entry.seq})${entry.evidence_ref ? ` [evidence ${entry.evidence_ref}]` : ""}`;
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
        const flag = live ? classify(e, agent, Date.now(), staleMs) : "NO_HERDR";
        const age = Math.round((Date.now() - Date.parse(e.updated_at)) / 60_000);
        return {
          task: e.task,
          agent: e.agent,
          herdr: agent?.agent_status ?? "-",
          state: e.state,
          lifecycle: e.lifecycle ?? deriveLifecycle(e.state),
          seq: e.seq,
          age_min: age,
          flag,
          summary: e.summary.slice(0, 60),
          evidence: e.evidence_ref ?? "-"
        };
      });

      if (params.json) {
        return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
      }

      if (rows.length === 0) {
        return { content: [{ type: "text", text: "No active or recorded tasks in this run." }] };
      }

      const header = "Task       | Agent      | Herdr   | State       | Lifecycle   | Seq | Age(m) | Flag        | Summary";
      const sep    = "-----------+------------+---------+-------------+-------------+-----+--------+-------------+-----------------------------";
      const lines = rows.map((r) =>
        `${(r.task || "").padEnd(10)} | ${(r.agent || "-").padEnd(10)} | ${(r.herdr || "-").padEnd(7)} | ${(r.state || "-").padEnd(11)} | ${(r.lifecycle || "-").padEnd(11)} | ${(String(r.seq) || "1").padStart(3)} | ${String(r.age_min).padStart(6)} | ${(r.flag || "OK").padEnd(11)} | ${r.summary}`
      );
      const text = [header, sep, ...lines].join("\n");
      return { content: [{ type: "text", text }] };
    }
  });

  // 3. Tool: orch_ask
  pi.registerTool({
    name: "orch_ask",
    label: "Orchestrator Ask Master",
    description: "Ask a blocking question to the master orchestrator session without exiting or looping.",
    parameters: {
      type: "object",
      properties: {
        task: { type: "string", description: "Task identifier" },
        question: { type: "string", description: "The specific question or decision needed" },
        run: { type: "string", description: "Run identifier" },
        notify: { type: "string", description: "Master agent name" }
      },
      required: ["task", "question"]
    },
    async execute(_id, params) {
      ask({ ...params, silent: true, nonBlocking: true });
      return { content: [{ type: "text", text: `Question submitted for ${params.task}. State marked BLOCKED awaiting master reply.` }] };
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
        answer: { type: "string", description: "Decision or instructions for the worker" },
        run: { type: "string", description: "Run identifier" }
      },
      required: ["task", "answer"]
    },
    async execute(_id, params) {
      reply({ ...params, silent: true, nonBlocking: true });
      return { content: [{ type: "text", text: `Reply delivered to worker for task ${params.task}.` }] };
    }
  });

  // 5. Tool: orch_assign
  pi.registerTool({
    name: "orch_assign",
    label: "Orchestrator Assign Directive",
    description: "Create a durable Master-to-Chief or Chief-to-Worker directive with explicit authority, worktree, paths, dependencies, and retry budget.",
    parameters: {
      type: "object",
      properties: {
        run: { type: "string", description: "Run identifier" },
        assignment_id: { type: "string" },
        parent: { type: "string" },
        supervisor: { type: "string" },
        worker: { type: "string" },
        task: { type: "string" },
        branch: { type: "string" },
        worktree: { type: "string" },
        allowed_paths: { type: "array", items: { type: "string" } },
        dependencies: { type: "array", items: { type: "string" } },
        max_retries: { type: "integer", minimum: 0 }
      },
      required: ["assignment_id", "parent", "supervisor", "worker", "task", "branch", "worktree", "allowed_paths"]
    },
    async execute(_id, params) {
      const entry = createDirective(directiveOptions(params));
      return { content: [{ type: "text", text: JSON.stringify({ assignment_id: entry.assignment_id, state: entry.state, directive_digest: entry.directive_digest }) }] };
    }
  });

  // 6. Tool: orch_directive_ack
  pi.registerTool({
    name: "orch_directive_ack",
    label: "Orchestrator Acknowledge Directive",
    description: "Acknowledge a directive using the exact assigned worker identity.",
    parameters: {
      type: "object",
      properties: { run: { type: "string" }, assignment_id: { type: "string" }, actor: { type: "string" } },
      required: ["assignment_id", "actor"]
    },
    async execute(_id, params) {
      const entry = acknowledgeDirective(directiveOptions(params));
      return { content: [{ type: "text", text: `${entry.assignment_id} ${entry.state} seq=${entry.sequence}` }] };
    }
  });

  // 7. Tool: orch_directive_state
  pi.registerTool({
    name: "orch_directive_state",
    label: "Orchestrator Worker State",
    description: "Record a worker state using the directive's exact authority binding.",
    parameters: {
      type: "object",
      properties: {
        run: { type: "string" }, assignment_id: { type: "string" }, actor: { type: "string" },
        state: { type: "string", enum: ["WORKING", "WAITING_PARENT", "READY", "BLOCKED", "FAILED"] },
        result_id: { type: "string" }, summary: { type: "string" }
      },
      required: ["assignment_id", "actor", "state"]
    },
    async execute(_id, params) {
      const entry = recordWorkerState(directiveOptions(params));
      return { content: [{ type: "text", text: `${entry.assignment_id} ${entry.state} seq=${entry.sequence}` }] };
    }
  });

  // 8. Tool: orch_directive_decide
  pi.registerTool({
    name: "orch_directive_decide",
    label: "Orchestrator Directive Decision",
    description: "Record a parent decision. Only the directive parent may accept, continue, escalate, or stop it.",
    parameters: {
      type: "object",
      properties: {
        run: { type: "string" }, assignment_id: { type: "string" }, actor: { type: "string" },
        decision: { type: "string", enum: ["continue", "accept", "escalate", "stop"] },
        result_id: { type: "string" }, reason: { type: "string" }
      },
      required: ["assignment_id", "actor", "decision"]
    },
    async execute(_id, params) {
      const entry = recordDecision(directiveOptions(params));
      return { content: [{ type: "text", text: `${entry.assignment_id} ${entry.state} decision=${entry.decision.value}` }] };
    }
  });

  // 9. Tool: orch_directive_reassign
  pi.registerTool({
    name: "orch_directive_reassign",
    label: "Orchestrator Reassign Directive",
    description: "Reassign a directive to a replacement worker within its bounded retry budget.",
    parameters: {
      type: "object",
      properties: {
        run: { type: "string" }, assignment_id: { type: "string" }, actor: { type: "string" },
        worker: { type: "string" }, reason: { type: "string" }
      },
      required: ["assignment_id", "actor", "worker", "reason"]
    },
    async execute(_id, params) {
      const entry = reassignDirective(directiveOptions(params));
      return { content: [{ type: "text", text: `${entry.assignment_id} ${entry.state} worker=${entry.worker} attempt=${entry.retry.attempt}` }] };
    }
  });

  // 10. Tool: orch_directive_receipt
  pi.registerTool({
    name: "orch_directive_receipt",
    label: "Orchestrator Parent Receipt",
    description: "Close an accepted directive only after the parent records a matching result receipt.",
    parameters: {
      type: "object",
      properties: { run: { type: "string" }, assignment_id: { type: "string" }, actor: { type: "string" }, result_id: { type: "string" } },
      required: ["assignment_id", "actor", "result_id"]
    },
    async execute(_id, params) {
      const entry = recordParentReceipt(directiveOptions(params));
      return { content: [{ type: "text", text: `${entry.assignment_id} ${entry.state} receipt=${entry.parent_receipt.receipt_id}` }] };
    }
  });

  // 11. Tool: orch_supervise
  pi.registerTool({
    name: "orch_supervise",
    label: "Orchestrator Supervision Plan",
    description: "Produce a deterministic supervision plan from durable directives, reports, Herdr liveness, and Git evidence. This tool never auto-replies or closes work.",
    parameters: {
      type: "object",
      properties: {
        snapshot: { type: "object" },
        stale_min: { type: "number" },
        max_nudges: { type: "integer", minimum: 0 }
      },
      required: ["snapshot"]
    },
    async execute(_id, params) {
      const options = {
        staleMs: Number(params.stale_min ?? 10) * 60_000,
        maxNudges: Number(params.max_nudges ?? 2),
      };
      return { content: [{ type: "text", text: JSON.stringify(planSupervision(params.snapshot, options)) }] };
    }
  });

  // 12. Tool: orch_evidence
  pi.registerTool({
    name: "orch_evidence",
    label: "Orchestrator Store or Read Evidence",
    description: "Save long output/logs to an on-disk deduplicated file and return a compact semantic reference (ref:sha256), or read previously stored evidence without copying large payloads into prompts.",
    parameters: {
      type: "object",
      properties: {
        content: { type: "string", description: "Raw content to store (omit if reading ref)" },
        ref: { type: "string", description: "Evidence reference to read, e.g. 'ref:sha256:...'" },
        run: { type: "string", description: "Run identifier" }
      }
    },
    async execute(_id, params) {
      const run = params.run ?? process.env.ORCH_RUN;
      const dir = runDir({ run });
      if (params.ref) {
        const text = readEvidence(dir, params.ref);
        return { content: [{ type: "text", text }] };
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
    pi.registerCommand({
      name: "orch",
      description: "Display current multi-agent orchestration status",
      async execute(_args, ctx) {
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
