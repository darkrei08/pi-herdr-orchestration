#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const help = args.includes("--help");

let dirIndex = args.indexOf("--dir");
if (dirIndex === -1) dirIndex = args.indexOf("-d");
const targetDir = resolve(dirIndex !== -1 && args[dirIndex + 1] ? args[dirIndex + 1] : process.cwd());

let nameIndex = args.indexOf("--name");
if (nameIndex === -1) nameIndex = args.indexOf("-n");
const projectName = nameIndex !== -1 && args[nameIndex + 1] ? args[nameIndex + 1] : basename(targetDir);

if (help) {
  console.log(`Usage: node init-repository.mjs [options]

Initialize all Pi Herdr Orchestration frameworks and dependencies for a repository/project.

Options:
  --apply          Perform mutations (default is read-only dry run)
  --dir, -d <path> Target repository directory (default: current working directory)
  --name, -n <name> Project/repository name (default: directory basename)
  --help, -h       Show this help message`);
  process.exit(0);
}

let failures = 0;
const home = homedir();

function commandAvailable(command) {
  try {
    const res = spawnSync(command, ["--version"], { stdio: "ignore" });
    return !res.error && res.status === 0;
  } catch {
    return false;
  }
}

function runCmd(command, cmdArgs, cwd = targetDir, options = {}) {
  const label = apply ? "RUN" : "PLAN";
  console.log(`${label}: ${command} ${cmdArgs.join(" ")} (in ${cwd})`);
  if (!apply) return true;
  const spawnOpts = {
    cwd,
    stdio: options.input !== undefined ? ["pipe", "inherit", "inherit"] : "inherit",
  };
  if (options.input !== undefined) spawnOpts.input = options.input;
  const res = spawnSync(command, cmdArgs, spawnOpts);
  if (res.error || res.status !== 0) {
    failures += 1;
    console.log(`FAIL: ${command} failed with exit code ${res.status}`);
    return false;
  }
  return true;
}

function status(id, state, details = "") {
  console.log(`${state.toUpperCase().padEnd(13)} ${id}${details ? ` - ${details}` : ""}`);
}

console.log(`Repository Initialization: ${apply ? "APPLY" : "DRY RUN (no mutations)"}`);
console.log(`Target directory : ${targetDir}`);
console.log(`Project name     : ${projectName}`);
console.log(`Use --apply to execute planned mutations.\n`);

// 1. Git Initialization
const isGitRepo = existsSync(join(targetDir, ".git"));
if (isGitRepo) {
  status("git", "configured", "existing Git repository detected");
} else {
  status("git", "pending", "directory is not a Git repository");
  runCmd("git", ["init", "-b", "main"]);
}

// 2. Worktrees Directory & .gitignore
const gitignorePath = join(targetDir, ".gitignore");
const worktreesDir = join(targetDir, ".worktrees");
const requiredIgnores = [".worktrees/", ".codegraph/", ".atl/"];

let gitignoreContent = "";
if (existsSync(gitignorePath)) {
  gitignoreContent = readFileSync(gitignorePath, "utf8");
}

const missingIgnores = requiredIgnores.filter((entry) => !gitignoreContent.includes(entry));
if (missingIgnores.length === 0) {
  status("gitignore", "configured", "standard orchestration paths ignored");
} else {
  status("gitignore", "pending", `missing entries: ${missingIgnores.join(", ")}`);
  if (apply) {
    const updated = gitignoreContent + (gitignoreContent.endsWith("\n") || !gitignoreContent ? "" : "\n") +
      `\n# Pi Herdr Orchestration runtime state\n${missingIgnores.join("\n")}\n`;
    writeFileSync(gitignorePath, updated, "utf8");
    console.log(`WROTE ${gitignorePath}`);
  } else {
    console.log(`PLAN: append ${missingIgnores.join(", ")} to ${gitignorePath}`);
  }
}

if (existsSync(worktreesDir)) {
  status("worktrees", "configured", ".worktrees directory exists");
} else {
  status("worktrees", "pending", "create .worktrees directory");
  if (apply) {
    mkdirSync(worktreesDir, { recursive: true });
    console.log(`CREATED ${worktreesDir}`);
  } else {
    console.log(`PLAN: create ${worktreesDir}`);
  }
}

