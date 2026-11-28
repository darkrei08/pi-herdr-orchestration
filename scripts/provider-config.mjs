import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BOARD_COLUMNS, createEvent } from "./task-map-envelope.mjs";

export const PROVIDER_CONFIG_VERSION = "provider-config/v1";
export const CAPABILITIES = Object.freeze([
  "issues",
  "PR",
  "checks",
  "review",
  "webhook",
  "search",
  "writeback",
]);
export const NATIVE_ADAPTERS = Object.freeze({
  "github/v1": { provider: "github" },
  "github/v2": { provider: "github" },
  "gitlab/v1": { provider: "gitlab" },
  "gitea/v1": { provider: "gitea" },
  "forgejo/v1": { provider: "forgejo" },
  "codeberg/v1": { provider: "codeberg" },
});

const DEFAULT_URLS = Object.freeze({
  github: "https://api.github.com",
  gitlab: "https://gitlab.com/api/v4",
});
const EXPLICIT_URL_PROVIDERS = new Set(["gitea", "forgejo", "codeberg"]);
const TOKEN_REF = /^(?:env|secret|vault):[A-Z][A-Z0-9_]*$/;
const SCOPE = "provider-config";

function requireText(value, label) {
  const text = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  if (!text) throw new Error(`${label} is required`);
  return text;
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function addReason(report, reason) {
  if (!report.reasons.includes(reason)) report.reasons.push(reason);
}

function capabilityMap() {
  return Object.fromEntries(CAPABILITIES.map((name) => [name, true]));
}

function reportBase() {
  return {
    version: PROVIDER_CONFIG_VERSION,
    mode: "fixture",
    status: "PASS",
    activation: "ALLOWED",
    reasons: [],
    counts: { wizard: 0, local: 0, selected: 0, skipped: 0, blocked: 0, events: 0, capabilities: 0 },
    providers: [],
    skipped: [],
    events: [],
    network: 0,
    live_write: false,
  };
}

function finish(report) {
  report.counts.selected = report.providers.length;
  report.counts.skipped = report.skipped.length;
  report.counts.capabilities = report.providers.length;
  report.counts.events = report.events.length;
  if (report.reasons.length) {
    report.status = "BLOCKED";
    report.activation = "BLOCKED";
  }
  return report;
}

function timestampFor(input, now) {
  if (isObject(input) && typeof input.now === "string" && !Number.isNaN(Date.parse(input.now))) return input.now;
  return now.toISOString();
}

function normalizeEvents(events, now) {
  if (!Array.isArray(events)) return [];
  return events.map((event) => createEvent({}, event, now));
}

function resolveUrl(provider, value) {
  if (value === undefined || value === null || value === "") {
    if (EXPLICIT_URL_PROVIDERS.has(provider) || !DEFAULT_URLS[provider]) {
      return { error: `${provider} requires an explicit url` };
    }
    return { url: DEFAULT_URLS[provider] };
  }
  let text;
  try {
    text = requireText(value, `${provider} url`);
    const parsed = new URL(text);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
      return { error: `invalid url for ${provider}` };
    }
  } catch {
    return { error: `invalid url for ${provider}` };
  }
  return { url: text };
}

function normalizeWizard(report, selected) {
  const wizard = [];
  const seen = new Set();
  for (const item of selected) {
    let name;
    try {
      name = requireText(item, "wizard provider");
    } catch (error) {
      addReason(report, error.message);
      continue;
    }
    if (seen.has(name)) continue;
    seen.add(name);
    wizard.push(name);
  }
  report.counts.wizard = wizard.length;
  return wizard;
}

function normalizeLocal(report, providers) {
  const local = new Map();
  for (const entry of providers) {
    if (!isObject(entry)) {
      addReason(report, "local provider entry is required");
      report.counts.blocked += 1;
      continue;
    }
    let name;
    try {
      name = requireText(entry.provider, "provider");
    } catch (error) {
      addReason(report, error.message);
      report.counts.blocked += 1;
      continue;
    }
    if (local.has(name)) {
      addReason(report, `duplicate local config for ${name}`);
      report.counts.blocked += 1;
      continue;
    }
    local.set(name, entry);
  }
  report.counts.local = local.size;
  return local;
}

function projectProvider(report, name, entry) {
  const errors = [];
  let adapter;
  let tokenRef;
  let url;
  try {
    adapter = requireText(entry.adapter, `${name} adapter`);
  } catch (error) {
    errors.push(error.message);
  }
  if (!NATIVE_ADAPTERS[adapter] || NATIVE_ADAPTERS[adapter].provider !== name) {
    errors.push(`unsupported native adapter ${adapter ?? "UNSET"}`);
  }
  try {
    tokenRef = requireText(entry.token_ref, `${name} token_ref`);
  } catch (error) {
    errors.push(error.message);
  }
  if (tokenRef && !TOKEN_REF.test(tokenRef)) errors.push("token_ref must be a placeholder reference");
  if (Object.hasOwn(entry, "token")) errors.push("raw token forbidden");
  const resolvedUrl = resolveUrl(name, entry.url);
  if (resolvedUrl.error) errors.push(resolvedUrl.error);
  else url = resolvedUrl.url;
  if (errors.length) {
    addReason(report, `${name}: ${errors.join("; ")}`);
    report.counts.blocked += 1;
    return;
  }
  report.providers.push({
    provider: name,
    adapter,
    url,
    token_ref: tokenRef,
    enabled: true,
    source: "local",
    capabilities: capabilityMap(),
    board_columns: [...BOARD_COLUMNS],
    network: 0,
  });
}

