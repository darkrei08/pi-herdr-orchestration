import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";
import registerWorkflowAutostart, {
  MARKER,
  resolveRegistryUrl,
  withDirective,
} from "./workflow-autostart.mjs";

test("the autostart directive is idempotent and includes the context tool directive", () => {
  const once = withDirective("base prompt");
  assert.match(once, /@sting8k\/pi-vcc/);
  assert.match(once, /vcc_recall/);
  assert.match(once, /gentle-engram/);
  assert.match(once, /builtin:codemode/);
  assert.equal(withDirective(once), once);
  assert.ok(once.includes(MARKER));
});

test("registry resolution falls back to the local fork when typebox is missing from npm root", async () => {
  const url = await resolveRegistryUrl({
    resolve: () => { throw new Error("ERR_MODULE_NOT_FOUND"); },
    require: { resolve: () => { throw new Error("MODULE_NOT_FOUND"); } },
    exists: (candidate) => candidate === "/fake/packages/core/dist/src/registry.js",
    localForks: ["/fake/packages/core/dist/src/registry.js"],
    warn: () => {},
    home: "/home/pi",
  });
  assert.equal(url, pathToFileURL("/fake/packages/core/dist/src/registry.js").href);
});

test("falls back to the local registry when the npm registry fails to import", async () => {
  const registrations = [];
  const attempted = [];
  const pi = { on() {} };
  await registerWorkflowAutostart(pi, {
    candidateUrls: ["file:///bad-npm-registry.js", "file:///local-registry.js"],
    importModule: async (url) => {
      attempted.push(url);
      if (url.includes("bad-npm")) throw new Error("Cannot find package 'typebox'");
      return { registerWorkflowExtension: (value) => registrations.push(value) };
    },
    readPackage: () => '{"version":"1.3.1"}',
    warn: () => {},
  });
  assert.equal(registrations.length, 1);
  assert.deepEqual(attempted, ["file:///bad-npm-registry.js", "file:///local-registry.js"]);
});

test("registers agentPreparationHooks and appends the directive to child prompts", async () => {
  const handlers = new Map();
  const registrations = [];
  const pi = { on: (name, handler) => handlers.set(name, handler) };
  await registerWorkflowAutostart(pi, {
    candidateUrls: ["file:///fake/registry.js"],
    importModule: async () => ({
      registerWorkflowExtension: (value) => registrations.push(value),
    }),
    readPackage: () => '{"version":"1.3.1"}',
    warn: () => {},
  });
  assert.equal(registrations.length, 1);
  assert.equal(registrations[0].agentPreparationHooks.herdrWorkflowLoadout.priority, Number.MAX_SAFE_INTEGER - 1);
  const configuration = { systemPromptAppend: "child prompt" };
  registrations[0].agentPreparationHooks.herdrWorkflowLoadout.prepare(configuration);
  assert.match(configuration.systemPromptAppend, /@sting8k\/pi-vcc/);
  assert.match(configuration.systemPromptAppend, /child prompt/);
});
