import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { report, storeEvidence, validateEvidenceBinding, verifyBindingChain } from "./mailbox.mjs";

const PROFILE_PATH = "skills/pi-herdr-orchestrator/reviewer-profile.gga";

const git = (cwd, args) => spawnSync("git", args, { cwd, encoding: "utf8" });

function makeCandidateRepo() {
  const root = mkdtempSync(join(tmpdir(), "orch-review-profile-"));
  git(root, ["init", "-b", "main"]);
  git(root, ["config", "user.email", "test@example.invalid"]);
  git(root, ["config", "user.name", "Test"]);
  mkdirSync(join(root, "skills", "pi-herdr-orchestrator"), { recursive: true });
  writeFileSync(join(root, "AGENTS.md"), "# Review rules\n");
  writeFileSync(join(root, PROFILE_PATH), "PROVIDER=\"kilo:reviewer-model\"\nSTRICT_MODE=\"true\"\n");
  writeFileSync(join(root, "code.mjs"), "export const ok = true;\n");
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "candidate"]);
  return { root, candidate: git(root, ["rev-parse", "HEAD"]).stdout.trim() };
}

function makeReview(root, task, candidate, includeProfile) {
  const paths = ["AGENTS.md", PROFILE_PATH, "code.mjs"];
  const file_hashes = {};
  for (const path of paths) {
    const content = git(root, ["show", `${candidate}:${path}`]).stdout;
    file_hashes[path] = createHash("sha256").update(content).digest("hex");
  }
  const rules = git(root, ["show", `${candidate}:AGENTS.md`]).stdout;
  const digest = createHash("sha256").update("AGENTS.md\\0").update(rules);
  if (includeProfile) {
    const profile = git(root, ["show", `${candidate}:${PROFILE_PATH}`]).stdout;
    digest.update(`${PROFILE_PATH}\\0`).update(profile);
  }
  return {
    task,
    run: "run-test",
    candidate,
    provider: "gga",
    status: "PASS",
    version: "2.10.1",
    config_digest: digest.digest("hex"),
    output_digest: "0".repeat(64),
    file_hashes,
    deleted_files: [],
  };
}

test("config digest binds the repository-tracked reviewer profile", () => {
  const { root, candidate } = makeCandidateRepo();
  const dir = mkdtempSync(join(tmpdir(), "orch-review-profile-evidence-"));
  const previousCwd = process.cwd();
  try {
    const task = "I#profile-digest";
    const review = makeReview(root, task, candidate, true);
    const reviewRef = storeEvidence(dir, JSON.stringify(review));
    const memory = { task, run: "run-test", candidate, provider: "engram", status: "PERSISTED", ref: "engram:obs-profile-digest" };
    memory.receipt = storeEvidence(dir, JSON.stringify(memory));
    const binding = { task, run: "run-test", candidate, review: { ...review, ref: reviewRef }, memory };
    const options = {
      dir,
      run: "run-test",
      task,
      candidate,
      state: "READY",
      summary: "Profile digest verified",
      checks: ["unit=PASS"],
      required_checks: ["unit"],
      evidence_binding: binding,
      providerVerifier: () => ({ status: "verified" }),
      silent: true,
      nonBlocking: true,
    };
    process.chdir(root);
    assert.equal(report(options).state, "READY");

    const agentsOnly = makeReview(root, task, candidate, false);
    agentsOnly.ref = storeEvidence(dir, JSON.stringify(agentsOnly));
    assert.equal(report({ ...options, evidence_binding: { ...binding, review: agentsOnly } }).state, "BLOCKED");
  } finally {
    process.chdir(previousCwd);
    rmSync(root, { recursive: true, force: true });
    rmSync(dir, { recursive: true, force: true });
  }
});

test("binding chain compares the real digest at call sites", () => {
  const { root, candidate } = makeCandidateRepo();
  const dir = mkdtempSync(join(tmpdir(), "orch-binding-chain-"));
  const previousCwd = process.cwd();
  const task = "I#binding-chain";
  const expected = { task, run: "run-test", candidate };
  try {
    const review = makeReview(root, task, candidate, true);
    review.ref = storeEvidence(dir, JSON.stringify(review));
    const memory = { task, run: "run-test", candidate, provider: "engram", status: "PERSISTED", ref: "engram:obs-binding-chain" };
    memory.receipt = storeEvidence(dir, JSON.stringify(memory));
    const binding = { task, run: "run-test", candidate, review, memory };
    process.chdir(root);

    assert.equal(verifyBindingChain(dir, binding, expected).status, "verified");

    const forged = { ...review, config_digest: "0".repeat(64) };
    forged.ref = storeEvidence(dir, JSON.stringify(forged));
    const forgedBinding = { ...binding, review: forged };
    assert.equal(validateEvidenceBinding(forgedBinding, expected).status, "verified");
    assert.equal(verifyBindingChain(dir, forgedBinding, expected).status, "blocked");
  } finally {
    process.chdir(previousCwd);
    rmSync(root, { recursive: true, force: true });
    rmSync(dir, { recursive: true, force: true });
  }
});
