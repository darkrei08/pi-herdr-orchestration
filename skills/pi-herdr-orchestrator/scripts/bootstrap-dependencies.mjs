#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const home = homedir();
const wizardRoot = resolve(process.env.WIZARD_AI_DIR || join(home, ".wizard-ai"));
const apply = process.argv.includes("--apply");
const help = process.argv.includes("--help");
let failures = 0;

const WIZARD_SETUP = ["npx", ["--no-cache", "-y", "@darkrei08/wizard-ai-cli@latest", "setup", "--verbose"]];
const GRAPHIFY_INSTALL = ["uv", ["tool", "install", "--force", "graphifyy[all]"]];
const LLMLINGUA_INSTALL = ["uv", ["pip", "install", "--python"]];
const GENTLE_INSTALL_URL = "https://raw.githubusercontent.com/Gentleman-Programming/gentle-ai/main/scripts/install.sh";
const GGA_REPOSITORY_URL = "https://github.com/Gentleman-Programming/gentleman-guardian-angel";
const HERDR_INSTALL_URL = "https://herdr.dev/install.sh";
const HERDR_INSTALL_PS1 = "https://herdr.dev/install.ps1";
const RTK_INSTALL_URL = "https://raw.githubusercontent.com/rtk-ai/rtk/master/install.sh";
const SQZ_INSTALL_URL = "https://raw.githubusercontent.com/ojuschugh1/sqz/main/install.sh";
const SQZ_INSTALL_PS1 = "https://raw.githubusercontent.com/ojuschugh1/sqz/main/install.ps1";

function printHelp() {
  console.log(`Usage: node bootstrap-dependencies.mjs [--apply] [--help]

Default mode is a read-only dry run. Use --apply to run official installers.
The bootstrap detects existing commands and configuration before each action.`);
}