function resolveGitDir(cwd) {
  try {
    const res = spawnSync("git", ["rev-parse", "--git-dir"], { cwd, encoding: "utf8" });
    if (!res.error && res.status === 0 && res.stdout.trim()) {
      return resolve(cwd, res.stdout.trim());
    }
  } catch {}
  const candidate = join(cwd, ".git");
  try {
    if (existsSync(candidate)) {
      if (statSync(candidate).isDirectory()) return candidate;
      const content = readFileSync(candidate, "utf8").trim();
      if (content.startsWith("gitdir:")) {
        return resolve(cwd, content.slice(7).trim());
      }
    }
  } catch {}
  return null;
}

// 3. Engram Project Identity
const resolvedGitDir = resolveGitDir(targetDir);
if (resolvedGitDir && existsSync(resolvedGitDir)) {
  const engramIdentityPath = join(resolvedGitDir, "engram-project-identity.json");
  if (existsSync(engramIdentityPath)) {
    try {
      const data = JSON.parse(readFileSync(engramIdentityPath, "utf8"));
      status("engram", "configured", `project identity: ${data.project} (${data.id})`);
    } catch {
      status("engram", "misconfigured", "invalid identity JSON");
    }
  } else {
    status("engram", "pending", `provision project identity for ${projectName}`);
    if (apply) {
      const identity = {
        version: 1,
        id: randomUUID().replace(/-/g, ""),
        project: projectName,
      };
      writeFileSync(engramIdentityPath, JSON.stringify(identity, null, 2) + "\n", "utf8");
      console.log(`WROTE ${engramIdentityPath}`);
    } else {
      console.log(`PLAN: write ${engramIdentityPath}`);
    }
  }
} else {
  status("engram", "deferred", "waiting for git initialization");
}

// 4. Guardian Angel (.gga and AGENTS.md)
const ggaPath = join(targetDir, ".gga");
const agentsPath = join(targetDir, "AGENTS.md");

if (existsSync(ggaPath)) {
  status("gga", "configured", ".gga configuration exists");
} else {
  status("gga", "pending", "create repository .gga configuration");
  const ggaConfig = `# Gentleman Guardian Angel Configuration
PROVIDER="claude"
FILE_PATTERNS="*.ts,*.tsx,*.js,*.mjs,*.py,*.go,*.rs,*.md"
EXCLUDE_PATTERNS="*.test.*,*.spec.*,*.d.ts,node_modules/*,.worktrees/*"
RULES_FILE="AGENTS.md"
STRICT_MODE="true"
TIMEOUT="300"
`;
  if (apply) {
    writeFileSync(ggaPath, ggaConfig, "utf8");
    console.log(`WROTE ${ggaPath}`);
  } else {
    console.log(`PLAN: create ${ggaPath}`);
  }
}

if (existsSync(agentsPath)) {
  status("agents-rules", "configured", "AGENTS.md exists");
} else {
  status("agents-rules", "pending", "create repository AGENTS.md guidelines");
  const agentsConfig = `# Repository Guidelines

- Keep changes narrowly scoped to the requested repository behavior.
- Preserve unrelated user changes, untracked files, hooks, and local configuration.
- Prefer standard-library APIs and existing dependencies; avoid unnecessary additions.
- Keep code, comments, tests, and repository documentation in English.
- Run the documented checks relevant to each change and report blocked checks honestly.
- Do not commit, push, merge, or publish without explicit authorization.
`;
  if (apply) {
    writeFileSync(agentsPath, agentsConfig, "utf8");
    console.log(`WROTE ${agentsPath}`);
  } else {
    console.log(`PLAN: create ${agentsPath}`);
  }
}

// 5. Serena Semantic Navigation
if (commandAvailable("serena")) {
  const serenaProjectConfig = join(targetDir, ".serena");
  if (existsSync(serenaProjectConfig)) {
    status("serena", "configured", "project configuration exists (.serena)");
  } else {
    status("serena", "pending", "initialize Serena project");
    runCmd("serena", ["project", "create", targetDir, "--name", projectName], targetDir, { input: "n\nn\nn\n" });
  }
} else {
  status("serena", "skipped", "serena CLI not installed");
}

