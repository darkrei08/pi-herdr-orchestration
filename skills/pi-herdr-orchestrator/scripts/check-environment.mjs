#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, realpathSync, statfsSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolveCompactionOwner } from "./compaction-owner.mjs";

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

export function packageLocalGentleAiBinary(packagePath, readDir = readdirSync, exists = existsSync) {
  if (!packagePath) return null;
  const packageRoot = dirname(packagePath);
  let runtimes;
  try {
    runtimes = readDir(join(packageRoot, ".gentle-ai"));
  } catch {
    return null;
  }
  for (const runtime of runtimes) {
    const name = typeof runtime === "string" ? runtime : runtime.name;
    if (!/^v[^/]+$/.test(name)) continue;
    for (const binary of ["gentle-ai", "gentle-ai.exe"]) {
      const path = join(packageRoot, ".gentle-ai", name, binary);
      if (exists(path)) return path;
    }
  }
  return null;
}

function versionNumber(text) {
  if (typeof text !== "string") return null;
  const match = /(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/.exec(text);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ?? null,
  };
}

export function compareVersions(left, right) {
  const a = versionNumber(left);
  const b = versionNumber(right);
  if (!a || !b) return null;
  for (const key of ["major", "minor", "patch"]) {
    if (a[key] !== b[key]) return a[key] < b[key] ? -1 : 1;
  }
  if (a.prerelease === b.prerelease) return 0;
  if (!a.prerelease) return 1;
  if (!b.prerelease) return -1;
  return a.prerelease < b.prerelease ? -1 : 1;
}

export function parsePluginList(stdout) {
  let payload;
  try {
    payload = JSON.parse(stdout);
  } catch {
    return null;
  }
  const plugins = payload?.result?.plugins;
  return Array.isArray(plugins) ? plugins : null;
}

export function findPlugin(plugins, pluginId) {
  if (!Array.isArray(plugins)) return null;
  return plugins.find((plugin) => plugin?.plugin_id === pluginId) ?? null;
}

export function herdrPluginStatus(plugin, herdrVersion) {
  if (!plugin) return "missing";
  if (plugin.enabled === false) return "disabled";
  if (!plugin.min_herdr_version) return "installed";
  const comparison = compareVersions(plugin.min_herdr_version, herdrVersion);
  if (comparison === null) return "blocked";
  return comparison > 0 ? "incompatible" : "installed";
}

export function schemaProtocol(stdout) {
  let payload;
  try {
    payload = JSON.parse(stdout);
  } catch {
    return null;
  }
  return typeof payload?.protocol === "number" ? payload.protocol : null;
}

export function herdrAppPath({ platform = process.platform, home = homedir(), env = process.env } = {}, exists = existsSync) {
  const candidates = [];
  if (platform === "win32") {
    const localAppData = env.LOCALAPPDATA || join(home, "AppData", "Local");
    candidates.push(join(localAppData, "Programs", "herdr-app", "herdr-app.exe"));
  } else if (platform === "darwin") {
    candidates.push(join(home, "Applications", "Herdr.app", "Contents", "MacOS", "Herdr"));
    candidates.push(join("/Applications", "Herdr.app", "Contents", "MacOS", "Herdr"));
  } else {
    candidates.push(join(home, ".local", "bin", "herdr-app"));
    candidates.push(join(home, ".local", "share", "herdr-app", "herdr-app"));
  }
  return candidates.find((candidate) => exists(candidate)) ?? null;
}

export function heelerHostHelper(root, exists = existsSync, read = readJson) {
  const path = join(root, "app", "version.json");
  if (!exists(path)) return record("heeler-host-helper", "missing", { path, root });
  const metadata = read(path);
  const version = typeof metadata?.version === "string" ? metadata.version : null;
  if (!version) return record("heeler-host-helper", "blocked", { path, root, error: "unreadable version metadata" });
  return record("heeler-host-helper", "installed", { path, root, version });
}

export function codegraphCheck(root = process.cwd(), version = commandVersion("codegraph"), exists = existsSync) {
  const indexPath = join(root, ".codegraph");
  const indexed = exists(indexPath);
  const availableVersion = typeof version === "string" && version.length ? version : null;
  return record("codegraph", availableVersion || indexed ? "installed" : "missing", {
    command: "codegraph",
    version: availableVersion,
    index_path: indexed ? indexPath : null,
    detection: "CLI version or worktree-local index; no mutation",
    required_for: ["optional indexed semantic navigation"],
  });
}