if (help) {
  printHelp();
  process.exit(0);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function packagePath(name) {
  const candidates = [
    join(process.cwd(), "node_modules", name, "package.json"),
    join(home, ".pi", "agent", "packages", name, "package.json"),
    join(home, ".pi", "agent", "npm", "node_modules", name, "package.json"),
    join(home, ".pi", "agent", "node_modules", name, "package.json"),
    join(wizardRoot, "node_modules", name, "package.json"),
  ];
  return candidates.find(existsSync) || null;
}

function configuredSources(settings) {
  return Array.isArray(settings?.packages)
    ? settings.packages
      .map((entry) => typeof entry === "string" ? entry : entry?.source)
      .filter(Boolean)
    : [];
}

function executable(command) {
  const candidates = process.platform === "win32"
    ? [command, `${command}.cmd`, `${command}.exe`]
    : [command];
  for (const candidate of candidates) {
    try {
      const result = spawnSync(candidate, ["--version"], {
        stdio: "ignore",
        shell: process.platform === "win32" && candidate.endsWith(".cmd"),
      });
      if (!result.error) return candidate;
    } catch {
      // Try the next platform-specific executable name.
    }
  }
  return null;
}

function commandAvailable(command) {
  return executable(command) !== null;
}

function commandSucceeds(command, args) {
  const actual = executable(command);
  if (!actual) return false;
  const result = spawnSync(actual, args, {
    stdio: "ignore",
    shell: process.platform === "win32" && actual.endsWith(".cmd"),
  });
  return !result.error && result.status === 0;
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

function detect() {
  const settingsPath = join(home, ".pi", "agent", "settings.json");
  const settings = readJson(settingsPath);
  const sources = configuredSources(settings);
  const codexPackage = packagePath("pi-codex-context");
  const vccPackage = packagePath("@sting8k/pi-vcc") || packagePath("@adamjen/pi-vcc");
  const codexConfigured = sources.some((source) => source.includes("pi-codex-context"));
  const vccConfigured = sources.some((source) => source.includes("pi-vcc"));
  const compactionOwner = codexConfigured || (!vccConfigured && codexPackage)
    ? "pi-codex-context"
    : "pi-core";
  const compactionConflict = vccConfigured;
  const wizardConfig = join(wizardRoot, ".wizard-ai.json");
  const contextPath = join(wizardRoot, "scripts", "wz-ai-context.js");
  const contextFormatsPath = join(wizardRoot, "scripts", "wz-ai-context-formats.js");
  const venv = wizardVenv();
  const imports = pythonImports(venv, ["graphify", "graphifyy", "llmlingua"]);
  const piWorkflowPackage = packagePath("pi-extensible-workflows");
  const piWorkflowConfigured = sources.some((source) => source.includes("pi-extensible-workflows"));
  const piWorkflow = Boolean(piWorkflowPackage) || piWorkflowConfigured;
  const gentlePi = Boolean(packagePath("gentle-pi")) || sources.some((source) => source.includes("gentle-pi"));
  const gentleEngram = Boolean(packagePath("gentle-engram")) || sources.some((source) => source.includes("gentle-engram")) || commandAvailable("engram");
  const gentleAi = commandAvailable("gentle-ai");
  const gentleOwner = gentlePi || gentleEngram || piWorkflow;
  const toonPackage = packagePath("@toon-format/toon");
  const wizardInstalled = commandAvailable("wizard-ai") || existsSync(wizardConfig) || existsSync(contextPath) || Boolean(venv);

  return {
    settings,
    sources,
    pi: commandAvailable("pi"),
    piWorkflow,
    piWorkflowPackage,
    gentleAi,
    gentlePi,
    gentleEngram,
    gentleOwner,
    gga: commandSucceeds("gga", ["version"]),
    herdr: commandAvailable("herdr"),
    compactionOwner: compactionConflict ? "conflict" : compactionOwner,
    compactionConflict,
    codexPackage,
    vccPackage,
    wizard: wizardInstalled,
    wizardConfig: existsSync(wizardConfig),
    context: existsSync(contextPath) || existsSync(contextFormatsPath),
    toonPackage: Boolean(toonPackage),
    toonLea: existsSync(contextPath) || existsSync(contextFormatsPath) || Boolean(toonPackage),
    venv,
    graphify: commandAvailable("graphify") || commandAvailable("graphifyy") || imports.graphify || imports.graphifyy,
    llmlingua: imports.llmlingua === true,
    rtk: commandAvailable("rtk"),
    sqz: commandAvailable("sqz"),
    serena: commandAvailable("serena"),
    imports,
  };
}

function commandText(command, args) {
  return [command, ...args].map((value) => JSON.stringify(value)).join(" ");
}

function fail(id, reason) {
  console.log(`BLOCKED ${id}: ${reason}`);
  if (apply) failures += 1;
}

function action(id, command, args, options = {}) {
  const available = options.available ?? commandAvailable(command);
  if (!available) {
    fail(id, options.unavailable || `${command} is unavailable`);
    return false;
  }
  const label = apply ? "RUN" : "PLAN";
  console.log(`${label} ${id}: ${options.display || commandText(command, args)}`);
  if (!apply) {
    options.onPlan?.();
    return true;
  }
  const actual = executable(command) || command;
  const result = spawnSync(actual, args, {
    stdio: "inherit",
    shell: process.platform === "win32" && actual.endsWith(".cmd"),
  });
  if (result.error || result.status !== 0) {
    failures += 1;
    console.log(`FAIL ${id}: ${result.error?.message || `exit ${result.status}`}`);
    return false;
  }
  if (options.postcondition && !options.postcondition()) {
    failures += 1;
    console.log(`FAIL ${id}: required postcondition was not detected`);
    return false;
  }
  return true;
}

function pipeline(id, posixCommand, windowsCommand, options = {}) {
  if (process.platform === "win32") {
    const shell = executable("pwsh") || executable("powershell");
    if (!shell) {
      fail(id, "PowerShell is required on Windows for the official installer");
      return false;
    }
    return action(id, shell, ["-NoProfile", "-NonInteractive", "-Command", windowsCommand], {
      ...options,
      available: true,
      display: windowsCommand,
    });
  }
  const shell = options.posixShell || "sh";
  const prerequisites = options.prerequisites || ["curl", shell];
  const missing = prerequisites.filter((command) => !commandAvailable(command));
  if (missing.length > 0) {
    fail(id, `${missing.join(" and ")} ${missing.length === 1 ? "is" : "are"} required for the official POSIX installer`);
    return false;
  }
  return action(id, shell, ["-c", posixCommand], {
    ...options,
    available: true,
    display: posixCommand,
  });
}

function status(id, value, details = "") {
  console.log(`${value.toUpperCase().padEnd(13)} ${id}${details ? ` - ${details}` : ""}`);
}

function refresh() {
  return detect();
}

function recheck() {
  if (apply) state = refresh();
}

function ensureGentle() {
  state = refresh();
  if (state.gentlePi) {
    status("gentle-pi", "installed", "existing Gentle Pi integration detected; installer skipped");
    return;
  }
  if (state.gentleOwner) {
    status("gentle-ai", "manager-owned", "existing gentle-engram, gentle-pi or PiWorkflow owner detected; duplicate stack skipped");
    return;
  }

  if (!state.gentleAi) {
    if (process.platform === "win32") {
      fail("gentle-ai", "no official compatible Windows installer is documented; the Gentle AI bootstrap is POSIX-only");
      return;
    }
    const installed = pipeline("gentle-ai", `curl -fsSL ${GENTLE_INSTALL_URL} | bash`, "", {
      posixShell: "bash",
      postcondition: () => refresh().gentleAi,
      onPlan: () => { state.gentleAi = true; },
    });
    if (!installed) return;
    recheck();
  }

  action("gentle-pi", "gentle-ai", ["install", "--agent", "pi"], {
    available: state.gentleAi || !apply,
    postcondition: () => refresh().gentlePi,
    onPlan: () => { state.gentlePi = true; },
  });
}

const initialState = detect();
let state = initialState;
console.log(apply ? "Dependency bootstrap: APPLY" : "Dependency bootstrap: DRY RUN (no mutations)");
if (!apply) console.log("Use --apply to run the planned official installers.");

if (state.compactionConflict) {
  status("pi-compaction-owner", "incompatible", "Pi VCC is configured alongside Vekexasia's pi-codex-context ownership");
  fail("pi-compaction-owner", "remove the configured Pi VCC owner before applying");
  console.log("Result: blocked by conflicting compaction owners");
  process.exitCode = apply ? 1 : 0;
  process.exit();
}
status("pi-compaction-owner", "installed", `${state.compactionOwner} owns compaction`);
status("pi-vcc", "skipped", "intentionally not installed; pi-codex-context is the Vekexasia dotenv owner");

ensureGentle();

if (state.piWorkflow) {
  status("pi-workflow", "manager-owned", "existing Pi package or configuration detected");
} else if (!state.pi) {
  fail("pi-workflow", "Pi is unavailable; cannot run the official pi install command");
} else {
  action("pi-workflow", "pi", ["install", "npm:pi-extensible-workflows"], {
    postcondition: () => refresh().piWorkflow,
    onPlan: () => { state.piWorkflow = true; },
  });
  recheck();
}

if (state.wizard && state.context) {
  status("wizard-ai", "installed", state.wizardConfig ? "Wizard-AI configuration detected" : "Wizard-AI command/context detected");
} else if (initialState.gentleOwner) {
  fail("wizard-ai", "full Wizard-AI setup would overlap an existing Gentle/PiWorkflow owner; install its non-overlapping context tools separately");
} else {
  action("wizard-ai", WIZARD_SETUP[0], WIZARD_SETUP[1], {
    postcondition: () => {
      const next = refresh();
      return next.wizard && next.context;
    },
    onPlan: () => { state.wizard = true; state.context = true; },
  });
  recheck();
}

if (state.toonLea) {
  status("toon-lea", "installed", "Wizard-AI context adapter detected");
} else {
  status("toon-lea", state.wizard ? "blocked" : "pending", "Wizard-AI is the manager; no standalone LEA installer is used");
  if (state.wizard) failures += apply ? 1 : 0;
}

state = refresh();
if (state.graphify) {
  status("graphify", "installed", "graphify/graphifyy command or Wizard-AI venv import detected");
} else if (!state.wizard) {
  status("graphify", "pending", "managed by Wizard-AI setup");
} else {
  action("graphify", GRAPHIFY_INSTALL[0], GRAPHIFY_INSTALL[1], {
    postcondition: () => refresh().graphify,
    onPlan: () => { state.graphify = true; },
  });
  recheck();
}

state = refresh();
if (state.llmlingua) {
  status("llmlingua", "installed", "Wizard-AI venv import detected");
} else if (!state.wizard) {
  status("llmlingua", "pending", "managed by Wizard-AI setup");
} else if (!state.venv) {
  fail("llmlingua", "Wizard-AI venv is unavailable; no system-wide fallback is used");
} else {
  action("llmlingua", LLMLINGUA_INSTALL[0], [...LLMLINGUA_INSTALL[1], state.venv, "llmlingua"], {
    postcondition: () => refresh().llmlingua,
    onPlan: () => { state.llmlingua = true; },
  });
  recheck();
}

function ensureGga() {
  state = refresh();
  if (state.gga) {
    status("gga", "installed", "gga version verified; installer skipped");
    return;
  }
  if (process.platform === "win32") {
    fail("gga", "no official compatible Windows installer is documented; GGA installation is blocked");
    return;
  }
  if (commandAvailable("brew")) {
    action("gga", "brew", ["install", "gentleman-programming/tap/gga"], {
      postcondition: () => refresh().gga,
      onPlan: () => { state.gga = true; },
    });
    return;
  }
  pipeline(
    "gga",
    `tmpdir=$(mktemp -d) && trap 'rm -rf "$tmpdir"' EXIT && git clone --depth 1 ${GGA_REPOSITORY_URL} "$tmpdir/gga" && cd "$tmpdir/gga" && ./install.sh`,
    "",
    {
      prerequisites: ["git", "mktemp", "sh"],
      postcondition: () => refresh().gga,
      onPlan: () => { state.gga = true; },
    },
  );
}

function ensureHerdr() {
  state = refresh();
  if (state.herdr) {
    status("herdr", "installed", "existing command detected; installer skipped");
    return;
  }
  pipeline("herdr", `curl -fsSL ${HERDR_INSTALL_URL} | sh`, `irm ${HERDR_INSTALL_PS1} | iex`, {
    postcondition: () => refresh().herdr,
    onPlan: () => { state.herdr = true; },
  });
}

function ensureRtk() {
  state = refresh();
  if (state.rtk) {
    status("rtk", "installed", "existing command detected; installer skipped");
    return;
  }
  const installed = process.platform === "win32"
    ? action("rtk", "winget", ["install", "rtk-ai.rtk"], {
      postcondition: () => refresh().rtk,
      onPlan: () => { state.rtk = true; },
    })
    : pipeline("rtk", `curl -fsSL ${RTK_INSTALL_URL} | sh`, "", {
      postcondition: () => refresh().rtk,
      onPlan: () => { state.rtk = true; },
    });
  if (!installed) return;
  recheck();
  action("rtk-init", "rtk", process.platform === "win32" ? ["init", "-g"] : ["init", "--global"], {
    available: state.rtk || !apply,
    postcondition: () => refresh().rtk,
    onPlan: () => { state.rtk = true; },
  });
}

function ensureSqz() {
  state = refresh();
  if (state.sqz) {
    status("sqz", "installed", "existing command detected; installer skipped");
    return;
  }
  const installed = process.platform === "win32"
    ? pipeline("sqz", "", `irm ${SQZ_INSTALL_PS1} | iex`, {
      postcondition: () => refresh().sqz,
      onPlan: () => { state.sqz = true; },
    })
    : pipeline("sqz", `curl -fsSL ${SQZ_INSTALL_URL} | sh`, "", {
      postcondition: () => refresh().sqz,
      onPlan: () => { state.sqz = true; },
    });
  if (!installed) return;
  recheck();
  action("sqz-init", "sqz", ["init", "--global"], {
    available: state.sqz || !apply,
    postcondition: () => refresh().sqz,
    onPlan: () => { state.sqz = true; },
  });
}

function ensureSerena() {
  state = refresh();
  if (state.serena) {
    status("serena", "installed", "existing command detected; installer skipped");
    return;
  }
  const installed = action("serena", "uv", ["tool", "install", "-p", "3.13", "serena-agent"], {
    postcondition: () => refresh().serena,
    onPlan: () => { state.serena = true; },
  });
  if (!installed) return;
  recheck();
  action("serena-init", "serena", ["init"], {
    available: state.serena || !apply,
    postcondition: () => refresh().serena,
    onPlan: () => { state.serena = true; },
  });
}

function ensureSkillsCli() {
  if (commandAvailable("skills")) {
    status("skills-cli", "installed", "existing skills command detected; installer skipped");
    return;
  }
  if (!commandAvailable("npm")) {
    fail("skills-cli", "npm is required to install Vercel Skills CLI (@latest)");
    return;
  }
  action("skills-cli", "npm", ["install", "--global", "skills@latest"], {
    postcondition: () => commandAvailable("skills"),
    onPlan: () => { state.skillsCli = true; },
  });
}

const REQUIRED_SKILL_SUITES = [
  { id: "skill-engineering-excellence", pkg: "darkrei08/Engineering-Excellence", skill: null },
  { id: "skill-matt-pocock", pkg: "mattpocock/skills", skill: null },
  { id: "skill-gentle-ai", pkg: "Gentleman-Programming/gentle-ai", skill: null },
  { id: "skill-pi-herdr-orchestration", pkg: "darkrei08/pi-herdr-orchestration", skill: "pi-herdr-orchestrator" },
];

function ensureSkillSuites() {
  const canRun = commandAvailable("skills") || !apply;
  if (!canRun) {
    fail("skill-suites", "skills CLI is unavailable; cannot install skill suites");
    return;
  }
  for (const suite of REQUIRED_SKILL_SUITES) {
    const args = ["add", suite.pkg, "-g", "-a", "*", "-y"];
    if (suite.skill) {
      args.push("--skill", suite.skill);
    }
    action(suite.id, "skills", args, {
      available: canRun,
      display: `skills ${args.join(" ")}`,
      onPlan: () => {},
    });
  }
}

ensureGga();
ensureHerdr();
ensureRtk();
ensureSqz();
ensureSerena();
ensureSkillsCli();
ensureSkillSuites();

console.log(failures === 0 ? `Result: ${apply ? "completed" : "dry run complete"}` : `Result: failed (${failures})`);
if (failures > 0) process.exitCode = 1;
