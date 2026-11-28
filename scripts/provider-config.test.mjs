import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { BOARD_COLUMNS, EVENT_FIELDS, createEvent } from "./task-map-envelope.mjs";
import {
  CAPABILITIES,
  projectProviderCapabilities,
  resolveProviderConfig,
  validateProviderConfig,
} from "./provider-config.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const cli = join(root, "scripts", "provider-config.mjs");
const scratch = mkdtempSync(join(tmpdir(), "provider-config-test-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

function providerEntry(name, overrides = {}) {
  return {
    provider: name,
    adapter: `${name}/v1`,
    enabled: true,
    url: `https://${name}.example.test/api/v1`,
    token_ref: `env:MASTER_${name.toUpperCase()}_TOKEN`,
    ...overrides,
  };
}

function fixture() {
  const selectionEvent = createEvent({}, {
    timestamp: "2026-11-28T11:59:00.000Z",
    source: "wizard",
    from: "wizard",
    to: "selected",
    reason: "fixture provider selection",
    event_type: "wizard_selection",
    provider: "github",
    correlation_id: "wizard-1",
  }, new Date("2026-11-28T12:00:00.000Z"));
  return {
    version: "provider-config/v1",
    now: "2026-11-28T12:00:00.000Z",
    wizard: { selected: ["github", "gitlab", "gitea", "forgejo", "codeberg"] },
    local: {
      providers: [
        providerEntry("github"),
        providerEntry("gitlab"),
        providerEntry("gitea"),
        providerEntry("forgejo", { enabled: false }),
      ],
    },
    events: [selectionEvent],
  };
}

function runCli(args) {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: "utf8" });
  return { status: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function assertBlocked(report, pattern) {
  assert.equal(report.status, "BLOCKED");
  assert.equal(report.activation, "BLOCKED");
  assert.match(report.reasons.join(" | "), pattern);
}

test("validateProviderConfig accepts the fixture and reports exact counts", () => {
  const report = validateProviderConfig(fixture());
  assert.equal(report.status, "PASS");
  assert.equal(report.activation, "ALLOWED");
  assert.deepEqual(report.reasons, []);
  assert.deepEqual(report.counts, {
    wizard: 5,
    local: 4,
    selected: 3,
    skipped: 2,
    blocked: 0,
    events: 6,
    capabilities: 3,
  });
  assert.equal(report.network, 0);
  assert.equal(report.live_write, false);
});

test("resolveProviderConfig honors local values, skips unconfigured providers and audits decisions in envelope events", () => {
  const resolved = resolveProviderConfig(fixture());
  assert.deepEqual(resolved.providers.map((item) => [item.provider, item.adapter, item.url, item.token_ref, item.source]), [
    ["github", "github/v1", "https://github.example.test/api/v1", "env:MASTER_GITHUB_TOKEN", "local"],
    ["gitlab", "gitlab/v1", "https://gitlab.example.test/api/v1", "env:MASTER_GITLAB_TOKEN", "local"],
    ["gitea", "gitea/v1", "https://gitea.example.test/api/v1", "env:MASTER_GITEA_TOKEN", "local"],
  ]);
  assert.deepEqual(resolved.skipped, [
    { provider: "forgejo", reason: "disabled in local config" },
    { provider: "codeberg", reason: "not configured in local config" },
  ]);
  assert.equal(resolved.events.length, 6);
  for (const event of resolved.events) assert.deepEqual(Object.keys(event), EVENT_FIELDS);
  const decisions = resolved.events.filter((event) => event.event_type === "provider_decision");
  assert.deepEqual(decisions.map((event) => event.provider), ["github", "gitlab", "gitea", "forgejo", "codeberg"]);
  assert.deepEqual(decisions.map((event) => event.to), ["active", "active", "active", "skipped", "skipped"]);
});

test("projectProviderCapabilities exposes one stable contract over versioned native adapters", () => {
  assert.deepEqual(CAPABILITIES, ["issues", "PR", "checks", "review", "webhook", "search", "writeback"]);
  const output = projectProviderCapabilities(fixture());
  assert.equal(output.status, "PASS");
  assert.deepEqual(output.contract, [...CAPABILITIES]);
  const map = Object.fromEntries(CAPABILITIES.map((name) => [name, true]));
  assert.deepEqual(output.providers, [
    { provider: "github", adapter: "github/v1", capabilities: map, board_columns: [...BOARD_COLUMNS] },
    { provider: "gitlab", adapter: "gitlab/v1", capabilities: map, board_columns: [...BOARD_COLUMNS] },
    { provider: "gitea", adapter: "gitea/v1", capabilities: map, board_columns: [...BOARD_COLUMNS] },
  ]);

  const v2Input = fixture();
  v2Input.local.providers[0].adapter = "github/v2";
  const v2 = projectProviderCapabilities(v2Input);
  assert.equal(v2.providers[0].adapter, "github/v2");
  assert.deepEqual(v2.providers[0].capabilities, map);
});

test("wizard and local config are both required", () => {
  for (const key of ["wizard", "local"]) {
    const input = fixture();
    delete input[key];
    assertBlocked(validateProviderConfig(input), new RegExp(key === "wizard" ? "wizard is required" : "local config is required"));
  }
});

test("invalid and missing explicit URLs block activation", () => {
  const invalid = fixture();
  invalid.local.providers[2].url = "ftp://gitea.example.test/api/v1";
  assertBlocked(validateProviderConfig(invalid), /invalid url/);

  const missing = fixture();
  delete missing.local.providers[2].url;
  assertBlocked(validateProviderConfig(missing), /gitea requires an explicit url/);
});

test("missing and duplicate master token refs block activation", () => {
  const missing = fixture();
  delete missing.local.providers[2].token_ref;
  assertBlocked(validateProviderConfig(missing), /token_ref is required/);

  const duplicate = fixture();
  duplicate.local.providers[1].token_ref = duplicate.local.providers[0].token_ref;
  assertBlocked(validateProviderConfig(duplicate), /duplicate master token/);
});

test("unsupported config and native adapter versions block activation", () => {
  const configVersion = fixture();
  configVersion.version = "provider-config/v2";
  assertBlocked(validateProviderConfig(configVersion), /unsupported config version/);

  const adapterVersion = fixture();
  adapterVersion.local.providers[0].adapter = "github/v99";
  assertBlocked(validateProviderConfig(adapterVersion), /unsupported native adapter/);
});

test("wizard/file mismatch blocks activation", () => {
  const mismatch = fixture();
  mismatch.wizard.selected = mismatch.wizard.selected.filter((name) => name !== "github");
  const report = validateProviderConfig(mismatch);
  assertBlocked(report, /wizard\/file mismatch/);
  assert.equal(report.counts.blocked, 1);
});

test("raw tokens are rejected and never reflected in the report", () => {
  const secret = "ghp_fixture_secret_do_not_print";
  const input = fixture();
  input.local.providers[0].token = secret;
  const report = validateProviderConfig(input);
  assertBlocked(report, /raw token forbidden/);
  assert.equal(JSON.stringify(report).includes(secret), false);
});

test("CLI prints help without requiring input or output", () => {
  const result = runCli(["--help"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /usage: provider-config\.mjs --input <path> --output <path> \[--help\]/);
  assert.equal(result.stderr, "");
});

test("CLI writes deterministic output and reports path plus counts", () => {
  const input = join(scratch, "valid.json");
  const output = join(scratch, "valid-out.json");
  writeFileSync(input, `${JSON.stringify(fixture(), null, 2)}\n`);
  const first = runCli(["--input", input, "--output", output]);
  assert.equal(first.status, 0);
  assert.match(first.stdout, new RegExp(
    `wrote ${output.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} selected=3 skipped=2 blocked=0 events=6 `
    + "status=PASS activation=ALLOWED network=0 live_write=false tokens=redacted",
  ));
  const bytes = readFileSync(output, "utf8");
  assert.equal(JSON.parse(bytes).status, "PASS");
  const second = runCli(["--input", input, "--output", output]);
  assert.equal(second.status, 0);
  assert.equal(readFileSync(output, "utf8"), bytes);
});

test("CLI rejects malformed JSON without writing output", () => {
  const bad = join(scratch, "bad.json");
  const output = join(scratch, "bad-out.json");
  writeFileSync(bad, "not json");
  const result = runCli(["--input", bad, "--output", output]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /invalid JSON/);
  assert.equal(existsSync(output), false);
});

test("CLI writes a redacted BLOCKED report for invalid config", () => {
  const secret = "ghp_fixture_secret_do_not_print";
  const input = join(scratch, "blocked.json");
  const output = join(scratch, "blocked-out.json");
  const fixtureInput = fixture();
  fixtureInput.local.providers[0].token = secret;
  writeFileSync(input, `${JSON.stringify(fixtureInput, null, 2)}\n`);
  const result = runCli(["--input", input, "--output", output]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /blocked=1 events=6 status=BLOCKED activation=BLOCKED network=0 live_write=false tokens=redacted/);
  const bytes = readFileSync(output, "utf8");
  assert.equal(JSON.parse(bytes).status, "BLOCKED");
  assert.equal(bytes.includes(secret), false);
});