function herdrJson(args) {
  try {
    const result = spawnSync("herdr", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 15000,
    });
    if (result.error) return { error: result.error.message };
    if (result.status !== 0) return { error: `exit ${result.status}` };
    return { stdout: result.stdout };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

function record(id, status, details = {}) {
  return { id, status, ...details };
}

function projectSkillDirs(start) {
  const dirs = [];
  let current = resolve(start);
  while (true) {
    const candidate = join(current, ".agents", "skills");
    if (existsSync(candidate)) dirs.push(candidate);
    if (existsSync(join(current, ".git"))) break;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return dirs;
}

export function projectSkillCollisionCheck(
  projectRoot = process.cwd(),
  universalRoot = join(home, ".agents", "skills"),
  { exists = existsSync, readDir = readdirSync, realPath = realpathSync } = {},
) {
  const collisions = [];
  for (const root of projectSkillDirs(projectRoot)) {
    for (const entry of readDir(root, { withFileTypes: true })) {
      const name = entry.name;
      const projectPath = join(root, name);
      const universalPath = join(universalRoot, name);
      if (!exists(join(projectPath, "SKILL.md")) || !exists(join(universalPath, "SKILL.md"))) continue;
      let samePath = false;
      try {
        samePath = realPath(projectPath) === realPath(universalPath);
      } catch {
        samePath = false;
      }
      if (!samePath) collisions.push({ name, project_path: projectPath, universal_path: universalPath });
    }
  }
  return record("project-skill-collisions", collisions.length ? "incompatible" : "installed", {
    collisions,
    required_for: ["deterministic project skill resolution"],
  });
}

export function tempHeadroomCheck(path = tmpdir(), statfs = statfsSync) {
  try {
    const stats = statfs(path);
    const totalBytes = Number(stats.blocks) * Number(stats.bsize);
    const freeBytes = Number(stats.bavail) * Number(stats.bsize);
    const freeRatio = totalBytes > 0 ? freeBytes / totalBytes : 0;
    return record("temp-headroom", freeRatio >= 0.1 ? "installed" : "blocked", {
      path,
      free_bytes: freeBytes,
      total_bytes: totalBytes,
      free_ratio: freeRatio,
    });
  } catch (error) {
    return record("temp-headroom", "blocked", {
      path,
      error: error instanceof Error ? error.message : String(error),
    });
  }
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

function main() {
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
  ["rtk", "rtk", ["optional output reduction"]],
  ["sqz", "sqz", ["optional output reduction"]],
  ["gh", "gh", ["optional issue and PR provider"]],
  ["docker", "docker", ["optional runtime validation"]],
  ["docker-compose", "docker", ["optional Compose validation"], ["compose", "version"]],
  ["cargo", "cargo", ["optional Rust graph core"]],
  ["rustc", "rustc", ["optional Rust graph core"]],
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
checks.push(codegraphCheck());

const codexContext = findPackage("pi-codex-context");
checks.push(record("pi-codex-context", codexContext ? "installed" : "missing", {
  path: codexContext?.path ?? null,
  version: codexContext?.version ?? null,
  source: codexContext ? "Vekexasia Pi package directory or package metadata" : null,
  required_for: ["Pi context compaction ownership"],
}));

for (const [id, requiredFor] of [
  ["pi-extensible-workflows", ["workflow orchestration"]],
  ["@piewf/pi-ext-roles", ["role-based workflow dispatch"]],
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

  const herdrVersion = commandVersion("herdr");
  const herdrCoreVersion = commandVersion("herdr-core");
  const hcVersion = commandVersion("hc");
  checks.push(record("herdr-core", herdrCoreVersion || hcVersion ? "installed" : "missing", {
    commands: { "herdr-core": herdrCoreVersion, hc: hcVersion },
    version: herdrCoreVersion ?? hcVersion,
    required_for: ["Herdr core runtime"],
  }));
  const schemaProbe = herdrVersion ? herdrJson(["api", "schema", "--json"]) : { error: "herdr CLI unavailable" };
  const protocol = schemaProbe.stdout ? schemaProtocol(schemaProbe.stdout) : null;
  let protocolStatus = "missing";
  if (herdrVersion) protocolStatus = protocol === null ? "blocked" : "installed";
  checks.push(record("herdr-protocol", protocolStatus, {
    protocol,
    source: "herdr api schema --json",
    error: protocol === null ? schemaProbe.error ?? "unrecognized schema metadata" : null,
    required_for: ["Herdr socket API compatibility"],
  }));
  const pluginProbe = herdrVersion ? herdrJson(["plugin", "list", "--json"]) : { error: "herdr CLI unavailable" };
  const pluginList = pluginProbe.stdout ? parsePluginList(pluginProbe.stdout) : null;
  const heelerPlugin = findPlugin(pluginList, "heeler");
  let heelerStatus = "missing";
  if (herdrVersion) heelerStatus = pluginList === null ? "blocked" : herdrPluginStatus(heelerPlugin, herdrVersion);
  checks.push(record("heeler-plugin", heelerStatus, {
    plugin_id: heelerPlugin?.plugin_id ?? null,
    version: heelerPlugin?.version ?? null,
    enabled: heelerPlugin?.enabled ?? null,
    min_herdr_version: heelerPlugin?.min_herdr_version ?? null,
    platforms: heelerPlugin?.platforms ?? [],
    plugin_root: heelerPlugin?.plugin_root ?? null,
    source: heelerPlugin?.source?.kind ?? null,
    herdr_version: herdrVersion,
    error: heelerStatus === "blocked" ? pluginProbe.error ?? "unrecognized plugin list payload" : null,
    required_for: ["Heeler pairing and notifications through the Herdr plugin"],
  }));
  const desktopApp = herdrAppPath();
  checks.push(record("herdr-app", desktopApp ? "installed" : "missing", {
    path: desktopApp,
    detection: "install path presence only; no platform support claim",
    required_for: ["optional Herdr desktop client"],
  }));
  checks.push(heelerHostHelper(join(home, ".local", "share", "heeler", "host-helper")));

const gentlePi = findPackage("gentle-pi");
const gentleAiBinary = packageLocalGentleAiBinary(gentlePi?.path);
checks.push(record("gentle-pi-package-binary", gentlePi
  ? gentleAiBinary ? "installed" : "incompatible"
  : "missing", {
  path: gentleAiBinary,
  package_path: gentlePi?.path ?? null,
  required_for: ["Gentle AI native review status"],
}));

const settingsPath = join(home, ".pi", "agent", "settings.json");
const piSettings = readJson(settingsPath);
const configuredPackages = Array.isArray(piSettings?.packages)
  ? piSettings.packages.map((entry) => typeof entry === "string" ? entry : entry?.source).filter(Boolean)
  : [];
const codexContextPackage = findPackage("pi-codex-context");
const vccPackage = findPackage("@sting8k/pi-vcc") || findPackage("@adamjen/pi-vcc");
const configuredCodexContext = configuredPackages.some((source) => source.includes("pi-codex-context"));
const configuredVcc = configuredPackages.some((source) => ["@sting8k/pi-vcc", "@adamjen/pi-vcc"].some((name) => source.includes(name)));
const vccConfig = readJson(join(home, ".pi", "agent", "pi-vcc-config.json"));
const compaction = resolveCompactionOwner({ configuredVcc, configuredCodexContext });
checks.push(record("pi-compaction-owner", compaction.status, {
  owner: compaction.owner,
  settings_path: existsSync(settingsPath) ? settingsPath : null,
  configured_pi_codex_context: configuredCodexContext,
  detected_pi_codex_context: Boolean(codexContextPackage),
  pi_codex_context_path: codexContextPackage?.path ?? null,
  configured_pi_vcc: configuredVcc,
  detected_pi_vcc: Boolean(vccPackage),
  vcc_override: vccConfig?.overrideDefaultCompaction ?? null,
  required_for: ["single compaction owner"],
}));

const rustManifest = join(process.cwd(), "rust", "orchestrator-core", "Cargo.toml");
const rustReady = existsSync(rustManifest) && Boolean(commandVersion("cargo")) && Boolean(commandVersion("rustc"));
checks.push(record("rust-orchestrator-core", rustReady ? "installed" : existsSync(rustManifest) ? "blocked" : "not_applicable", {
  manifest: existsSync(rustManifest) ? rustManifest : null,
  required_for: ["optional graph planning accelerator"],
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

checks.push(projectSkillCollisionCheck());
checks.push(tempHeadroomCheck());
const requiredIds = new Set(["skill", "node", "git", "pi-compaction-owner", "temp-headroom", "project-skill-collisions"]);
const requiredFailures = checks.filter((check) => requiredIds.has(check.id) && check.status !== "installed");
const result = {
  schema: "pi-herdr-orchestrator/capability-report-v1",
  skill_root: skillRoot,
  checks,
  summary: {
    installed: checks.filter((check) => check.status === "installed").length,
    missing: checks.filter((check) => check.status === "missing").length,
    incompatible: checks.filter((check) => check.status === "incompatible").length,
    blocked: checks.filter((check) => check.status === "blocked").length,
    disabled: checks.filter((check) => check.status === "disabled").length,
    required_failures: requiredFailures.length,
  },
};

if (json) console.log(JSON.stringify(result, null, 2));
else {
  for (const check of checks) console.log(`${check.status.toUpperCase().padEnd(13)} ${check.id}${check.version ? ` (${check.version})` : ""}`);
  console.log(`\nCompaction owner: ${compaction.owner}`);
  console.log(`Required failures: ${requiredFailures.length}`);
}

  if (strict && requiredFailures.length > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
