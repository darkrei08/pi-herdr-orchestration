#!/usr/bin/env node
// Report-back mailbox and orchestration coordination.
// Shared by every linked worktree under <git-common-dir>/orchestrator/<run>/ and never tracked.
// Features borrowed and adapted from fleet architecture (pi-herdsman):
//   - Atomic lock-based file mutations (zero race conditions across panes)
//   - Semantic result & evidence storage (large logs/diffs hashed to files; context remains clean)
//   - Bi-directional ask/reply protocol (workers can query master without hanging)
//   - Status dashboard joining mailbox records with Herdr agent liveness
//   - Preserved uppercase public states with optional derived lowercase lifecycle states
//   - Non-blocking notification dispatch and fail-closed handling for unknown states
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { appendFileSync, existsSync, linkSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { withLock } from "./lock.mjs";

export const STATES = ["ASSIGNED", "WORKING", "READY", "DEVELOPMENT", "BLOCKED", "FAILED", "CLOSED"];
export const LIFECYCLE_STATES = ["pending", "running", "ready", "blocked", "failed", "closed"];

export const STATE_TO_LIFECYCLE = Object.freeze({
  ASSIGNED: "pending",
  WORKING: "running",
  READY: "ready",
  DEVELOPMENT: "running",
  BLOCKED: "blocked",
  FAILED: "failed",
  CLOSED: "closed",
});

export function deriveLifecycle(state) {
  if (!state || typeof state !== "string") return "unknown";
  const upper = state.toUpperCase();
  if (STATE_TO_LIFECYCLE[upper]) {
    return STATE_TO_LIFECYCLE[upper];
  }
  const lower = state.toLowerCase();
  if (LIFECYCLE_STATES.includes(lower)) {
    return lower;
  }
  return "unknown";
}

const PENDING = new Set(["ASSIGNED", "WORKING"]);
const CHECKS = new Set(["PASS", "FAIL", "BLOCKED", "NOT RUN"]);
const HERDR_AGENT_NAME = /^[a-z][a-z0-9_-]{0,31}$/;
const RUN_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const EVIDENCE_HASH = /^[0-9a-f]{16,64}$/;
const PI_SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SESSION_UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const GIT_MAX_BUFFER = 64 * 1024 * 1024;
const IDENTITY_FIELDS = ["pane", "session"];
const REVIEW_PROVIDERS = new Set(["gga", "gentle"]);
const REVIEW_STATUSES = new Set(["PASS", "FAIL", "BLOCKED", "NOT RUN", "UNVERIFIED"]);
const MEMORY_STATUSES = new Set(["PERSISTED", "BLOCKED", "NOT RUN", "UNVERIFIED"]);
const REVIEW_REF = /^ref:sha256:[0-9a-f]{64}$/;
const ENGRAM_REF = /^engram:[A-Za-z0-9._:-]+$/;

function isPresent(value) {
  return value !== undefined && value !== null && value !== "";
}

function requestId(kind, supplied, payload) {
  if (isPresent(supplied)) return String(supplied);
  return `${kind}:${createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

function messageWasSeen(prev, id) {
  return id && (prev.message_id === id || (Array.isArray(prev.message_ids) && prev.message_ids.includes(id)));
}

function messageHistory(prev, id) {
  return [...new Set([
    ...(Array.isArray(prev.message_ids) ? prev.message_ids : []),
    prev.message_id,
    id
  ].filter(Boolean))];
}

function normalizeIdentifier(value) {
  return typeof value === "string" ? (value.match(SESSION_UUID)?.[0] ?? value) : value;
}

function normalizeIdentity(source) {
  if (!source || typeof source !== "object") return undefined;
  const identity = {};
  for (const field of IDENTITY_FIELDS) {
    if (isPresent(source[field])) identity[field] = normalizeIdentifier(source[field]);
  }
  return Object.keys(identity).length ? identity : undefined;
}

function liveIdentity(agent) {
  return normalizeIdentity({
    pane: agent?.pane_id ?? agent?.pane,
    session: agent?.agent_session?.value ?? agent?.session,
  });
}

const identityText = (identity) => JSON.stringify(identity ?? {});

function evidencePart(source) {
  if (!source || typeof source !== "object") return undefined;
  const part = {};
  for (const field of ["task", "run", "candidate", "provider", "status", "ref", "receipt", "reason", "version", "config_digest", "output_digest", "file_hashes", "deleted_files"]) {
    if (isPresent(source[field])) part[field] = source[field];
  }
  return Object.keys(part).length ? part : undefined;
}

function evidenceBindingRecord(binding, result) {
  return {
    task: binding?.task ?? null,
    run: binding?.run ?? null,
    candidate: binding?.candidate ?? null,
    review: evidencePart(binding?.review) ?? null,
    memory: evidencePart(binding?.memory) ?? null,
    status: result.status,
    reason: result.reason,
  };
}

export function validateEvidenceBinding(binding, expected) {
  if (!binding || typeof binding !== "object") {
    return { status: "unverified", reason: "evidence binding unavailable" };
  }

  for (const field of ["task", "run", "candidate"]) {
    if (!isPresent(expected?.[field]) || binding[field] !== expected[field]) {
      return { status: "blocked", reason: `evidence binding ${field} does not match the exact task candidate identity` };
    }
  }

  const review = binding.review;
  const memory = binding.memory;
  if (!review || typeof review !== "object" || !memory || typeof memory !== "object") {
    return { status: "unverified", reason: "review or memory evidence is unavailable" };
  }
  for (const field of ["task", "run", "candidate"]) {
    if (!isPresent(review[field]) || review[field] !== expected[field]) {
      return { status: "blocked", reason: `review evidence ${field} does not match the exact task candidate identity` };
    }
  }
  if (!REVIEW_PROVIDERS.has(review.provider) || !REVIEW_STATUSES.has(review.status)) {
    return { status: "blocked", reason: "review evidence provider or status is invalid" };
  }
  if (review.status === "PASS" && !REVIEW_REF.test(review.ref ?? "")) {
    return { status: "blocked", reason: "passing review evidence requires a content reference" };
  }
  if (review.status === "PASS" && (!isPresent(review.version) || !isPresent(review.config_digest) || !/^[0-9a-f]{64}$/.test(review.output_digest ?? ""))) {
    return { status: "blocked", reason: "passing review evidence requires reviewer version, configuration digest, and exact provider output digest" };
  }
  if (review.status === "PASS" && (!review.file_hashes || typeof review.file_hashes !== "object" || Array.isArray(review.file_hashes) || Object.values(review.file_hashes).some((hash) => !/^[0-9a-f]{64}$/.test(hash)))) {
    return { status: "blocked", reason: "passing review evidence requires full reviewed file hashes" };
  }
  if (review.status === "PASS" && (!Array.isArray(review.deleted_files ?? []) || (review.deleted_files ?? []).some((item) => !item || typeof item.path !== "string" || !/^[0-9a-f]{64}$/.test(item.diff_hash)))) {
    return { status: "blocked", reason: "passing review evidence requires full reviewed deletion hashes" };
  }
  if (memory.provider !== "engram" || !MEMORY_STATUSES.has(memory.status)) {
    return { status: "blocked", reason: "memory evidence provider or status is invalid" };
  }
  for (const field of ["task", "run", "candidate"]) {
    if (!isPresent(memory[field]) || memory[field] !== expected[field]) {
      return { status: "blocked", reason: `memory evidence ${field} does not match the exact task candidate identity` };
    }
  }
  if (memory.status === "PERSISTED" && !ENGRAM_REF.test(memory.ref ?? "")) {
    return { status: "blocked", reason: "persisted memory evidence requires an Engram observation reference" };
  }
  if (memory.status === "PERSISTED" && !REVIEW_REF.test(memory.receipt ?? "")) {
    return { status: "unverified", reason: "persisted memory evidence requires a provider receipt" };
  }
  if (review.status === "FAIL" || memory.status === "BLOCKED") {
    return { status: "blocked", reason: "review or memory evidence reports a blocking outcome" };
  }
  if (review.status !== "PASS" || memory.status !== "PERSISTED") {
    return { status: "unverified", reason: "review or memory evidence is unavailable or uncertain" };
  }
  return { status: "verified", reason: "review and memory evidence match the exact task candidate identity" };
}

function sameIdentity(left, right) {
  return Boolean(left && typeof left === "object"
    && right && typeof right === "object"
    && ["task", "run", "candidate"].every((field) => left[field] === right[field]));
}

function sameFileHashes(left, right) {
  if (!left || typeof left !== "object" || Array.isArray(left) || !right || typeof right !== "object" || Array.isArray(right)) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return JSON.stringify(leftKeys) === JSON.stringify(rightKeys)
    && leftKeys.every((key) => left[key] === right[key]);
}

function normalizeDeletedFiles(files) {
  if (!Array.isArray(files)) return [];
  return files.map((item) => ({ path: item.path, diff_hash: item.diff_hash })).sort((a, b) => a.path.localeCompare(b.path));
}

function sameDeletedFiles(left, right) {
  return JSON.stringify(normalizeDeletedFiles(left)) === JSON.stringify(normalizeDeletedFiles(right));
}

function gitCandidateReview(candidate, fileHashes, deletedFiles = []) {
  const repo = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" });
  if (repo.status !== 0) return null;
  const root = repo.stdout.trim();
  const resolved = spawnSync("git", ["rev-parse", "--verify", `${candidate}^{commit}`], { cwd: root, encoding: "utf8" });
  if (resolved.status !== 0) return null;
  const commit = resolved.stdout.trim();
  if (candidate !== commit) {
    return { status: "blocked", reason: "review candidate must be an immutable commit id" };
  }
  const parents = spawnSync("git", ["rev-list", "--parents", "-n", "1", commit], { cwd: root, encoding: "utf8" });
  if (parents.status !== 0) return { status: "blocked", reason: "candidate parent inventory is unavailable" };
  const parentIds = parents.stdout.trim().split(/\s+/).slice(1);
  const changedCommands = parentIds.length
    ? parentIds.map((parent) => ["diff", "--name-only", "-z", parent, commit])
    : [["diff-tree", "--root", "--no-commit-id", "--name-only", "-z", "-r", commit]];
  const changedPaths = [];
  for (const args of changedCommands) {
    const changed = spawnSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: GIT_MAX_BUFFER });
    if (changed.status !== 0) return { status: "blocked", reason: "candidate changed-file inventory is unavailable" };
    changedPaths.push(...changed.stdout.split("\0").filter(Boolean));
  }
  const uniqueChangedPaths = [...new Set(changedPaths)].sort();
  const normalizedDeleted = normalizeDeletedFiles(deletedFiles);
  const reviewedPaths = [...Object.keys(fileHashes), ...normalizedDeleted.map((item) => item.path)].sort();
  if (JSON.stringify(uniqueChangedPaths) !== JSON.stringify(reviewedPaths)) {
    return { status: "blocked", reason: "review evidence must cover every file changed by the candidate" };
  }
  const actualHashes = {};
  for (const path of Object.keys(fileHashes)) {
    if (isAbsolute(path) || path.split(/[\\/]+/).includes("..")) {
      return { status: "blocked", reason: "review file hash path is not repository-relative" };
    }
    const content = spawnSync("git", ["show", `${commit}:${path}`], { cwd: root, encoding: null, maxBuffer: GIT_MAX_BUFFER });
    if (content.status !== 0) {
      return { status: "blocked", reason: `review file is absent from candidate; list it in deleted_files: ${path}` };
    }
    actualHashes[path] = createHash("sha256").update(content.stdout).digest("hex");
  }
  const actualDeleted = [];
  for (const item of normalizedDeleted) {
    if (isAbsolute(item.path) || item.path.split(/[\\/]+/).includes("..") || !/^[0-9a-f]{64}$/.test(item.diff_hash)) {
      return { status: "blocked", reason: "review deletion evidence is malformed" };
    }
    const content = spawnSync("git", ["show", `${commit}:${item.path}`], { cwd: root, encoding: null, maxBuffer: GIT_MAX_BUFFER });
    if (content.status === 0 || !parentIds.length) {
      return { status: "blocked", reason: `review deletion is not present in the candidate tree: ${item.path}` };
    }
    const deletion = parentIds
      .map((parentId) => spawnSync("git", ["diff", "--binary", parentId, commit, "--", item.path], { cwd: root, encoding: null, maxBuffer: GIT_MAX_BUFFER }))
      .find((result) => result.status === 0 && result.stdout?.length > 0
        && createHash("sha256").update(result.stdout).digest("hex") === item.diff_hash);
    if (!deletion) {
      return { status: "blocked", reason: `review deletion evidence does not match the candidate change: ${item.path}` };
    }
    actualDeleted.push({ path: item.path, diff_hash: item.diff_hash });
  }
  let rules;
  try {
    rules = spawnSync("git", ["show", `${commit}:AGENTS.md`], { cwd: root, encoding: null, maxBuffer: GIT_MAX_BUFFER });
    if (rules.status !== 0) return { status: "blocked", reason: "review rules are absent from candidate" };
    const gga = readFileSync(join(root, ".gga"));
    const configDigest = createHash("sha256")
      .update("AGENTS.md\\0").update(rules.stdout)
      .update(".gga\\0").update(gga)
      .digest("hex");
    return { status: "verified", fileHashes: actualHashes, deletedFiles: actualDeleted, configDigest };
  } catch {
    return { status: "blocked", reason: "review configuration is unavailable" };
  }
}

function verifyExternalEvidence(binding) {
  const repo = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" });
  if (repo.status !== 0) return { status: "unverified", reason: "candidate repository is unavailable for provider verification" };
  const root = repo.stdout.trim();
  const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" });
  if (head.status !== 0 || head.stdout.trim() !== binding.candidate) {
    return { status: "unverified", reason: "the provider can only verify the candidate currently checked out at HEAD" };
  }
  const status = spawnSync("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: root, encoding: "utf8" });
  if (status.status !== 0 || status.stdout.trim()) {
    return { status: "unverified", reason: "the provider requires a clean worktree for immutable candidate verification" };
  }
  const provider = binding.review.provider;
  const candidateEvidence = gitCandidateReview(binding.candidate, binding.review.file_hashes, binding.review.deleted_files);
  if (!candidateEvidence || candidateEvidence.status !== "verified"
    || candidateEvidence.configDigest !== binding.review.config_digest
    || !sameFileHashes(candidateEvidence.fileHashes, binding.review.file_hashes)
    || !sameDeletedFiles(candidateEvidence.deletedFiles, binding.review.deleted_files)) {
    return { status: "unverified", reason: "provider evidence metadata is not bound to the candidate tree" };
  }
  const command = provider === "gga"
    ? process.env.ORCH_GGA_VERIFY_COMMAND ?? "gga"
    : process.env.ORCH_GENTLE_VERIFY_COMMAND;
  if (!command) {
    return { status: "unverified", reason: `no verifier is configured for review provider ${provider}` };
  }
  if (provider === "gga" && !/^[0-9a-f]{64}$/.test(binding.review.output_digest ?? "")) {
    return { status: "unverified", reason: "GGA review evidence must include the exact provider output digest" };
  }
  const args = provider === "gga" ? ["run", "--ci", "--no-cache"] : [];
  let providerVersion = binding.review.version;
  if (provider === "gga") {
    const version = spawnSync(command, ["version"], { cwd: root, encoding: "utf8", timeout: 30_000 });
    const match = `${version.stdout ?? ""}\n${version.stderr ?? ""}`.match(/(?:v|version\s+)(\d+\.\d+\.\d+)/i);
    if (version.error || version.status !== 0 || !match || match[1] !== binding.review.version) {
      return { status: "unverified", reason: "provider version does not match the claimed review receipt" };
    }
    providerVersion = match[1];
  }
  const review = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    timeout: 900_000,
    env: {
      ...process.env,
      ORCH_EVIDENCE_TASK: binding.task,
      ORCH_EVIDENCE_RUN: binding.run,
      ORCH_EVIDENCE_CANDIDATE: binding.candidate,
      ORCH_EVIDENCE_PROVIDER: provider,
    },
  });
  if (review.error || review.status !== 0) {
    return { status: "unverified", reason: `${provider} did not provide a successful review receipt for the bound candidate` };
  }
  const providerReceipt = {
    task: binding.task,
    run: binding.run,
    candidate: binding.candidate,
    provider,
    status: "PASS",
    version: providerVersion,
    config_digest: candidateEvidence.configDigest,
    file_hashes: candidateEvidence.fileHashes,
    deleted_files: candidateEvidence.deletedFiles,
    output_digest: createHash("sha256").update(`${review.stdout ?? ""}\n${review.stderr ?? ""}`).digest("hex")
  };
  if (providerReceipt.version !== binding.review.version
    || providerReceipt.config_digest !== binding.review.config_digest
    || providerReceipt.output_digest !== binding.review.output_digest
    || !sameFileHashes(providerReceipt.file_hashes, binding.review.file_hashes)
    || !sameDeletedFiles(providerReceipt.deleted_files, binding.review.deleted_files)) {
    return { status: "unverified", reason: "provider receipt does not match the claimed candidate-bound review" };
  }

  const receiptFile = join(root, `.orch-engram-${process.pid}-${randomUUID()}.json`);
  try {
    const memory = spawnSync(process.env.ORCH_ENGRAM_VERIFY_COMMAND ?? "engram", ["export", receiptFile], {
      cwd: root,
      encoding: "utf8",
      timeout: 30_000,
    });
    if (memory.error || memory.status !== 0) {
      return { status: "unverified", reason: "Engram did not provide an observation export" };
    }
    const exported = JSON.parse(readFileSync(receiptFile, "utf8"));
    const observation = String(binding.memory.ref).replace(/^engram:/, "");
    const match = (exported.observations ?? []).find((item) =>
      String(item.id) === observation || item.sync_id === observation
    );
    if (!match) {
      return { status: "unverified", reason: "Engram export does not contain the exact observation reference" };
    }
    const identity = match.evidence_binding ?? match.binding ?? match;
    if (!sameIdentity(identity, binding)) {
      return { status: "unverified", reason: "Engram observation does not contain the exact task candidate identity" };
    }
    return { status: "verified", reason: "GGA and Engram independently verified the bound provider receipts" };
  } catch {
    return { status: "unverified", reason: "Engram observation export is unavailable or malformed" };
  } finally {
    rmSync(receiptFile, { force: true });
  }
}

function verifyProviderEvidence(binding, providerVerifier) {
  try {
    const result = providerVerifier
      ? providerVerifier({ binding })
      : verifyExternalEvidence(binding);
    return result ?? { status: "unverified", reason: "provider verification returned no result" };
  } catch {
    return { status: "unverified", reason: "provider verification failed" };
  }
}

function validateStoredReviewEvidence(dir, binding, result) {
  if (result.status !== "verified") return result;
  try {
    const content = readEvidence(dir, binding.review.ref);
    const attestation = JSON.parse(content);
    const review = binding.review;
    if (!attestation || typeof attestation !== "object"
      || attestation.task !== review.task
      || attestation.run !== review.run
      || attestation.candidate !== review.candidate
      || attestation.provider !== review.provider
      || attestation.status !== review.status
      || attestation.version !== review.version
      || attestation.config_digest !== review.config_digest
      || (isPresent(review.output_digest) && attestation.output_digest !== review.output_digest)
      || !sameFileHashes(attestation.file_hashes, review.file_hashes)
      || !sameDeletedFiles(attestation.deleted_files, review.deleted_files)) {
      return { status: "blocked", reason: "review evidence attestation does not match its candidate metadata" };
    }
    const candidateReview = gitCandidateReview(review.candidate, review.file_hashes, review.deleted_files);
    if (!candidateReview) return { status: "blocked", reason: "review candidate is not an immutable Git commit" };
    if (candidateReview.status === "blocked") return candidateReview;
    if (!sameFileHashes(candidateReview.fileHashes, review.file_hashes)
      || !sameDeletedFiles(candidateReview.deletedFiles, review.deleted_files)
      || candidateReview.configDigest !== review.config_digest) {
      return { status: "blocked", reason: "review evidence hashes or configuration digest do not match the candidate" };
    }
    const memory = binding.memory;
    const receipt = JSON.parse(readEvidence(dir, memory.receipt));
    if (!receipt || typeof receipt !== "object"
      || receipt.task !== memory.task
      || receipt.run !== memory.run
      || receipt.candidate !== memory.candidate
      || receipt.provider !== memory.provider
      || receipt.status !== memory.status
      || receipt.ref !== memory.ref) {
      return { status: "blocked", reason: "memory evidence receipt does not match the persisted observation" };
    }
    return result;
  } catch {
    return { status: "blocked", reason: "review evidence reference is unavailable or malformed" };
  }
}

function replayTerminalEvidence(dir, prev, expected) {
  if (!["READY", "CLOSED"].includes(prev.state)) return null;
  if (!prev.evidence_binding) return { status: "blocked", reason: "terminal reports must retain a candidate-bound evidence binding" };
  const result = validateEvidenceBinding(prev.evidence_binding, expected);
  return validateStoredReviewEvidence(dir, prev.evidence_binding, result);
}

function currentAgentName() {
  return String(process.env.ORCH_AGENT || "").trim();
}

function isHerdrAgentName(value) {
  return HERDR_AGENT_NAME.test(value) && !PI_SESSION_ID.test(value);
}

// Name-only joining credits a pending task to an unrelated live agent when a
// pane or agent name is reused. Correlate only when the record carries
// identity; legacy records remain DECIDE/unverified until reconciled.
function nameBasedFlag(entry, agent, now, staleMs) {
  const live = agent?.agent_status;
  if (!agent) return "GONE";
  if (!["working", "idle", "done", "blocked", "unknown"].includes(live)) return "DECIDE";
  if (live === "unknown") return "DECIDE";
  if (entry.pending_ask) return "ASK";
  if (live === "blocked") return "NEEDS_HUMAN";
  if (PENDING.has(entry.state) && (live === "idle" || live === "done")) return "SILENT";
  if (PENDING.has(entry.state) && live === "working" && now - Date.parse(entry.updated_at) > staleMs) return "STALE";
  if (!PENDING.has(entry.state)) return "DECIDE";
  return "OK";
}

export function classifyLiveness(entry, agent, now, staleMs) {
  if (entry.state === "CLOSED" && entry.lifecycle && entry.lifecycle !== "closed") {
    return { flag: "DECIDE", state: "decide", reason: `lifecycle says ${entry.lifecycle} but state is CLOSED` };
  }
  if (entry.state === "CLOSED") {
    const live = agent?.agent_status;
    const record = normalizeIdentity(entry.identity);
    const current = liveIdentity(agent);
    const mismatched = IDENTITY_FIELDS.filter((field) => isPresent(record?.[field]) && isPresent(current?.[field]) && record[field] !== current[field]);
    const incomplete = IDENTITY_FIELDS.filter((field) => !isPresent(record?.[field]) || !isPresent(current?.[field]));
    if (!agent) return { flag: "GONE", state: "decide", reason: "closed task agent is gone; master reconciliation required" };
    if (!["working", "idle", "done"].includes(live) || !record || !current || mismatched.length || incomplete.length) {
      return { flag: "DECIDE", state: "decide", reason: "closed task liveness or identity is unavailable; master reconciliation required" };
    }
    return { flag: "OK", state: "closed", reason: `closed task identity matches: record=${identityText(record)} live=${identityText(current)}` };
  }
  // A lifecycle that contradicts the state must not silently close a task.
  if (entry.lifecycle === "closed") return { flag: "DECIDE", state: "decide", reason: `lifecycle says closed but state is ${entry.state}` };
  const flag = nameBasedFlag(entry, agent, now, staleMs);
  if (!agent) return { flag: "GONE", state: "decide", reason: "no live agent; master reconciliation required" };

  const record = normalizeIdentity(entry.identity);
  if (!record) return { flag: "DECIDE", state: "unverified", reason: "legacy record has no identity; master reconciliation required" };

  const live = liveIdentity(agent);
  if (!live) return { flag: "DECIDE", state: "unverified", reason: `record identity ${identityText(record)}; live agent reports no identity` };

  const incomplete = IDENTITY_FIELDS.filter((f) => !isPresent(record[f]) || !isPresent(live[f]));
  if (incomplete.length) {
    return { flag: "DECIDE", state: "unverified", reason: `identity incomplete: record=${identityText(record)} live=${identityText(live)}` };
  }
  const mismatched = IDENTITY_FIELDS.filter((f) => isPresent(record[f]) && isPresent(live[f]) && record[f] !== live[f]);
  if (mismatched.length) {
    return { flag: "DECIDE", state: "decide", reason: `identity mismatch: record=${identityText(record)} live=${identityText(live)}` };
  }
  return { flag, state: "live", reason: `identity matches: record=${identityText(record)} live=${identityText(live)}` };
}

export function classify(entry, agent, now, staleMs) {
  return classifyLiveness(entry, agent, now, staleMs).flag;
}

export function parse(argv) {
  const opts = { check: [], risk: [] };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, "");
    const value = argv[++i];
    if (value === undefined) throw new Error(`missing value for ${argv[i - 1]}`);
    if (key === "check" || key === "checks") opts.check.push(value);
    else if (key === "risk" || key === "risks") opts.risk.push(value);
    else if (key === "question-id") opts.question_id = value;
    else if (key === "required-check" || key === "required-checks") {
      opts.required_checks ??= [];
      opts.required_checks.push(value);
    } else if (key === "evidence-binding") {
      opts.evidence_binding = JSON.parse(value);
    } else opts[key] = value;
  }
  return opts;
}

export function runDir(opts) {
  if (opts?.dir) {
    const dir = String(opts.dir);
    if (!isAbsolute(dir) || dir.split(/[\\/]+/).includes("..")) throw new Error(`invalid orchestration directory: ${opts.dir}`);
    return resolve(dir);
  }
  const run = opts?.run ?? process.env.ORCH_RUN;
  if (!run) throw new Error("--run (or ORCH_RUN) is required");
  if (typeof run !== "string" || !RUN_ID.test(run)) throw new Error(`invalid run identifier: ${run}`);
  if (process.env.ORCH_DIR) return resolve(process.env.ORCH_DIR, run);
  const git = spawnSync("git", ["rev-parse", "--git-common-dir"], { encoding: "utf8" });
  if (git.status !== 0) throw new Error("not inside a git repository; set ORCH_DIR");
  return join(resolve(git.stdout.trim()), "orchestrator", run);
}

export const fileFor = (task) => `${task.replace(/[^A-Za-z0-9._-]/g, "-")}.json`;

function assertTaskRecord(prev, task) {
  if (prev.task && prev.task !== task) {
    throw new Error(`task mailbox collision: ${task} maps to a record for ${prev.task}`);
  }
}

// A missing record is a first write; a corrupt one must not be overwritten
// silently, because that discards the only persisted state of a task.
function readEntry(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return {};
    throw err;
  }
}

function persistEntry(dir, file, entry, event) {
  const eventsFile = join(dir, "events.jsonl");
  const eventId = event.event_id ?? createHash("sha256")
    .update(`${entry.task ?? ""}\0${entry.message_id ?? ""}\0${entry.seq ?? ""}`)
    .digest("hex");
  const persistedEvent = { ...event, event_id: eventId };
  const existingEvents = existsSync(eventsFile)
    ? readFileSync(eventsFile, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line))
    : [];
  const tempFile = `${file}.${process.pid}.${randomUUID()}.tmp`;
  try {
    writeFileSync(tempFile, `${JSON.stringify(entry, null, 2)}\n`, { flag: "wx" });
    renameSync(tempFile, file);
  } finally {
    if (existsSync(tempFile)) {
      try { unlinkSync(tempFile); } catch { /* preserve the completed rename */ }
    }
  }
  if (!existingEvents.some((item) => item.event_id === eventId)) {
    appendFileSync(eventsFile, `${JSON.stringify(persistedEvent)}\n`);
  }
}

// Store large evidence payloads into deduplicated files to protect context windows
export function storeEvidence(dir, content) {
  const hash = createHash("sha256").update(content).digest("hex");
  const evidenceDir = join(dir, "evidence");
  mkdirSync(evidenceDir, { recursive: true });
  const evidenceFile = join(evidenceDir, `${hash}.txt`);
  const tempFile = `${evidenceFile}.${process.pid}.${randomUUID()}.tmp`;
  try {
    writeFileSync(tempFile, content, { flag: "wx" });
    try {
      linkSync(tempFile, evidenceFile);
    } catch (err) {
      if (err.code !== "EEXIST") throw err;
      const existing = readFileSync(evidenceFile, "utf8");
      if (createHash("sha256").update(existing).digest("hex") !== hash) {
        throw new Error(`evidence file hash mismatch: ${evidenceFile}`);
      }
    }
  } finally {
    if (existsSync(tempFile)) {
      try { unlinkSync(tempFile); } catch { /* another writer completed the same content */ }
    }
  }
  return `ref:sha256:${hash}`;
}

export function readEvidence(dir, ref) {
  if (!ref || typeof ref !== "string" || !ref.startsWith("ref:sha256:")) {
    throw new Error(`invalid evidence reference: ${ref}`);
  }
  const hash = ref.replace(/^ref:sha256:/, "").trim();
  if (!EVIDENCE_HASH.test(hash)) throw new Error(`invalid evidence reference: ${ref}`);
  const evidenceDir = join(dir, "evidence");
  const exactFile = join(evidenceDir, `${hash}.txt`);
  const candidates = existsSync(exactFile)
    ? [exactFile]
    : existsSync(evidenceDir)
      ? readdirSync(evidenceDir).filter((f) => f.startsWith(hash) && f.endsWith(".txt")).map((f) => join(evidenceDir, f))
      : [];
  for (const file of candidates) {
    const content = readFileSync(file, "utf8");
    if (createHash("sha256").update(content).digest("hex").startsWith(hash)) return content;
  }
  throw new Error(`evidence not found or hash mismatch for reference: ${ref}`);
}

export function notifyAgent(agent, message, { nonBlocking = true, sender = currentAgentName() } = {}) {
  const recipient = String(agent ?? "").trim();
  const current = String(sender ?? "").trim();
  if (!isHerdrAgentName(recipient) || (current && recipient === current)) return false;
  try {
    if (nonBlocking) {
      const child = spawn("herdr", ["agent", "prompt", recipient, message], {
        stdio: "ignore",
        detached: true,
      });
      child.on("error", () => {
        // Notification failure cannot block report persistence
      });
      child.unref?.();
      return true;
    }
    const sent = spawnSync("herdr", ["agent", "prompt", recipient, message], { encoding: "utf8" });
    if (sent.error || (sent.status !== null && sent.status !== 0)) {
      console.error(`notify to '${agent}' failed; report is still in the mailbox`);
      return false;
    }
    return true;
  } catch {
    // Notification failure cannot block report persistence
    return false;
  }
}

export function report(opts) {
  const dir = runDir(opts);
  if (!opts.task) throw new Error("--task is required");
  if (!STATES.includes(opts.state)) throw new Error(`--state must be one of ${STATES.join(", ")}`);

  const rawChecks = opts.checks ?? opts.check ?? [];
  const checksArray = Array.isArray(rawChecks) ? rawChecks : [rawChecks];
  for (const c of checksArray) {
    const [name, ...statusParts] = typeof c === "string" ? c.split("=") : [];
    const status = statusParts.join("=");
    if (!name || !CHECKS.has(status)) throw new Error(`--check must be name=${[...CHECKS].join("|")}: ${c}`);
  }

  const rawRisks = opts.risks ?? opts.risk ?? [];
  const risksArray = Array.isArray(rawRisks) ? rawRisks : [rawRisks];
  const rawRequiredChecks = opts.required_checks ?? opts.requiredChecks ?? [];
  const requiredChecks = Array.isArray(rawRequiredChecks) ? rawRequiredChecks : [rawRequiredChecks];

  mkdirSync(dir, { recursive: true });
  const file = join(dir, fileFor(opts.task));

  let evidenceRef = null;
  if (opts.evidence) {
    evidenceRef = storeEvidence(dir, opts.evidence);
  }

  const now = new Date().toISOString();
  const terminalState = ["READY", "CLOSED"].includes(opts.state);
  const suppliedBinding = opts.evidence_binding ?? opts.evidenceBinding;
  let entry = null;

  withLock(file, () => {
    const prev = readEntry(file);
    assertTaskRecord(prev, opts.task);
    if (prev.state === "CLOSED" && opts.state !== "CLOSED") {
      throw new Error(`cannot reopen CLOSED task ${opts.task}`);
    }
    const run = opts.run ?? process.env.ORCH_RUN ?? prev.run;
    const candidate = opts.candidate ?? prev.candidate;
    const effectiveRequiredChecks = [...new Set([
      ...(Array.isArray(prev.required_checks) ? prev.required_checks : []),
      ...requiredChecks,
    ])];
    const candidateChanged = isPresent(opts.candidate) && opts.candidate !== (prev.candidate ?? null);
    const checksByName = new Map((!candidateChanged && Array.isArray(prev.checks) ? prev.checks : []).map((check) => [check.name, check.status]));
    for (const check of checksArray) {
      checksByName.set(check.split("=")[0], check.split("=").slice(1).join("="));
    }
    const currentChecks = [...checksByName].map(([name, status]) => ({ name, status }));
    const currentCheckStrings = currentChecks.map(({ name, status }) => `${name}=${status}`);
    const requiresTerminalEvidence = opts.state === "READY"
      || (opts.state === "CLOSED" && (isPresent(candidate) || Boolean(suppliedBinding) || Boolean(prev.evidence_binding)));
    const requestedBinding = suppliedBinding ?? (terminalState ? undefined : prev.evidence_binding);
    let messageId = requestId("report", opts.id, {
      task: opts.task,
      run,
      candidate: opts.candidate,
      state: opts.state,
      summary: opts.summary,
      checks: currentCheckStrings,
      required_checks: effectiveRequiredChecks,
      evidence: evidenceRef,
      evidence_binding: opts.evidence_binding ?? opts.evidenceBinding,
      pane: opts.pane,
      session: opts.session,
      branch: opts.branch ?? prev.branch ?? null
    });
    if (prev.state === "CLOSED" && !messageWasSeen(prev, messageId)) {
      throw new Error(`cannot update CLOSED task ${opts.task}`);
    }
    const sameCurrentReport = prev.state === opts.state
      && prev.summary === (opts.summary ?? "")
      && JSON.stringify(prev.checks ?? []) === JSON.stringify(currentChecks)
      && (prev.candidate ?? null) === (candidate ?? null)
      && (opts.branch ?? prev.branch ?? null) === (prev.branch ?? null);
    const sameTerminalAttempt = terminalState && prev.state === "BLOCKED" && messageWasSeen(prev, messageId);
    if (!opts.id && !sameTerminalAttempt && !["READY", "CLOSED"].includes(prev.state) && messageWasSeen(prev, messageId) && !sameCurrentReport) {
      messageId = requestId("report", undefined, { task: opts.task, run, candidate: opts.candidate, state: opts.state, summary: opts.summary, checks: currentCheckStrings, required_checks: effectiveRequiredChecks, evidence: evidenceRef, evidence_binding: opts.evidence_binding ?? opts.evidenceBinding, pane: opts.pane, session: opts.session, branch: opts.branch ?? prev.branch ?? null, after: prev.message_id });
    }
    const retryUnverifiedTerminal = prev.state === "BLOCKED" && terminalState && prev.evidence_binding?.status === "unverified";
    if (messageWasSeen(prev, messageId) && !retryUnverifiedTerminal) {
      if (prev.state === "CLOSED") {
        let replayResult = requiresTerminalEvidence
          ? replayTerminalEvidence(dir, prev, { task: opts.task, run: prev.run ?? run, candidate: prev.candidate ?? candidate })
          : null;
        if (replayResult?.status === "verified" && prev.evidence_binding) {
          replayResult = verifyProviderEvidence(prev.evidence_binding, opts.providerVerifier);
        }
        if (replayResult && replayResult.status !== "verified") {
          throw new Error(`closed report evidence verification failed for ${opts.task}: ${replayResult.reason ?? "unverified evidence"}`);
        }
        entry = prev;
        return;
      }
      let replayResult = requiresTerminalEvidence
        ? replayTerminalEvidence(dir, prev, { task: opts.task, run: prev.run ?? run, candidate: prev.candidate ?? candidate })
        : null;
      if (replayResult?.status === "verified" && terminalState && prev.evidence_binding) {
        replayResult = verifyProviderEvidence(prev.evidence_binding, opts.providerVerifier);
      }
      if (!replayResult || replayResult.status === "verified" || (prev.state === "BLOCKED" && sameTerminalAttempt)) {
        if (!opts.id && sameCurrentReport && prev.state === "WORKING") {
          const heartbeatMessageId = requestId("report", randomUUID(), {
            task: opts.task,
            run,
            state: opts.state,
            summary: opts.summary,
            branch: opts.branch ?? prev.branch ?? null,
            after: prev.message_id,
            heartbeat: true
          });
          entry = {
            ...prev,
            seq: (prev.seq ?? 0) + 1,
            message_id: heartbeatMessageId,
            message_ids: messageHistory(prev, heartbeatMessageId),
            updated_at: now
          };
          persistEntry(dir, file, entry, { ...entry, heartbeat: true });
        } else {
          entry = prev;
        }
        return;
      }
      const replayed = {
        ...prev,
        seq: (prev.seq ?? 0) + 1,
        message_ids: messageHistory(prev, messageId),
        state: "BLOCKED",
        lifecycle: deriveLifecycle("BLOCKED"),
        evidence_binding: evidenceBindingRecord(prev.evidence_binding, replayResult),
        updated_at: now,
      };
      entry = replayed;
      persistEntry(dir, file, replayed, { ...replayed, checks: replayed.checks?.length ?? 0, replay: true });
      return;
    }
    const evidenceRequired = requiresTerminalEvidence || isPresent(candidate) || Boolean(requestedBinding);
    const evidenceBinding = requestedBinding ?? (evidenceRequired ? { task: opts.task, run, candidate } : null);
    const terminalEvidenceMissing = requiresTerminalEvidence && (!isPresent(candidate) || !suppliedBinding);
    let bindingResult = terminalEvidenceMissing
      ? { status: "blocked", reason: "terminal reports must supply a candidate and fresh evidence binding" }
      : evidenceBinding
        ? validateEvidenceBinding(evidenceBinding, { task: opts.task, run, candidate })
        : null;
    if (bindingResult?.status === "verified") {
      bindingResult = validateStoredReviewEvidence(dir, evidenceBinding, bindingResult);
    }
    let providerResult = null;
    if (bindingResult?.status === "verified" && terminalState) {
      providerResult = verifyProviderEvidence(evidenceBinding, opts.providerVerifier);
      bindingResult = providerResult;
    }
    const checkResults = new Map(currentChecks.map(({ name, status }) => [name, status]));
    const checksPass = !terminalState || (
      currentChecks.length > 0
      && effectiveRequiredChecks.length > 0
      && currentChecks.every(({ status }) => status === "PASS")
      && effectiveRequiredChecks.every((name) => checkResults.get(name) === "PASS")
    );
    const terminalProofPass = !requiresTerminalEvidence || (
      !terminalEvidenceMissing
      && bindingResult?.status === "verified"
      && providerResult?.status === "verified"
    );
    const state = prev.pending_ask || !checksPass || !terminalProofPass
      ? "BLOCKED"
      : opts.state;
    entry = {
      v: "repo-orchestrator/v1",
      kind: state === "ASSIGNED" || state === "WORKING" ? "progress" : "result",
      run,
      task: opts.task,
      agent: opts.agent ?? process.env.ORCH_AGENT ?? prev.agent ?? null,
      seq: (prev.seq ?? 0) + 1,
      message_id: messageId,
      message_ids: messageHistory(prev, messageId),
      state,
      lifecycle: deriveLifecycle(state),
      phase: opts.phase ?? prev.phase ?? null,
      branch: opts.branch ?? prev.branch ?? null,
      summary: opts.summary ?? "",
      checks: currentChecks,
      required_checks: effectiveRequiredChecks,
      evidence_ref: evidenceRef ?? prev.evidence_ref ?? null,
      evidence_binding: evidenceBinding
        ? evidenceBindingRecord(evidenceBinding, bindingResult)
        : prev.evidence_binding ?? null,
      pending_ask: prev.pending_ask ?? null,
      risks: risksArray,
      next: opts.next ?? null,
      created_at: prev.created_at ?? now,
      updated_at: now,
    };
    if (requiresTerminalEvidence && (state === "READY" || state === "CLOSED") && providerResult?.status !== "verified") {
      throw new Error("terminal evidence provider verification must complete before persistence");
    }
    if (isPresent(candidate)) entry.candidate = candidate;
    const supplied = normalizeIdentity({ pane: opts.pane, session: opts.session });
    const identity = supplied ? { ...normalizeIdentity(prev.identity), ...supplied } : normalizeIdentity(prev.identity);
    if (identity) entry.identity = identity;
    persistEntry(dir, file, entry, { ...entry });
  });

  const persisted = readEntry(file);
  if (persisted.message_id !== entry.message_id) entry = persisted;
  const master = opts.notify ?? process.env.ORCH_MASTER;
  const sender = currentAgentName() || (opts.agent === master ? opts.agent : "");
  if (master && master !== sender) {
    const msg = `[REPORT ${entry.task} ${entry.state}] ${entry.summary.slice(0, 160)} (run ${entry.run}: mailbox.mjs status --run ${entry.run})`;
    notifyAgent(master, msg, { nonBlocking: opts.nonBlocking ?? true, sender });
  }
  if (!opts.silent) {
    console.log(`${entry.task} ${entry.state} seq=${entry.seq} -> ${file}`);
  }
  return entry;
}

export function ask(opts) {
  const dir = runDir(opts);
  if (!opts.task) throw new Error("--task is required");
  if (!opts.question) throw new Error("--question is required");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, fileFor(opts.task));
  const now = new Date().toISOString();
  let entry = null;

  withLock(file, () => {
    const prev = readEntry(file);
    assertTaskRecord(prev, opts.task);
    if (prev.state === "CLOSED") throw new Error(`cannot ask on CLOSED task ${opts.task}`);
    const run = opts.run ?? process.env.ORCH_RUN ?? prev.run;
    const askPayload = { task: opts.task, run, question: opts.question };
    if (!opts.id && prev.pending_ask?.question === opts.question) {
      entry = prev;
      return;
    }
    let messageId = requestId("ask", opts.id, askPayload);
    if (!opts.id && messageWasSeen(prev, messageId)) {
      messageId = requestId("ask", undefined, { ...askPayload, after: prev.message_id });
    }
    if (messageWasSeen(prev, messageId)) {
      if (prev.pending_ask?.message_id === messageId) {
        entry = prev;
        return;
      }
      throw new Error(`stale ask message ${messageId} for task ${opts.task}`);
    }
    entry = {
      ...prev,
      v: "repo-orchestrator/v1",
      run,
      task: opts.task,
      agent: opts.agent ?? process.env.ORCH_AGENT ?? prev.agent ?? null,
      state: "BLOCKED",
      lifecycle: deriveLifecycle("BLOCKED"),
      seq: (prev.seq ?? 0) + 1,
      message_id: messageId,
      message_ids: messageHistory(prev, messageId),
      pending_ask: { question: opts.question, message_id: messageId, asked_at: now },
      summary: `[QUESTION] ${opts.question}`,
      created_at: prev.created_at ?? now,
      updated_at: now,
    };
    persistEntry(dir, file, entry, { event: "ask", task: opts.task, question: opts.question, timestamp: now });
  });

  const master = opts.notify ?? process.env.ORCH_MASTER;
  const sender = currentAgentName() || (opts.agent === master ? opts.agent : "");
  if (master && master !== sender) {
    const msg = `[ASK ${opts.task}] ${opts.question.slice(0, 160)} (question ${entry.pending_ask.message_id}; run ${entry.run ?? opts.run}: mailbox.mjs reply --task ${opts.task} --question-id ${entry.pending_ask.message_id} --answer <msg>)`;
    notifyAgent(master, msg, { nonBlocking: opts.nonBlocking ?? true, sender });
  }
  if (!opts.silent) {
    console.log(`Question recorded for ${opts.task}`);
  }
  return entry;
}

export function reply(opts) {
  const dir = runDir(opts);
  if (!opts.task) throw new Error("--task is required");
  if (!opts.answer) throw new Error("--answer is required");
  if (!opts.question_id) throw new Error("--question-id is required");
  const file = join(dir, fileFor(opts.task));
  if (!existsSync(file)) throw new Error(`no report file found for task ${opts.task}`);
  const now = new Date().toISOString();
  let workerAgent = null;
  let entry = null;

  withLock(file, () => {
    const prev = readEntry(file);
    assertTaskRecord(prev, opts.task);
    const messageId = requestId("reply", opts.id, {
      task: opts.task,
      run: opts.run ?? process.env.ORCH_RUN ?? prev.run,
      answer: opts.answer,
      question_id: opts.question_id,
      question: prev.pending_ask?.question ?? prev.last_reply?.question,
      ask: prev.pending_ask?.message_id ?? prev.last_reply?.ask_message_id
    });
    if (messageWasSeen(prev, messageId)) {
      if (prev.pending_ask) throw new Error(`reply message ${messageId} was already used while question ${prev.pending_ask.message_id} is pending`);
      entry = prev;
      return;
    }
    if (!prev.pending_ask) throw new Error(`no pending question for task ${opts.task}`);
    if (opts.question_id !== prev.pending_ask.message_id) {
      throw new Error(`stale question reply for task ${opts.task}; expected ${prev.pending_ask.message_id}`);
    }
    workerAgent = prev.agent;
    entry = {
      ...prev,
      seq: (prev.seq ?? 0) + 1,
      message_id: messageId,
      message_ids: messageHistory(prev, messageId),
      state: "WORKING",
      lifecycle: deriveLifecycle("WORKING"),
      pending_ask: null,
      last_reply: {
        answer: opts.answer,
        question: prev.pending_ask.question,
        ask_message_id: prev.pending_ask.message_id,
        question_id: prev.pending_ask.message_id,
        message_id: messageId,
        replied_at: now
      },
      summary: `[ANSWERED] ${opts.answer}`,
      updated_at: now,
    };
    persistEntry(dir, file, entry, { event: "reply", task: opts.task, answer: opts.answer, timestamp: now });
  });

  if (workerAgent) {
    const msg = `[ANSWER from Master] ${opts.answer}`;
    notifyAgent(workerAgent, msg, { nonBlocking: opts.nonBlocking ?? true, sender: currentAgentName() });
  }
  if (!opts.silent) {
    console.log(`Reply sent to ${opts.task}`);
  }
  return entry;
}

export function liveAgents() {
  try {
    const list = spawnSync("herdr", ["agent", "list"], { encoding: "utf8" });
    if (list.error || list.status !== 0) return null;
    const byName = new Map();
    for (const a of JSON.parse(list.stdout).result.agents) if (a.name) byName.set(a.name, a);
    return byName;
  } catch {
    return null;
  }
}

export function status(opts) {
  const dir = runDir(opts);
  const staleMs = Number(opts["stale-min"] ?? 10) * 60_000;
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
  if (opts.json === "true") return console.log(JSON.stringify(rows, null, 2));
  console.table(rows);
  const open = rows.filter((r) => r.flag !== "OK").length;
  console.log(open ? `${open} task(s) need master action` : "all tasks on track or closed");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  try {
    if (cmd === "report") report(parse(rest));
    else if (cmd === "status") status(parse(rest));
    else if (cmd === "ask") ask(parse(rest));
    else if (cmd === "reply") reply(parse(rest));
    else if (cmd === "evidence") {
      const opts = parse(rest);
      const dir = runDir(opts);
      if (opts.ref) console.log(readEvidence(dir, opts.ref));
      else if (opts.content) console.log(storeEvidence(dir, opts.content));
      else throw new Error("--ref or --content required for evidence command");
    }
    else throw new Error("usage: mailbox.mjs report|status|ask|reply|evidence --run R [...]");
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }
}
