#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SKIP_DIRS = new Set([".git", ".worktrees", ".pi", "node_modules", "dist", "build", "odd"]);
// lint-disable-next-line loose-equality
const LOOSE_EQUALITY = /(?<![=!<>])==(?!=)|(?<![!=])!=(?!=)/;
const MULTIPLE_STATEMENTS = /;\s*(?:if|for|while|switch|const|let|var|return|throw|console\.[a-z]+)\b/;

export function lintText(file, text) {
  const issues = [];
  const add = (line, rule, message) => issues.push({ file, line, rule, message });
  const lines = text.split(/\r?\n/);
  if (lines.some((line) => line.includes("lint-disable-file"))) return issues;
  for (const [index, line] of lines.entries()) {
    if (/[ \t]+$/.test(line)) add(index + 1, "trailing-whitespace", "trailing whitespace");
    if (/^\s*\t/.test(line)) add(index + 1, "tab-indentation", "tab indentation");
  }
  if (text.includes("\r")) add(1, "crlf", "CRLF line endings");
  let previous = null;
  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();
    if (trimmed.length >= 20 && trimmed === previous) add(index + 1, "duplicate-line", "duplicate consecutive line");
    previous = trimmed;
  }
  for (const [index, line] of lines.entries()) {
    if (MULTIPLE_STATEMENTS.test(line)) add(index + 1, "multiple-statements", "multiple statements on one line");
  }
  for (const [index, line] of lines.entries()) {
    // lint-disable-next-line todo-marker
    if (/\b(?:TODO|FIXME|XXX|HACK)\b/.test(line)) add(index + 1, "todo-marker", "unresolved work marker");
  }
  for (const [index, line] of lines.entries()) {
    if (LOOSE_EQUALITY.test(line)) add(index + 1, "loose-equality", "use === or !==");
  }
  return issues;
}

function collectFiles(directory, root, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) collectFiles(join(directory, entry.name), root, files);
      continue;
    }
    if (/\.(?:mjs|js)$/.test(entry.name)) files.push(relative(root, join(directory, entry.name)).split(sep).join("/"));
  }
  return files;
}

function syntaxIssues(file) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  return result.status === 0 ? [] : [{
    file,
    line: 1,
    rule: "syntax",
    message: (result.stderr ?? result.stdout ?? "syntax check failed").trim().split("\n")[0],
  }];
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const files = collectFiles(root, root).sort();
  const issues = [];
  for (const file of files) {
    if (process.argv.includes("--no-syntax")) continue;
    issues.push(...syntaxIssues(join(root, file)));
  }
  for (const file of files) {
    issues.push(...lintText(file, readFileSync(join(root, file), "utf8")));
  }
  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify({ files: files.length, issues }, null, 2)}\n`);
  } else if (issues.length === 0) {
    process.stdout.write(`lint: ${files.length} files clean\n`);
  } else {
    process.stderr.write(`${issues.map((issue) => `ERROR ${issue.file}:${issue.line} ${issue.rule}: ${issue.message}`).join("\n")}\n`);
  }
  process.exitCode = issues.length === 0 ? 0 : 1;
}