// 6. sqz / rtk Output Reduction
if (commandAvailable("sqz")) {
  const claudeSettings = join(targetDir, ".claude", "settings.local.json");
  if (existsSync(claudeSettings)) {
    status("sqz", "configured", "project hook detected");
  } else {
    status("sqz", "pending", "install sqz project hooks");
    runCmd("sqz", ["init", "-y"]);
  }
} else {
  status("sqz", "skipped", "sqz CLI not installed");
}

if (commandAvailable("rtk")) {
  status("rtk", "configured", "global RTK reducer detected");
} else {
  status("rtk", "skipped", "rtk CLI not installed");
}

// 7. Herdr Workspace Integration
if (commandAvailable("herdr")) {
  try {
    const listRes = spawnSync("herdr", ["workspace", "list"], { encoding: "utf8" });
    if (!listRes.error && listRes.status === 0) {
      const data = JSON.parse(listRes.stdout);
      const workspaces = data?.result?.workspaces || [];
      const match = workspaces.find((w) => w.label === projectName || w.worktree?.repo_root === targetDir || w.worktree?.checkout_path === targetDir);
      if (match) {
        status("herdr", "configured", `workspace "${match.label}" (${match.workspace_id})`);
      } else {
        status("herdr", "pending", `create Herdr workspace "${projectName}"`);
        runCmd("herdr", ["workspace", "create", "--cwd", targetDir, "--label", projectName, "--no-focus"]);
      }
    } else {
      status("herdr", "idle", "Herdr server not responding or not running");
    }
  } catch {
    status("herdr", "idle", "could not query Herdr workspace list");
  }
} else {
  status("herdr", "skipped", "herdr CLI not installed");
}

// 8. Skill Registry Index
const atlDir = join(targetDir, ".atl");
const registryFile = join(atlDir, "skill-registry.md");
if (existsSync(registryFile)) {
  status("skill-registry", "configured", ".atl/skill-registry.md present");
} else {
  status("skill-registry", "pending", "create .atl/skill-registry.md");
  if (apply) {
    mkdirSync(atlDir, { recursive: true });
    const registryContent = `# Skill Registry — ${projectName}

| Skill | Trigger / description | Scope | Path |
| --- | --- | --- | --- |
| \`pi-herdr-orchestrator\` | Deterministic multi-agent repository orchestration | project | \`/root/.agents/skills/pi-herdr-orchestrator/SKILL.md\` |
| \`engineering-excellence\` | Software engineering standards, testing and quality gates | user | \`/root/.agents/skills/engineering-excellence/SKILL.md\` |
| \`gentle-ai\` | Harness discipline, RDD review authority and memory | user | \`/root/.agents/skills/gentle-ai/SKILL.md\` |
| \`triage\` | Move issues and PRs through triage state machine | user | \`/root/.agents/skills/triage/SKILL.md\` |
| \`to-tickets\` | Decompose specs into atomic ticket graphs | user | \`/root/.agents/skills/to-tickets/SKILL.md\` |
| \`diagnosing-bugs\` | Reproduction feedback loop before fixes | user | \`/root/.agents/skills/diagnosing-bugs/SKILL.md\` |
| \`tdd\` | Test-driven development workflows | user | \`/root/.agents/skills/tdd/SKILL.md\` |
| \`code-review\` | Standards and spec review | user | \`/root/.agents/skills/code-review/SKILL.md\` |
| \`work-unit-commits\` | Plan reviewable atomic work units | user | \`/root/.agents/skills/work-unit-commits/SKILL.md\` |
| \`chained-pr\` | Split oversized PRs into chained review slices | user | \`/root/.agents/skills/chained-pr/SKILL.md\` |
| \`judgment-day\` | Dual blind or adversarial reviews | user | \`/root/.agents/skills/judgment-day/SKILL.md\` |
`;
    writeFileSync(registryFile, registryContent, "utf8");
    console.log(`WROTE ${registryFile}`);
  } else {
    console.log(`PLAN: create ${registryFile}`);
  }
}

console.log(`\nResult: ${failures === 0 ? (apply ? "completed successfully" : "dry run complete") : `failed (${failures})`}`);
if (failures > 0) process.exitCode = 1;
