#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const glossaryPath = join(root, "scripts", "flow-phases.json");
const glossary = JSON.parse(readFileSync(glossaryPath, "utf8"));
const configuredRoots = process.env.FLOW_SKILL_ROOTS?.split(process.platform === "win32" ? ";" : ":").filter(Boolean);
const rootPaths = configuredRoots ?? [
  join(homedir(), ".agents", "skills"),
  join(homedir(), ".pi", "agent", "skills"),
  join(homedir(), ".pi", "agent", "npm", "node_modules", "gentle-pi", "skills"),
];
const rootNames = configuredRoots ?? ["universal", "pi", "gentle-pi"];

function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return {};
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    fields[key] = value;
  }
  return fields;
}

function scanRoot(rootPath, rootName) {
  if (!existsSync(rootPath)) return [];
  return readdirSync(rootPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(rootPath, entry.name, "SKILL.md")))
    .map((entry) => {
      const skillPath = join(rootPath, entry.name, "SKILL.md");
      const frontmatter = parseFrontmatter(readFileSync(skillPath, "utf8"));
      return { name: entry.name, root: rootName, path: skillPath, frontmatter };
    })
    .sort((a, b) => a.name.localeCompare(b.name) || a.root.localeCompare(b.root));
}

function routeSkills() {
  const result = new Map();
  for (const phase of glossary.phases) {
    for (const skill of phase.skills) result.set(skill, { phase: phase.id, status: "development" });
    for (const names of Object.values(phase.mandatoryByRoute ?? {})) {
      for (const skill of names) result.set(skill, { phase: phase.id, status: "development" });
    }
  }
  return result;
}

const copies = rootPaths.flatMap((path, index) => scanRoot(path, rootNames[index] ?? path));
const copiesByName = new Map();
for (const copy of copies) {
  if (!copiesByName.has(copy.name)) copiesByName.set(copy.name, []);
  copiesByName.get(copy.name).push(copy);
}
const previousNames = new Set((glossary.machine?.inventory ?? []).map((entry) => entry.name));
const known = routeSkills();
for (const entry of glossary.outOfDevelopment ?? []) known.set(entry.skill, { status: "out-of-development" });
const names = [...copiesByName.keys()].sort();
const inventory = names.map((name) => ({
  name,
  roots: copiesByName.get(name).map((copy) => copy.root),
  frontmatterName: copiesByName.get(name)[0].frontmatter.name ?? null,
}));
const duplicates = names
  .filter((name) => copiesByName.get(name).length > 1)
  .map((name) => ({ name, roots: copiesByName.get(name).map((copy) => copy.root) }));
const vanished = [...previousNames].filter((name) => !copiesByName.has(name)).sort();
const newUnclassified = names.filter((name) => !known.has(name)).sort();
const missingMandatory = [];
for (const phase of glossary.phases) {
  for (const [route, skills] of Object.entries(phase.mandatoryByRoute ?? {})) {
    for (const skill of skills) {
      if (!copiesByName.has(skill)) missingMandatory.push({ phase: phase.id, route, skill });
    }
  }
}
const machine = {
  inventory,
  skillDirectoryCount: copies.length,
  uniqueSkillCount: names.length,
  duplicates,
  vanished,
  newUnclassified,
  missingMandatory,
};

console.log(`Skill directories: ${copies.length}`);
console.log(`Unique skills: ${names.length}`);
console.log(`Duplicate names across roots: ${duplicates.length}`);
console.log(`Vanished skills: ${vanished.length}${vanished.length ? ` (${vanished.join(", ")})` : ""}`);
console.log(`New unclassified skills: ${newUnclassified.length}${newUnclassified.length ? ` (${newUnclassified.join(", ")})` : ""}`);
console.log(`Phases missing mandatory skills: ${missingMandatory.length}`);
if (duplicates.length) console.log(`Duplicate names: ${duplicates.map((entry) => `${entry.name} [${entry.roots.join(", ")}]`).join("; ")}`);
if (missingMandatory.length) console.log(`Missing mandatory: ${missingMandatory.map((entry) => `${entry.phase}/${entry.route}/${entry.skill}`).join(", ")}`);

if (process.argv.includes("--write")) {
  glossary.machine = machine;
  writeFileSync(glossaryPath, `${JSON.stringify(glossary, null, 2)}\n`, "utf8");
  console.log(`Wrote ${glossaryPath}`);
}

if (missingMandatory.length) process.exitCode = 1;
