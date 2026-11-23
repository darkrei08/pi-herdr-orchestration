#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { option } from "./cli-options.mjs";

const SLUG = /^[a-z0-9][a-z0-9-]{0,47}$/;

export function buildWorktreePlan(slug, root, base = "origin/main") {
  if (!SLUG.test(slug)) throw new Error("invalid worktree slug: use lowercase letters, digits and dashes");
  const repoRoot = resolve(root);
  const branch = `worktree/${slug}`;
  const path = `${repoRoot}/.worktrees/${slug}`;
  return { branch, path, args: ["worktree", "add", "-b", branch, path, base] };
}

export function isRemovableWorktree({ dirty, pending, ancestor, referenced }) {
  return dirty === false && pending === 0 && ancestor === true && referenced === false;
}

function git(root, args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  const root = resolve(option("root", process.cwd()));
  if (command === "create") {
    const plan = buildWorktreePlan(process.argv[3], root, option("base", "origin/main"));
    git(root, ["rev-parse", "--verify", option("base", "origin/main")]);
    process.stdout.write(git(root, plan.args));
  } else if (command === "audit") {
    process.stdout.write(git(root, ["worktree", "list", "--porcelain"]));
  } else {
    process.stderr.write("Usage: worktree-factory.mjs create <slug> [--root PATH] [--base REF] | audit [--root PATH]\n");
    process.exitCode = 2;
  }
}
