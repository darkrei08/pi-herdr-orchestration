import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { buildWorktreePlan } from "./worktree-factory.mjs";

// Fixed identity and dates keep the candidate hash stable across runs.
const IDENTITY = ["-c", "user.name=Isolated Fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false", "-c", "core.autocrlf=false"];
const DATE = "2026-11-26T00:00:00 +0000";
const ENV = {
  GIT_AUTHOR_NAME: "Isolated Fixture",
  GIT_AUTHOR_EMAIL: "fixture@example.invalid",
  GIT_COMMITTER_NAME: "Isolated Fixture",
  GIT_COMMITTER_EMAIL: "fixture@example.invalid",
  GIT_AUTHOR_DATE: DATE,
  GIT_COMMITTER_DATE: DATE,
  GIT_TERMINAL_PROMPT: "0",
};

export function fixtureGit(cwd, args) {
  return execFileSync("git", ["-C", cwd, ...IDENTITY, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, ...ENV } });
}

function write(root, path, text) {
  const file = join(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

export function createIsolatedCommitCandidate(root, { slug, subject }) {
  fixtureGit(root, ["init", "-b", "main"]);
  write(root, "README.md", "# isolated commit fixture\n");
  write(root, ".gitignore", ".worktrees/\n");
  write(root, "src/app.txt", "baseline\n");
  fixtureGit(root, ["add", "-A"]);
  fixtureGit(root, ["commit", "-m", "fixture baseline"]);
  const baseline = fixtureGit(root, ["rev-parse", "HEAD"]).trim();

  write(root, "src/app.txt", "baseline\noperator local edit\n");
  write(root, "scratch.local.md", "operator scratch notes\n");
  const rootDirty = ["src/app.txt", "scratch.local.md"].map((path) => ({ path, bytes: readFileSync(join(root, path)) }));

  const plan = buildWorktreePlan(slug, root, baseline);
  fixtureGit(root, plan.args);
  write(plan.path, "src/scoped.txt", "scoped change\n");
  fixtureGit(plan.path, ["add", "-A"]);
  fixtureGit(plan.path, ["commit", "-m", subject]);
  const candidate = fixtureGit(plan.path, ["rev-parse", "HEAD"]).trim();

  return { branch: plan.branch, worktree: plan.path, baseline, candidate, rootDirty };
}
