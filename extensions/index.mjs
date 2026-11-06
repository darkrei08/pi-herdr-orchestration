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
  report,
  ask,
  reply,
} from "../skills/pi-herdr-orchestrator/scripts/mailbox.mjs";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export default function (pi) {
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
        notify: { type: "string", description: "Distinct Herdr agent name to nudge; never the current Pi session or sender" }
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
          evidence: e.evidence_ref ?? "-"
        };
      });

      if (params.json) {
        return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
      }

      if (rows.length === 0) {
        return { content: [{ type: "text", text: "No active or recorded tasks in this run." }] };
      }

      const header = "Task       | Agent      | Herdr   | State       | Lifecycle   | Seq | Age(m) | Flag        | Liveness    | Question ID                         | Summary";
      const sep    = "-----------+------------+---------+-------------+-------------+-----+--------+-------------+-------------+-------------------------------------+-----------------------------";
      const lines = rows.map((r) =>
        `${(r.task || "").padEnd(10)} | ${(r.agent || "-").padEnd(10)} | ${(r.herdr || "-").padEnd(7)} | ${(r.state || "-").padEnd(11)} | ${(r.lifecycle || "-").padEnd(11)} | ${(String(r.seq) || "1").padStart(3)} | ${String(r.age_min).padStart(6)} | ${(r.flag || "OK").padEnd(11)} | ${(r.liveness || "-").padEnd(11)} | ${(r.question_id || "-").padEnd(35)} | ${r.summary} (${r.reason || "no reason"})`
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

  // 5. Tool: orch_evidence
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
