import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { assertUsableRoster, inspectAgentRoster, readAgentRoster } from "./agent-roster-diagnostic.mjs";

const ROOT = "/host/.pi/agent/agents";
const path = (name) => join(ROOT, `${name}.md`);

function definition(name, frontmatter, body = "Instructions for the agent.") {
  return { path: path(name), source: `---\n${frontmatter}\n---\n\n${body}\n` };
}

const HEALTHY = [
  definition("jd-judge-a", "name: jd-judge-a\ndescription: Read-only reviewer.\ntools:\n  - read\n  - grep"),
  definition("review-risk", [
    "name: review-risk",
    "description: Risk reviewer.",
    "model: cliproxyapi/gemini-3-flash",
    "thinking: high",
    "subagent_mode: background",
    "tools: [read, bash]",
  ].join("\n")),
];

test("reports a healthy roster as usable with parsed names, tools and delegation fields", () => {
  const input = { definitions: structuredClone(HEALTHY) };
  const snapshot = structuredClone(input);

  const report = inspectAgentRoster(input);

  assert.equal(report.state, "healthy");
  assert.equal(report.verdict, "usable");
  assert.deepEqual(report.problems, []);
  assert.deepEqual(report.usableAgents, [
    { name: "jd-judge-a", path: path("jd-judge-a"), tools: ["read", "grep"] },
    { name: "review-risk", path: path("review-risk"), tools: ["read", "bash"] },
  ]);
  assert.deepEqual(input, snapshot, "inspecting a roster must not mutate it");
  assert.deepEqual(inspectAgentRoster(input), report, "the verdict is deterministic");
});

test("fails closed on an object entry inside a tools array and names the exact definition path", () => {
  const report = inspectAgentRoster({
    definitions: [
      HEALTHY[0],
      definition("gentle-ai-verify", "name: gentle-ai-verify\ntools:\n  - read\n  - \"*\": false"),
    ],
  });

  assert.equal(report.state, "malformed");
  assert.equal(report.verdict, "blocked");
  assert.deepEqual(report.usableAgents, [], "a malformed roster authorizes no Agent");
  assert.deepEqual(report.problems, [{
    path: path("gentle-ai-verify"),
    field: "tools",
    error: 'invalid tool name: "*": false',
  }]);
});

test("rejects malformed delegation fields and missing instructions", () => {
  const report = inspectAgentRoster({
    definitions: [
      definition("bad-mode", "name: bad-mode\nmode: queue", ""),
      definition("bad-thinking", "name: bad-thinking\nthinking: turbo\neffort: high"),
    ],
  });

  assert.equal(report.state, "malformed");
  assert.deepEqual(report.usableAgents, []);
  assert.deepEqual(report.problems, [
    { path: path("bad-mode"), field: "instructions", error: "no instructions after the frontmatter" },
    { path: path("bad-mode"), field: "mode", error: 'mode "queue" is not one of task, background' },
    { path: path("bad-thinking"), field: "thinking", error: 'thinking "turbo" is not one of off, minimal, low, medium, high, xhigh, max' },
  ]);
});

test("fails closed when two definitions claim the same Agent name", () => {
  const report = inspectAgentRoster({
    definitions: [HEALTHY[0], definition("jd-judge-a-copy", "name: jd-judge-a")],
  });

  assert.equal(report.state, "malformed");
  assert.equal(report.verdict, "blocked");
  assert.deepEqual(report.usableAgents, []);
  assert.deepEqual(report.problems, [{
    path: path("jd-judge-a-copy"),
    field: "name",
    error: `duplicate Agent name: jd-judge-a (also ${path("jd-judge-a")})`,
  }]);
});

test("keeps a host-reported roster rejection as a malformed problem with its definition path", () => {
  const report = inspectAgentRoster({
    definitions: [HEALTHY[0]],
    errors: [{ path: "/host/.pi/agent/agents/gentle-ai-verify.md", error: "invalid tools field" }],
  });

  assert.equal(report.state, "malformed");
  assert.equal(report.verdict, "blocked");
  assert.deepEqual(report.usableAgents, []);
  assert.deepEqual(report.problems, [{
    path: "/host/.pi/agent/agents/gentle-ai-verify.md",
    field: "definition",
    error: "invalid tools field",
  }]);
});

test("reports an empty roster as unavailable instead of usable", () => {
  const report = inspectAgentRoster({});

  assert.equal(report.state, "unavailable");
  assert.equal(report.verdict, "blocked");
  assert.deepEqual(report.usableAgents, []);
  assert.deepEqual(report.problems, [{ path: null, field: "roster", error: "roster reports no Agent definitions" }]);
});

test("reports an unavailable definition directory without reading anything", () => {
  const report = readAgentRoster({
    root: ROOT,
    readdir: () => {
      throw Object.assign(new Error("ENOENT: no such file or directory"), { code: "ENOENT" });
    },
    readFile: () => {
      throw new Error("must not read definitions when the directory is unavailable");
    },
  });

  assert.equal(report.state, "unavailable");
  assert.equal(report.verdict, "blocked");
  assert.deepEqual(report.usableAgents, []);
  assert.deepEqual(report.problems, [{
    path: ROOT,
    field: "root",
    error: "definition directory unavailable: ENOENT: no such file or directory",
  }]);
});

test("reports an empty definition directory as unavailable", () => {
  const report = readAgentRoster({ root: ROOT, readdir: () => [], readFile: () => "" });

  assert.equal(report.state, "unavailable");
  assert.equal(report.verdict, "blocked");
});

test("reads a healthy roster through the injected filesystem in deterministic order", () => {
  const sources = new Map(HEALTHY.map((entry) => [entry.path, entry.source]));
  const read = [];

  const report = readAgentRoster({
    root: ROOT,
    readdir: () => ["review-risk.md", "notes.txt", "jd-judge-a.md"],
    readFile: (file) => {
      read.push(file);
      return sources.get(file);
    },
  });

  assert.equal(report.state, "healthy");
  assert.equal(report.verdict, "usable");
  assert.deepEqual(read, [path("jd-judge-a"), path("review-risk")]);
  assert.deepEqual(report.usableAgents.map((agent) => agent.name), ["jd-judge-a", "review-risk"]);
});

test("reports an unreadable definition as malformed with its exact path", () => {
  const report = readAgentRoster({
    root: ROOT,
    readdir: () => ["jd-judge-a.md", "locked.md"],
    readFile: (file) => {
      if (file === path("locked")) throw new Error("EACCES: permission denied");
      return HEALTHY[0].source;
    },
  });

  assert.equal(report.state, "malformed");
  assert.deepEqual(report.problems, [{
    path: path("locked"),
    field: "definition",
    error: "unreadable definition: EACCES: permission denied",
  }]);
});

test("assertUsableRoster refuses a malformed roster and names the failing definition", () => {
  const report = inspectAgentRoster({
    definitions: [definition("gentle-ai-verify", "name: gentle-ai-verify\ntools:\n  - \"*\": false")],
  });

  assert.throws(
    () => assertUsableRoster(report),
    /Agent roster is not usable \(malformed\): .*gentle-ai-verify\.md.*tools/,
  );
  assert.deepEqual(assertUsableRoster(inspectAgentRoster({ definitions: HEALTHY })), inspectAgentRoster({ definitions: HEALTHY }));
});
