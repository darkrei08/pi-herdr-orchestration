#!/usr/bin/env node

import { spawnSync } from "node:child_process";
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
  const candidates = process.platform === "win32"
    ? [command, `${command}.cmd`, `${command}.exe`]
    : [command];
  for (const candidate of candidates) {
    try {
      const result = spawnSync(candidate, [].concat(flag), {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        shell: process.platform === "win32" && candidate.endsWith(".cmd"),
      });
      if (!result.error && result.status === 0) return result.stdout.trim().split("\n")[0];
    } catch {
      // Try the next platform-specific executable name.
    }
  }
  return null;
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
    join(home, ".pi", "agent", "packages", name, "package.json"),
    join(home, ".pi", "agent", "npm", "node_modules", name, "package.json"),
    join(home, ".pi", "agent", "node_modules", name, "package.json"),
    join(wizardRoot, "node_modules", name, "package.json"),
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

function wizardVenv() {
  const candidates = process.platform === "win32"
    ? [
      join(wizardRoot, ".venv", "Scripts", "python.exe"),
      join(wizardRoot, "venv", "Scripts", "python.exe"),
    ]
    : [
      join(wizardRoot, ".venv", "bin", "python"),
      join(wizardRoot, "venv", "bin", "python"),
    ];
  return candidates.find(existsSync) || null;
}

