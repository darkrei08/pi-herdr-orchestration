#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_ADAPTER_MARKERS = ["builtin:codemode", "builtin:tool-search", "builtin:mcp"];
const REQUIRED_POLICY_MARKERS = ["approval", "fallback"];
const DEFAULT_EXPECTED_SKILLS = 44;

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function listSkillNames(root) {
  if (!root || !existsSync(root)) return [];
  return readdirSync(root).filter((name) => {
    const skillPath = join(root, name, "SKILL.md");
    return statSafe(skillPath)?.isFile() === true;
  }).sort();
}

function statSafe(path) {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}

function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return null;
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    fields[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return fields;
}

function fileHash(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function discoverInstalledSource(home = homedir()) {
  const cache = join(home, ".claude", "plugins", "cache", "knowledge-work-plugins", "small-business");
  if (!existsSync(cache)) return null;
  const versions = readdirSync(cache)
    .filter((name) => statSafe(join(cache, name))?.isDirectory())
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  for (const version of versions) {
    const root = join(cache, version, "skills");
    if (listSkillNames(root).length > 0) return root;
  }
  return null;
}

function connectorNames(config) {
  const servers = config?.mcpServers;
  return servers && typeof servers === "object" && !Array.isArray(servers) ? Object.keys(servers).sort() : [];
}

export function inspectSmallBusiness({
  sourceRoot = discoverInstalledSource(),
  canonicalRoot = join(homedir(), ".agents", "skills"),
  sourceMcp,
  piMcp,
  adapterText = "",
  expectedSkillCount = DEFAULT_EXPECTED_SKILLS,
} = {}) {
  const sourceSkills = listSkillNames(sourceRoot);
  const canonicalSkills = listSkillNames(canonicalRoot);
  const missingCanonical = sourceSkills.filter((name) => !canonicalSkills.includes(name));
  const unexpectedCanonical = canonicalSkills.filter((name) => sourceSkills.includes(name) === false && [
    "ad-manager", "ap-processor", "brand-style", "build-agent", "build-connector", "business-pulse", "call-list",
    "canva-creator", "cash-flow-snapshot", "close-month", "content-strategy", "contract-review", "crm-autopilot",
    "grant-rfp-writer", "grow-pipeline", "growth-pulse", "hiring-screener", "inbox-manager", "inventory-planner",
    "invoice-chase", "job-post-builder", "lead-finder", "lead-triage", "marketing-monday", "monday-brief",
    "month-end-prep", "outreach-composer", "pay-the-bills", "payroll-prep", "plan-payroll", "proposal-builder",
    "reactivate", "report-builder", "report-pack", "restock", "review-reputation", "seo-ai-visibility", "smb-onboard",
    "smb-router", "social-content-engine", "speed-to-lead", "tax-prep", "tax-season-organizer", "ticket-deflector",
  ].includes(name));
  const mismatchedCanonical = [];
  const invalidFrontmatter = [];
  for (const name of sourceSkills) {
    const sourcePath = join(sourceRoot, name, "SKILL.md");
    const canonicalPath = join(canonicalRoot, name, "SKILL.md");
    const fields = parseFrontmatter(readFileSync(sourcePath, "utf8"));
    if (!fields || fields.name !== name || !fields.description) invalidFrontmatter.push(name);
    if (existsSync(canonicalPath) && fileHash(sourcePath) !== fileHash(canonicalPath)) mismatchedCanonical.push(name);
  }
  const adapterMissing = [...REQUIRED_ADAPTER_MARKERS, ...REQUIRED_POLICY_MARKERS].filter((marker) => !adapterText.includes(marker));
  const anthropicConnectors = connectorNames(sourceMcp);
  const piConnectors = connectorNames(piMcp);
  const piConfiguredAnthropicConnectors = anthropicConnectors.filter((name) => piConnectors.includes(name));
  const valid = sourceSkills.length === expectedSkillCount
    && missingCanonical.length === 0
    && mismatchedCanonical.length === 0
    && invalidFrontmatter.length === 0
    && adapterMissing.length === 0
    && unexpectedCanonical.length === 0;

  return {
    schema: "pi-herdr-orchestrator/anthropic-small-business-report-v1",
    valid,
    sourceRoot,
    canonicalRoot,
    skillCount: sourceSkills.length,
    expectedSkillCount,
    sourceSkills,
    missingCanonical,
    mismatchedCanonical,
    invalidFrontmatter,
    unexpectedCanonical,
    adapterMissing,
    anthropicConnectorCount: anthropicConnectors.length,
    anthropicConnectors,
    piConfiguredAnthropicConnectors,
    piMcpPolicy: "metadata-only; no unauthenticated remote Anthropic MCP server is auto-imported",
  };
}

function optionValue(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function readOptionalJson(path) {
  return path && existsSync(path) ? readJson(path) : { mcpServers: {} };
}

async function main() {
  const args = process.argv.slice(2);
  const sourceRoot = resolve(optionValue(args, "--source") || discoverInstalledSource() || "");
  const canonicalRoot = resolve(optionValue(args, "--canonical") || join(homedir(), ".agents", "skills"));
  const piMcpPath = resolve(optionValue(args, "--pi-mcp") || join(homedir(), ".pi", "agent", "mcp.json"));
  const sourceMcpPath = resolve(optionValue(args, "--source-mcp") || join(sourceRoot, "..", ".mcp.json"));
  const adapterPath = resolve(optionValue(args, "--adapter") || join(process.cwd(), "skills", "anthropic-small-business-pi", "SKILL.md"));
  const expectedSkillCount = Number(optionValue(args, "--expected-count") || DEFAULT_EXPECTED_SKILLS);
  const report = inspectSmallBusiness({
    sourceRoot,
    canonicalRoot,
    sourceMcp: readOptionalJson(sourceMcpPath),
    piMcp: readOptionalJson(piMcpPath),
    adapterText: existsSync(adapterPath) ? readFileSync(adapterPath, "utf8") : "",
    expectedSkillCount,
  });
  if (args.includes("--json")) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`${report.valid ? "PASS" : "FAIL"} Anthropic Small Business Pi compatibility`);
    console.log(`Skills: ${report.skillCount}/${report.expectedSkillCount}; MCP definitions: ${report.anthropicConnectorCount}; Pi-mapped connectors: ${report.piConfiguredAnthropicConnectors.length}`);
    if (report.missingCanonical.length) console.log(`Missing canonical: ${report.missingCanonical.join(", ")}`);
    if (report.mismatchedCanonical.length) console.log(`Mismatched canonical: ${report.mismatchedCanonical.join(", ")}`);
    if (report.adapterMissing.length) console.log(`Adapter markers missing: ${report.adapterMissing.join(", ")}`);
  }
  if (!report.valid) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
