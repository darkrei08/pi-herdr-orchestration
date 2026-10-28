#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_TIMEOUT_MS = 2_000;
const MAX_TIMEOUT_MS = 30_000;
const EXECUTABLE_TIMEOUT_MS = 2_000;
const REGISTRY_PATH = process.env.MCP_REGISTRY || join(homedir(), ".pi", "agent", "mcp.json");

function boundedTimeout(value) {
  const timeoutMs = Number(value);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100) return DEFAULT_TIMEOUT_MS;
  return Math.min(timeoutMs, MAX_TIMEOUT_MS);
}

function resolveExecutable(command) {
  const lookup = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(lookup, [command], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    timeout: EXECUTABLE_TIMEOUT_MS,
  });
  if (result.error || result.status !== 0) return null;
  return result.stdout.trim().split(/\r?\n/)[0] || null;
}

function publicUrl(value) {
  const url = new URL(value);
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  return url.toString();
}

function httpHealth(status, initialized) {
  if (initialized) return "ok";
  if (status === 405 || (status >= 300 && status < 400)) return "unverified";
  return "unhealthy";
}

function isInitializedMcpResponse(body) {
  return typeof body === "string" && body.includes('"result"') && body.includes('"protocolVersion"');
}

function serverEntries(registry) {
  const servers = registry?.mcpServers;
  if (!servers || typeof servers !== "object" || Array.isArray(servers)) return [];
  return Object.entries(servers);
}

async function inspectServer(name, config, options) {
  if (typeof config?.url === "string" && config.url.trim()) {
    let url;
    try {
      url = publicUrl(config.url);
    } catch {
      return { name, transport: "url", reachable: false, reason: "invalid-url" };
    }

    try {
      const response = await options.fetchImpl(url, {
        method: "POST",
        headers: {
          accept: "application/json, text/event-stream",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-06-18",
            capabilities: {},
            clientInfo: { name: "pi-herdr-orchestrator", version: "1.0.0" },
          },
        }),
        redirect: "manual",
        signal: AbortSignal.timeout(options.timeoutMs),
      });
      const body = typeof response.text === "function" ? await response.text() : "";
      const initialized = isInitializedMcpResponse(body);
      return {
        name,
        transport: "url",
        url,
        reachable: true,
        health: httpHealth(response.status, initialized),
        status: response.status,
        protocol: initialized ? "initialized" : "unverified",
        probe: "MCP initialize",
      };
    } catch (error) {
      return {
        name,
        transport: "url",
        url,
        reachable: false,
        health: "unavailable",
        reason: error?.name === "TimeoutError" ? "timeout" : "unreachable",
      };
    }
  }

  if (typeof config?.command === "string" && config.command.trim() && !/\s/.test(config.command.trim())) {
    const command = basename(config.command.trim());
    const path = options.resolveExecutable(config.command.trim());
    return {
      name,
      transport: "stdio",
      command,
      reachable: Boolean(path),
      health: path ? "unverified" : "unavailable",
      probe: "executable lookup; MCP protocol not exercised",
      ...(path ? { path } : { reason: "executable-not-found" }),
    };
  }

  return { name, transport: "unknown", reachable: false, health: "unavailable", reason: "missing-url-or-command" };
}

export async function inspectRegistry(registry, {
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl = fetch,
  resolveExecutable: executableResolver = resolveExecutable,
} = {}) {
  const servers = await Promise.all(serverEntries(registry).map(([name, config]) => inspectServer(name, config, {
    timeoutMs: boundedTimeout(timeoutMs),
    fetchImpl,
    resolveExecutable: executableResolver,
  })));
  const reachable = servers.filter((server) => server.reachable).length;
  const healthy = servers.filter((server) => server.health === "ok").length;
  const unhealthy = servers.filter((server) => server.health === "unhealthy").length;
  const unverified = servers.filter((server) => server.health === "unverified").length;
  return {
    schema: "pi-herdr-orchestrator/mcp-report-v1",
    configured_servers: servers,
    summary: {
      configured: servers.length,
      reachable,
      healthy,
      unhealthy,
      unverified,
      unreachable: servers.length - reachable,
    },
  };
}

function readRegistry(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function optionValue(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

async function main() {
  const args = process.argv.slice(2);
  const registryPath = resolve(optionValue(args, "--registry") || REGISTRY_PATH);
  const timeoutMs = boundedTimeout(optionValue(args, "--timeout-ms"));
  let report;
  try {
    report = await inspectRegistry(readRegistry(registryPath), { timeoutMs });
    report.registry = registryPath;
  } catch (error) {
    report = {
      schema: "pi-herdr-orchestrator/mcp-report-v1",
      registry: registryPath,
      error: "registry-unreadable",
      configured_servers: [],
      summary: { configured: 0, reachable: 0, healthy: 0, unhealthy: 0, unverified: 0, unreachable: 0 },
    };
    if (!args.includes("--json")) console.error(`MCP registry unavailable: ${registryPath}`);
    process.exitCode = 1;
  }

  if (args.includes("--json")) console.log(JSON.stringify(report, null, 2));
  else if (!report.error) {
    for (const server of report.configured_servers) {
      console.log(`${server.reachable ? "PASS" : "FAIL"} ${server.name} ${server.transport}`);
    }
    console.log(`Configured: ${report.summary.configured}; reachable: ${report.summary.reachable}; unreachable: ${report.summary.unreachable}`);
  }
  if (report.summary.unreachable > 0 || report.summary.unhealthy > 0) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
