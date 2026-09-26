#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const home = homedir();
const wizardRoot = resolve(process.env.WIZARD_AI_DIR || join(home, ".wizard-ai"));
const args = new Set(process.argv.slice(2));
const json = args.has("--json");
const strict = args.has("--strict");

function commandVersion(command, flag = "--version") {
  try {
    return execFileSync(command, [flag], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim().split("\n")[0];
  } catch {
    return null;
  }
}

function packageVersion(packagePath) {
  try {
    return JSON.parse(readFileSync(packagePath, "utf8")).version ?? null;
  } catch {
    return null;
  }
}

function findPackage(name) {
  const candidates = [
    join(process.cwd(), "node_modules", name, "package.json"),
    join(home, ".pi", "agent", "npm", "node_modules", name, "package.json"),
    join(home, ".pi", "agent", "node_modules", name, "package.json"),
  ];
  const path = candidates.find(existsSync);
  return path ? { path, version: packageVersion(path) } : null;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function record(id, status, details = {}) {
  return { id, status, ...details };
}

const checks = [];
checks.push(record("skill", existsSync(join(skillRoot, "SKILL.md")) ? "installed" : "blocked", {
  path: join(skillRoot, "SKILL.md"),
  required_for: ["repository-orchestrator"],
}));
for (const [id, command, requiredFor] of [
  ["node", "node", ["verification-script"]],
  ["git", "git", ["repository-discovery"]],
]) {
  const version = commandVersion(command);
  checks.push(record(id, version ? "installed" : "missing", {
    command,
    version,
    required_for: requiredFor,
  }));
}

for (const [id, command, requiredFor] of [
  ["pi", "pi", ["Pi sessions"]],
  ["gga", "gga", ["optional quality gate"]],
  ["herdr", "herdr", ["optional workspace layout"]],
  ["skills-cli", "skills", ["cross-agent skill installation"]],
  ["serena", "serena", ["optional semantic navigation"]],
  ["graphify", "graphify", ["optional architecture graphs"]],
  ["rtk", "rtk", ["optional output reduction"]],
  ["sqz", "sqz", ["optional output reduction"]],
]) {
  const version = commandVersion(command);
  checks.push(record(id, version ? "installed" : "missing", {
    command,
    version,
    required_for: requiredFor,
  }));
}

const wizardConfigPath = join(wizardRoot, ".wizard-ai.json");
const wizardConfig = readJson(wizardConfigPath);
const wizardCommandPath = join(wizardRoot, "bin", "wizard-ai");
const wizardCommandVersion = commandVersion("wizard-ai");
checks.push(record("wizard-ai", wizardCommandVersion || wizardConfig ? "installed" : "missing", {
  command: "wizard-ai",
  path: wizardCommandVersion ? null : existsSync(wizardCommandPath) ? wizardCommandPath : null,
  version: wizardCommandVersion ?? wizardConfig?.version ?? null,
  source: wizardCommandVersion ? "PATH" : wizardConfig ? "Wizard-AI installation root" : null,
  required_for: ["optional guided setup"],
}));
const wizardContextPath = join(wizardRoot, "scripts", "wz-ai-context.js");
checks.push(record("wizard-ai-context", existsSync(wizardContextPath) ? "installed" : "missing", {
  path: existsSync(wizardContextPath) ? wizardContextPath : null,
  root: wizardRoot,
  required_for: ["TOON and LEA context adapters"],
}));

for (const [id, requiredFor] of [
  ["pi-extensible-workflows", ["workflow orchestration"]],
  ["gentle-pi", ["Gentle AI integration"]],
  ["gentle-engram", ["durable project memory"]],
  ["@sting8k/pi-vcc", ["optional Pi compaction"]],
  ["@adamjen/pi-vcc", ["optional Pi compaction"]],
]) {
  const found = findPackage(id);
  checks.push(record(id, found ? "installed" : "missing", {
    path: found?.path ?? null,
    version: found?.version ?? null,
    required_for: requiredFor,
  }));
}

const settingsPath = join(home, ".pi", "agent", "settings.json");
const piSettings = readJson(settingsPath);
const configuredPackages = Array.isArray(piSettings?.packages)
  ? piSettings.packages.map((entry) => typeof entry === "string" ? entry : entry?.source).filter(Boolean)
  : [];
const configuredCodexContext = configuredPackages.some((source) => source.includes("pi-codex-context"));
const configuredVcc = configuredPackages.some((source) => source.includes("pi-vcc"));
const vccConfig = readJson(join(home, ".pi", "agent", "pi-vcc-config.json"));
let compactionOwner = "pi-core";
let compactionStatus = "installed";
if (configuredCodexContext && configuredVcc && vccConfig?.overrideDefaultCompaction !== false) {
  compactionOwner = "conflict";
  compactionStatus = "incompatible";
} else if (configuredCodexContext) {
  compactionOwner = "pi-codex-context";
} else if (configuredVcc && vccConfig?.overrideDefaultCompaction !== false) {
  compactionOwner = "pi-vcc";
}
checks.push(record("pi-compaction-owner", compactionStatus, {
  owner: compactionOwner,
  settings_path: existsSync(settingsPath) ? settingsPath : null,
  configured_pi_codex_context: configuredCodexContext,
  configured_pi_vcc: configuredVcc,
  vcc_override: vccConfig?.overrideDefaultCompaction ?? null,
  required_for: ["single compaction owner"],
}));

const agentRoots = {
  codex: join(home, ".codex", "skills"),
  "claude-code": join(home, ".claude", "skills"),
  antigravity: join(home, ".gemini", "config", "skills"),
  "antigravity-cli": join(home, ".gemini", "antigravity-cli", "skills"),
};
const universalRoot = join(home, ".agents", "skills");
for (const [agent, root] of Object.entries(agentRoots)) {
  const directPath = join(root, "repository-orchestrator", "SKILL.md");
  const universalPath = join(universalRoot, "repository-orchestrator", "SKILL.md");
  const directInstalled = existsSync(directPath);
  const universalInstalled = existsSync(universalPath);
  const installedPath = directInstalled ? directPath : universalInstalled ? universalPath : null;
  checks.push(record(`skill-${agent}`, installedPath ? "installed" : existsSync(root) ? "missing" : "not_applicable", {
    path: installedPath,
    root,
    universal_root: universalRoot,
    resolution: directInstalled ? "agent-root" : universalInstalled ? "universal-root" : null,
    required_for: [agent],
  }));
}

const requiredIds = new Set(["skill", "node", "git", "pi-compaction-owner"]);
const requiredFailures = checks.filter((check) => requiredIds.has(check.id) && check.status !== "installed");
const result = {
  schema: "repository-orchestrator/capability-report-v1",
  skill_root: skillRoot,
  checks,
  summary: {
    installed: checks.filter((check) => check.status === "installed").length,
    missing: checks.filter((check) => check.status === "missing").length,
    incompatible: checks.filter((check) => check.status === "incompatible").length,
    required_failures: requiredFailures.length,
  },
};

if (json) console.log(JSON.stringify(result, null, 2));
else {
  for (const check of checks) console.log(`${check.status.toUpperCase().padEnd(13)} ${check.id}${check.version ? ` (${check.version})` : ""}`);
  console.log(`\nCompaction owner: ${compactionOwner}`);
  console.log(`Required failures: ${requiredFailures.length}`);
}

if (strict && requiredFailures.length > 0) process.exitCode = 1;
