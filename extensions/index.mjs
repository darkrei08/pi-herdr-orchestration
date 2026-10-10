// Pi Native Extension for Pi Herdr Orchestration
// Registers model-facing orchestration tools and a /orch interactive command.
// Avoids spawning shell sub-processes and context pollution.
import {
  STATES,
  classify,
  fileFor,
  liveAgents,
  runDir,
  storeEvidence,
} from "../skills/pi-herdr-orchestrator/scripts/mailbox.mjs";
import { withLock } from "../skills/pi-herdr-orchestrator/scripts/lock.mjs";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const CHECKS = new Set(["PASS", "FAIL", "BLOCKED", "NOT RUN"]);

export default function (pi) {
  // 1. Tool: orch_report
  pi.registerTool({
    name: "orch_report",
    label: "Orchestrator Report",
    description: "Report task status to the shared orchestration mailbox with atomic writes and optional evidence storage.",
    parameters: {
      type: "object",
      properties: {
        task: { type: "string", description: "Task identifier, e.g. 'I#84' or 'PR#127'" },
        state: {
          type: "string",
          enum: STATES,
          description: "Task lifecycle state"
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
      const run = params.run ?? process.env.ORCH_RUN;
      const dir = runDir({ run });
      mkdirSync(dir, { recursive: true });
      const file = join(dir, fileFor(params.task));

      let evidenceRef = null;
      if (params.evidence) {
        evidenceRef = storeEvidence(dir, params.evidence);
      }

      for (const c of params.checks ?? []) {
        const val = c.split("=").slice(1).join("=");
        if (!CHECKS.has(val)) throw new Error(`Invalid check status: ${c}`);
      }

      const now = new Date().toISOString();
      let entry = null;

      withLock(file, () => {
        let prev = {};
        try { prev = JSON.parse(readFileSync(file, "utf8")); } catch { /* first write */ }
        entry = {
          v: "repo-orchestrator/v1",
          kind: params.state === "ASSIGNED" || params.state === "WORKING" ? "progress" : "result",
          run,
          task: params.task,
          agent: params.agent ?? process.env.ORCH_AGENT ?? prev.agent ?? null,
          seq: (prev.seq ?? 0) + 1,
          state: params.state,
          phase: params.phase ?? prev.phase ?? null,
          branch: params.branch ?? prev.branch ?? null,
          summary: params.summary ?? "",
          checks: (params.checks ?? []).map((c) => ({ name: c.split("=")[0], status: c.split("=").slice(1).join("=") })),
          evidence_ref: evidenceRef ?? prev.evidence_ref ?? null,
          pending_ask: prev.pending_ask ?? null,
          created_at: prev.created_at ?? now,
          updated_at: now,
        };
        writeFileSync(`${file}.tmp`, `${JSON.stringify(entry, null, 2)}\n`);
        renameSync(`${file}.tmp`, file);
        appendFileSync(join(dir, "events.jsonl"), `${JSON.stringify({ ...entry, checks: entry.checks.length })}\n`);
      });

      const master = params.notify ?? process.env.ORCH_MASTER;
      if (master) {
        const msg = `[REPORT ${entry.task} ${entry.state}] ${entry.summary.slice(0, 160)} (run ${entry.run})`;
        spawnSync("herdr", ["agent", "prompt", master, msg]);
      }

      const out = `${entry.task} ${entry.state} (seq=${entry.seq})${evidenceRef ? ` [evidence ${evidenceRef}]` : ""}`;
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

      const header = "Task       | Agent      | Herdr   | State       | Seq | Age(m) | Flag        | Summary";
      const sep    = "-----------+------------+---------+-------------+-----+--------+-------------+-----------------------------";
      const lines = rows.map((r) =>
        `${(r.task || "").padEnd(10)} | ${(r.agent || "-").padEnd(10)} | ${(r.herdr || "-").padEnd(7)} | ${(r.state || "-").padEnd(11)} | ${(String(r.seq) || "1").padStart(3)} | ${String(r.age_min).padStart(6)} | ${(r.flag || "OK").padEnd(11)} | ${r.summary}`
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
      const run = params.run ?? process.env.ORCH_RUN;
      const dir = runDir({ run });
      mkdirSync(dir, { recursive: true });
      const file = join(dir, fileFor(params.task));
      const now = new Date().toISOString();

      withLock(file, () => {
        let prev = {};
        try { prev = JSON.parse(readFileSync(file, "utf8")); } catch { /* first write */ }
        const entry = {
          ...prev,
          v: "repo-orchestrator/v1",
          run,
          task: params.task,
          agent: params.agent ?? process.env.ORCH_AGENT ?? prev.agent ?? null,
          state: "BLOCKED",
          seq: (prev.seq ?? 0) + 1,
          pending_ask: { question: params.question, asked_at: now },
          summary: `[QUESTION] ${params.question}`,
          updated_at: now,
        };
        writeFileSync(`${file}.tmp`, `${JSON.stringify(entry, null, 2)}\n`);
        renameSync(`${file}.tmp`, file);
        appendFileSync(join(dir, "events.jsonl"), `${JSON.stringify({ event: "ask", task: params.task, question: params.question, timestamp: now })}\n`);
      });

      const master = params.notify ?? process.env.ORCH_MASTER;
      if (master) {
        const msg = `[ASK ${params.task}] ${params.question.slice(0, 160)}`;
        spawnSync("herdr", ["agent", "prompt", master, msg]);
      }
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
      const run = params.run ?? process.env.ORCH_RUN;
      const dir = runDir({ run });
      const file = join(dir, fileFor(params.task));
      if (!existsSync(file)) throw new Error(`No task record for ${params.task}`);
      const now = new Date().toISOString();
      let workerAgent = null;

      withLock(file, () => {
        const prev = JSON.parse(readFileSync(file, "utf8"));
        workerAgent = prev.agent;
        const entry = {
          ...prev,
          seq: (prev.seq ?? 0) + 1,
          state: "WORKING",
          pending_ask: null,
          last_reply: { answer: params.answer, replied_at: now },
          summary: `[ANSWERED] ${params.answer}`,
          updated_at: now,
        };
        writeFileSync(`${file}.tmp`, `${JSON.stringify(entry, null, 2)}\n`);
        renameSync(`${file}.tmp`, file);
        appendFileSync(join(dir, "events.jsonl"), `${JSON.stringify({ event: "reply", task: params.task, answer: params.answer, timestamp: now })}\n`);
      });

      if (workerAgent) {
        const msg = `[ANSWER from Master] ${params.answer}`;
        spawnSync("herdr", ["agent", "prompt", workerAgent, msg]);
      }
      return { content: [{ type: "text", text: `Reply delivered to worker for task ${params.task}.` }] };
    }
  });

  // 5. Tool: orch_evidence
  pi.registerTool({
    name: "orch_evidence",
    label: "Orchestrator Store Evidence",
    description: "Save long output/logs to an on-disk deduplicated file and return a compact semantic reference (ref:sha256).",
    parameters: {
      type: "object",
      properties: {
        content: { type: "string", description: "Raw content to store" },
        run: { type: "string", description: "Run identifier" }
      },
      required: ["content"]
    },
    async execute(_id, params) {
      const run = params.run ?? process.env.ORCH_RUN;
      const dir = runDir({ run });
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
            return `${e.task}: ${e.state} (${agent?.agent_status ?? "-"}) - ${e.summary.slice(0, 40)}`;
          });
          ctx.ui?.notify?.(rows.join("\n"), "info");
        } catch (err) {
          ctx.ui?.notify?.(`Orchestrator error: ${err.message}`, "error");
        }
      }
    });
  }
}
