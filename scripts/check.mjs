#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = join(__dirname, "..", "skills", "pi-herdr-orchestrator", "scripts", "check-environment.mjs");
const result = spawnSync(process.execPath, [target, ...process.argv.slice(2)], { stdio: "inherit" });

if (result.error) {
  console.error(result.error);
  process.exit(1);
}
if (result.status !== null) {
  process.exit(result.status);
}
if (result.signal) {
  process.exit(1);
}
process.exit(1);