function pythonImports(python, modules) {
  if (!python) return {};
  const code = "import importlib.util,json,sys; print(json.dumps({name: importlib.util.find_spec(name) is not None for name in sys.argv[1:]}))";
  const result = spawnSync(python, ["-c", code, ...modules], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (result.error || result.status !== 0) return {};
  try {
    return JSON.parse(result.stdout);
  } catch {
    return {};
  }
}

const checks = [];
checks.push(record("skill", existsSync(join(skillRoot, "SKILL.md")) ? "installed" : "blocked", {
  path: join(skillRoot, "SKILL.md"),
  required_for: ["pi-herdr-orchestrator"],
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

for (const [id, command, requiredFor, flag] of [
  ["pi", "pi", ["Pi sessions"]],
  ["gga", "gga", ["optional quality gate"]],
  ["herdr", "herdr", ["optional workspace layout"]],
  ["skills-cli", "skills", ["cross-agent skill installation"]],
  ["serena", "serena", ["optional semantic navigation"]],
  ["rtk", "rtk", ["optional output reduction"]],
  ["sqz", "sqz", ["optional output reduction"]],
  ["gh", "gh", ["optional issue and PR provider"]],
  ["docker", "docker", ["optional runtime validation"]],
  ["docker-compose", "docker", ["optional Compose validation"], ["compose", "version"]],
]) {
  const version = commandVersion(command, flag);
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
const wizardContextFormatsPath = join(wizardRoot, "scripts", "wz-ai-context-formats.js");
const wizardPython = wizardVenv();
const wizardImports = pythonImports(wizardPython, ["graphify", "graphifyy", "llmlingua"]);
const toonPackage = findPackage("@toon-format/toon");
const toonDetected = existsSync(wizardContextPath) || Boolean(toonPackage);
const leaDetected = existsSync(wizardContextPath) || existsSync(wizardContextFormatsPath);
checks.push(record("wizard-ai-context", existsSync(wizardContextPath) ? "installed" : "missing", {
  path: existsSync(wizardContextPath) ? wizardContextPath : null,
  root: wizardRoot,
  required_for: ["TOON and LEA context adapters"],
}));
checks.push(record("toon-lea", toonDetected || leaDetected ? "installed" : "missing", {
  toon: toonDetected,
  lea: leaDetected,
  context_path: existsSync(wizardContextPath) ? wizardContextPath : null,
  formats_path: existsSync(wizardContextFormatsPath) ? wizardContextFormatsPath : null,
  required_for: ["bounded context encoding and evidence aliases"],
}));
checks.push(record("graphify", commandVersion("graphify") || commandVersion("graphifyy") || wizardImports.graphify || wizardImports.graphifyy ? "installed" : "missing", {
  command: commandVersion("graphify") ? "graphify" : commandVersion("graphifyy") ? "graphifyy" : null,
  venv: wizardImports.graphify || wizardImports.graphifyy ? wizardPython : null,
  required_for: ["optional architecture graphs"],
}));
checks.push(record("llmlingua", wizardImports.llmlingua ? "installed" : "missing", {
  venv: wizardImports.llmlingua ? wizardPython : null,
  required_for: ["Wizard-AI context reduction"],
}));

const codexContext = findPackage("pi-codex-context");
checks.push(record("pi-codex-context", codexContext ? "installed" : "missing", {
  path: codexContext?.path ?? null,
  version: codexContext?.version ?? null,
  source: codexContext ? "Vekexasia Pi package directory or package metadata" : null,
  required_for: ["Pi context compaction ownership"],
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
const codexContextPackage = findPackage("pi-codex-context");
const vccPackage = findPackage("@sting8k/pi-vcc") || findPackage("@adamjen/pi-vcc");
const configuredCodexContext = configuredPackages.some((source) => source.includes("pi-codex-context"));
const configuredVcc = configuredPackages.some((source) => source.includes("pi-vcc"));
const vccConfig = readJson(join(home, ".pi", "agent", "pi-vcc-config.json"));
let compactionOwner = "pi-core";
let compactionStatus = "installed";
if (configuredVcc) {
  compactionOwner = "conflict";
  compactionStatus = "incompatible";
} else if (configuredCodexContext || codexContextPackage) {
  compactionOwner = "pi-codex-context";
}
checks.push(record("pi-compaction-owner", compactionStatus, {
  owner: compactionOwner,
  settings_path: existsSync(settingsPath) ? settingsPath : null,
  configured_pi_codex_context: configuredCodexContext,
  detected_pi_codex_context: Boolean(codexContextPackage),
  pi_codex_context_path: codexContextPackage?.path ?? null,
  configured_pi_vcc: configuredVcc,
  detected_pi_vcc: Boolean(vccPackage),
  vcc_override: vccConfig?.overrideDefaultCompaction ?? null,
  required_for: ["single compaction owner"],
}));

const agentRoots = {
  pi: join(home, ".pi", "agent", "skills"),
  codex: join(home, ".codex", "skills"),
  "claude-code": join(home, ".claude", "skills"),
  antigravity: join(home, ".gemini", "config", "skills"),
  "antigravity-cli": join(home, ".gemini", "antigravity-cli", "skills"),
};
const universalRoot = join(home, ".agents", "skills");
for (const [agent, root] of Object.entries(agentRoots)) {
  const directPath = join(root, "pi-herdr-orchestrator", "SKILL.md");
  const universalPath = join(universalRoot, "pi-herdr-orchestrator", "SKILL.md");
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

// Skill families the orchestrator may route to; installed when any marker skill exists in a known root.
const skillRoots = [universalRoot, ...Object.values(agentRoots), join(home, ".pi", "agent", "npm", "node_modules", "gentle-pi", "skills")];
for (const [id, markers] of [
  ["skills-engineering-excellence", ["engineering-excellence"]],
  ["skills-matt-pocock", ["to-tickets", "triage", "setup-matt-pocock-skills"]],
  ["skills-gentle-ai", ["gentle-ai", "judgment-day", "work-unit-commits"]],
]) {
  const found = markers.filter((name) => skillRoots.some((root) => existsSync(join(root, name, "SKILL.md"))));
  checks.push(record(id, found.length ? "installed" : "missing", { skills: found, required_for: ["optional skill routing"] }));
}

const requiredIds = new Set(["skill", "node", "git", "pi-compaction-owner"]);
const requiredFailures = checks.filter((check) => requiredIds.has(check.id) && check.status !== "installed");
const result = {
  schema: "pi-herdr-orchestrator/capability-report-v1",
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
