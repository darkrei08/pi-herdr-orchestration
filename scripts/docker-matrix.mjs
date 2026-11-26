#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export class UsageError extends Error {}

export const SAFETY_FLAGS = [
  "--rm",
  "--pull=never",
  "--network",
  "none",
  "--cap-drop=ALL",
  "--security-opt=no-new-privileges",
  "--read-only",
];

export const ROWS = [
  { id: "debian-13", image: "debian:13" },
  { id: "ubuntu-24-04", image: "ubuntu:24.04" },
  { id: "fedora-42", image: "fedora:42" },
  { id: "archlinux", image: "archlinux:latest" },
  { id: "opensuse-tumbleweed", image: "opensuse/tumbleweed" },
  { id: "alpine-3-22", image: "alpine:3.22" },
  { id: "node-24", image: "node:24-bookworm-slim" },
];

const PROBES = ["node", "npm", "rustc", "cargo", "fast-anything", "optimaizr"];
const STATUS_EXIT = { "NOT RUN": 1, BLOCKED: 2, FAIL: 3, PASS: 0 };

export function parseArguments(argv) {
  if (argv.length !== 1 || (argv[0] !== "list" && argv[0] !== "run")) {
    throw new UsageError("usage: docker-matrix <list|run>");
  }
  return { command: argv[0] };
}

export function formatList() {
  return ROWS.map((row, index) => `${index + 1}. ${row.id} ${row.image}`).join("\n");
}

export function containerScript() {
  const probes = PROBES.map((bin) => `if command -v ${bin} >/dev/null 2>&1; then printf 'runtime ${bin}=%s\\n' "$(command -v ${bin})"; else printf 'runtime ${bin}=missing\\n'; fi`);
  return [
    ...probes,
    "if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then",
    "  printf 'checks=unavailable\\n'",
    "  exit 78",
    "fi",
    "cd /repo || exit 1",
    "node scripts/lint.mjs || { printf 'checks=fail\\n'; exit 1; }",
    "npm test || { printf 'checks=fail\\n'; exit 1; }",
    "printf 'checks=pass\\n'",
  ].join("\n");
}

export function dockerRunArgs(row, { repoRoot, stateRoot }) {
  return [
    "run",
    ...SAFETY_FLAGS,
    "--cpus", "2",
    "--memory", "2g",
    "--pids-limit", "512",
    "--tmpfs", "/tmp",
    "--mount", `type=bind,src=${repoRoot},dst=/repo,readonly`,
    "--mount", `type=bind,src=${join(stateRoot, row.id)},dst=/state`,
    "--env", "HOME=/state",
    "--workdir", "/repo",
    row.image,
    "sh", "-c", containerScript(),
  ];
}

function isMissingImageError(stderr = "") {
  return /no such image|unable to find image|image .* not found/i.test(stderr);
}

export function classifyRow({ imagePresent, result }) {
  if (!imagePresent) return { status: "BLOCKED", detail: "image not present locally; pulls are disabled" };
  if (result.error || result.status === null) return { status: "NOT RUN", detail: String(result.error?.message ?? "docker did not start") };
  const stdout = result.stdout ?? "";
  if (result.status === 78 || stdout.includes("checks=unavailable")) {
    return { status: "BLOCKED", detail: "node/npm unavailable in image; repository checks cannot run" };
  }
  if (result.status !== 0) return { status: "FAIL", detail: `container exited ${result.status}${result.stderr ? `: ${result.stderr.trim().split("\n").at(-1)}` : ""}` };
  if (!stdout.includes("checks=pass")) return { status: "FAIL", detail: "repository checks did not report checks=pass" };
  return { status: "PASS", detail: "repository lint and tests passed" };
}

export function exitCodeFor(results) {
  return results.reduce((max, row) => Math.max(max, STATUS_EXIT[row.status] ?? STATUS_EXIT.FAIL), 0);
}

export function runMatrix({ spawn = spawnSync, repoRoot = process.cwd() } = {}) {
  const version = spawn("docker", ["version", "--format", "{{.Server.Version}}"], { encoding: "utf8" });
  if (version.status !== 0) {
    return { docker: null, rows: ROWS.map((row) => ({ ...row, status: "NOT RUN", runtimes: [], detail: "docker unavailable" })) };
  }
  const stateRoot = mkdtempSync(join(tmpdir(), "docker-matrix-"));
  try {
    const present = new Map();
    let inspectionFailure;
    for (const row of ROWS) {
      const inspected = spawn("docker", ["image", "inspect", "--format", "{{.Id}}", row.image], { encoding: "utf8" });
      if (inspected.status !== 0 && !isMissingImageError(inspected.stderr)) {
        inspectionFailure = inspected.stderr?.trim() || "docker image inspection failed";
        break;
      }
      present.set(row.id, inspected.status === 0);
    }
    if (inspectionFailure) {
      return {
        docker: version.stdout.trim(),
        rows: ROWS.map((row) => ({ ...row, status: "NOT RUN", runtimes: [], detail: inspectionFailure })),
      };
    }
    const rows = ROWS.map((row) => {
      const imagePresent = present.get(row.id);
      if (imagePresent) mkdirSync(join(stateRoot, row.id), { recursive: true });
      const result = imagePresent
        ? spawn("docker", dockerRunArgs(row, { repoRoot, stateRoot }), { encoding: "utf8" })
        : { status: 1, stdout: "", stderr: "" };
      const outcome = classifyRow({ imagePresent, result });
      const runtimes = [...(result.stdout ?? "").matchAll(/^runtime (\S+)=(?!missing$)(\S+)$/gm)].map((match) => match[1]);
      return { ...row, status: outcome.status, runtimes, detail: outcome.detail };
    });
    return { docker: version.stdout.trim(), rows };
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
}

export function renderResults({ docker, rows }) {
  const counts = { pass: 0, blocked: 0, fail: 0, "not-run": 0 };
  for (const row of rows) counts[row.status.toLowerCase().replaceAll(" ", "-")] += 1;
  return [
    `docker-server=${docker ?? "unavailable"}`,
    `rows=${rows.length}`,
    ...rows.map((row) => `id=${row.id} image=${row.image} status=${row.status} runtimes=${row.runtimes?.join(",") || "none"} detail="${row.detail}"`),
    `summary pass=${counts.pass} blocked=${counts.blocked} fail=${counts.fail} not-run=${counts["not-run"]}`,
  ].join("\n");
}

export function main(argv, { spawn = spawnSync, stdout = process.stdout, repoRoot = process.cwd() } = {}) {
  const { command } = parseArguments(argv);
  if (command === "list") {
    stdout.write(`${formatList()}\n`);
    return 0;
  }
  const matrix = runMatrix({ spawn, repoRoot });
  stdout.write(`${renderResults(matrix)}\n`);
  return exitCodeFor(matrix.rows);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = main(process.argv.slice(2), { repoRoot: resolve(dirname(fileURLToPath(import.meta.url)), "..") });
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  }
}