function removeDuplicateTokens(report) {
  const owners = new Map();
  for (const provider of report.providers) {
    const list = owners.get(provider.token_ref) ?? [];
    list.push(provider.provider);
    owners.set(provider.token_ref, list);
  }
  const duplicates = new Set();
  for (const list of owners.values()) {
    if (list.length < 2) continue;
    for (const name of list) duplicates.add(name);
  }
  if (!duplicates.size) return;
  addReason(report, "duplicate master token ref for enabled providers");
  report.providers = report.providers.filter((provider) => !duplicates.has(provider.provider));
  report.counts.blocked += duplicates.size;
}

function appendDecisionEvents(report, wizard, timestamp) {
  const correlationId = report.events[0]?.correlation_id ?? report.events[0]?.id ?? null;
  for (const name of wizard) {
    const selected = report.providers.find((provider) => provider.provider === name);
    const skipped = report.skipped.find((item) => item.provider === name);
    const to = selected ? "active" : skipped ? "skipped" : "blocked";
    const reason = selected
      ? "selected by local config"
      : skipped
        ? skipped.reason
        : `${name} blocked by invalid config`;
    report.events.push(createEvent({}, {
      timestamp,
      source: SCOPE,
      from: "wizard",
      to,
      reason,
      event_type: "provider_decision",
      provider: name,
      correlation_id: correlationId,
    }));
  }
}

export function resolveProviderConfig(input) {
  const report = reportBase();
  const now = new Date();
  report.events = normalizeEvents(input?.events, now);
  if (!isObject(input)) {
    addReason(report, "input must be an object");
    return finish(report);
  }
  if (input.version !== PROVIDER_CONFIG_VERSION) addReason(report, "unsupported config version");
  if (!isObject(input.wizard) || !Array.isArray(input.wizard.selected)) addReason(report, "wizard is required");
  if (!isObject(input.local) || !Array.isArray(input.local.providers)) addReason(report, "local config is required");
  if (report.reasons.length) return finish(report);

  const wizard = normalizeWizard(report, input.wizard.selected);
  const local = normalizeLocal(report, input.local.providers);
  for (const name of local.keys()) {
    if (wizard.includes(name)) continue;
    addReason(report, `wizard/file mismatch: ${name} is not selected by wizard`);
    report.counts.blocked += 1;
  }
  for (const name of wizard) {
    const entry = local.get(name);
    if (!entry) {
      report.skipped.push({ provider: name, reason: "not configured in local config" });
      continue;
    }
    if (entry.enabled === false) {
      report.skipped.push({ provider: name, reason: "disabled in local config" });
      continue;
    }
    if (entry.enabled !== true) {
      addReason(report, `${name}: enabled must be true`);
      report.counts.blocked += 1;
      continue;
    }
    projectProvider(report, name, entry);
  }
  removeDuplicateTokens(report);
  appendDecisionEvents(report, wizard, timestampFor(input, now));
  return finish(report);
}

export function validateProviderConfig(input) {
  const resolved = resolveProviderConfig(input);
  return {
    version: resolved.version,
    mode: resolved.mode,
    status: resolved.status,
    activation: resolved.activation,
    reasons: resolved.reasons,
    counts: resolved.counts,
    network: resolved.network,
    live_write: resolved.live_write,
  };
}

export function projectProviderCapabilities(input) {
  const resolved = resolveProviderConfig(input);
  return {
    status: resolved.status,
    activation: resolved.activation,
    contract: [...CAPABILITIES],
    providers: resolved.providers.map((provider) => ({
      provider: provider.provider,
      adapter: provider.adapter,
      capabilities: { ...provider.capabilities },
      board_columns: [...provider.board_columns],
    })),
    counts: {
      selected: resolved.counts.selected,
      capabilities: resolved.counts.capabilities,
      blocked: resolved.counts.blocked,
    },
    network: resolved.network,
    live_write: resolved.live_write,
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help") args.help = true;
    else if (argument === "--input" || argument === "--output") {
      const value = argv[++index];
      if (!value || value.startsWith("--")) throw new Error(`${argument} requires a path`);
      args[argument.slice(2)] = value;
    } else throw new Error(`unknown argument ${argument}`);
  }
  return args;
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`invalid JSON in ${label}: ${error.message}`);
    throw error;
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write("usage: provider-config.mjs --input <path> --output <path> [--help]\n");
    return;
  }
  if (!args.input || !args.output) throw new Error("--input and --output are required");
  const output = resolveProviderConfig(readJson(args.input, "input"));
  mkdirSync(dirname(args.output), { recursive: true });
  writeFileSync(args.output, `${JSON.stringify(output, null, 2)}\n`);
  process.stdout.write(
    `wrote ${args.output} selected=${output.counts.selected} skipped=${output.counts.skipped} `
    + `blocked=${output.counts.blocked} events=${output.counts.events} status=${output.status} `
    + `activation=${output.activation} network=0 live_write=false tokens=redacted\n`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`provider-config: ${error.message}\n`);
    process.exitCode = 1;
  }
}
