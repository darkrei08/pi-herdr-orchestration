#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { option } from "./cli-options.mjs";

export const MAX_CONTEXT_TOKENS = 300_000;
export const TARGET_TRIGGER_TOKENS = 276_000;
export const MIN_TRIGGER_TOKENS = 256_000;

export function evaluateContextWindow(settings, config) {
  const issues = [];
  const scope = Array.isArray(config?.scope) ? config.scope : [];
  if (!scope.includes("orchestrator") || !scope.includes("child")) {
    issues.push("scope must cover orchestrator and child");
  }

  const max = Number(config?.maxContextTokens ?? MAX_CONTEXT_TOKENS);
  const min = Number(config?.minimumTriggerTokens ?? MIN_TRIGGER_TOKENS);
  const target = Number(config?.targetTriggerTokens ?? TARGET_TRIGGER_TOKENS);
  const overrides = settings?.compaction?.modelOverrides ?? {};
  const triggers = {};
  for (const [model, entry] of Object.entries(overrides)) {
    const window = Number(config?.modelWindows?.[model]);
    const reserve = Number(entry?.reserveTokens);
    if (!Number.isFinite(window)) {
      issues.push(`${model}: missing contextWindow in policy config`);
      continue;
    }
    if (!Number.isFinite(reserve)) {
      issues.push(`${model}: invalid reserveTokens`);
      continue;
    }
    const trigger = window - reserve;
    triggers[model] = trigger;
    if (trigger > max) issues.push(`${model}: trigger ${trigger} exceeds ${max}`);
    if (window > max && trigger < min) issues.push(`${model}: trigger ${trigger} is below ${min}`);
    if (window > max && trigger !== target) issues.push(`${model}: trigger ${trigger} differs from target ${target}`);
  }
  return { ok: issues.length === 0, issues, scope, triggers };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const configPath = resolve(option("config", join(process.cwd(), "config", "context-window.json")));
  const settingsPath = resolve(option("settings", join(homedir(), ".pi", "agent", "settings.json")));
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
  const result = evaluateContextWindow(settings, config);
  process.stdout.write(`${JSON.stringify({ configPath, settingsPath, ...result }, null, 2)}\n`);
  process.exitCode = result.ok ? 0 : 1;
}
