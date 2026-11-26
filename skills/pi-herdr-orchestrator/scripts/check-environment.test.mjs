import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import {
  codegraphCheck,
  compareVersions,
  findPlugin,
  heelerHostHelper,
  herdrAppPath,
  herdrPluginStatus,
  packageLocalGentleAiBinary,
  parsePluginList,
  schemaProtocol,
  tempHeadroomCheck,
} from "./check-environment.mjs";

test("temporary filesystem headroom blocks dispatch below ten percent free", () => {
  const check = tempHeadroomCheck("/tmp", () => ({ bavail: 9, blocks: 100, bsize: 1 }));
  assert.equal(check.id, "temp-headroom");
  assert.equal(check.status, "blocked");
  assert.equal(check.free_bytes, 9);
  assert.equal(check.total_bytes, 100);
});

test("temporary filesystem headroom passes at or above ten percent free", () => {
  const check = tempHeadroomCheck("/tmp", () => ({ bavail: 10, blocks: 100, bsize: 1 }));
  assert.equal(check.status, "installed");
  assert.equal(check.free_ratio, 0.1);
});

test("temporary filesystem headroom fails closed when statfs is unavailable", () => {
  const check = tempHeadroomCheck("/tmp", () => {
    throw new Error("statfs failed");
  });
  assert.equal(check.status, "blocked");
  assert.equal(check.error, "statfs failed");
});

test("package-local Gentle AI detection finds a versioned binary independently of package version", () => {
  const packagePath = join("/tmp", "node_modules", "gentle-pi", "package.json");
  const binaryPath = join("/tmp", "node_modules", "gentle-pi", ".gentle-ai", "v4.6.0", "gentle-ai");
  const found = packageLocalGentleAiBinary(
    packagePath,
    () => ["v4.6.0"],
    (path) => path === binaryPath,
  );
  assert.equal(found, binaryPath);
});

test("package-local Gentle AI detection reports a missing binary", () => {
  const found = packageLocalGentleAiBinary(
    "/tmp/node_modules/gentle-pi/package.json",
    () => ["v5.0.0"],
    () => false,
  );
  assert.equal(found, null);
});

test("Herdr plugin list parsing accepts the CLI JSON envelope and rejects other payloads", () => {
  const envelope = '{"id":"cli:plugin","result":{"plugins":[{"plugin_id":"heeler"}],"type":"plugin_list"}}';
  assert.equal(parsePluginList(envelope).length, 1);
  assert.equal(parsePluginList('{"result":{"plugins":[]}}').length, 0);
  assert.equal(parsePluginList("not json"), null);
  assert.equal(parsePluginList('{"result":{"plugins":{}}}'), null);
  assert.equal(parsePluginList('{"plugins":[]}'), null);
});

test("Herdr plugin selection matches the exact plugin identifier", () => {
  const plugins = [{ plugin_id: "agent-notify" }, { plugin_id: "heeler", version: "0.10.1" }];
  assert.equal(findPlugin(plugins, "heeler").version, "0.10.1");
  assert.equal(findPlugin(plugins, "heel"), null);
  assert.equal(findPlugin(null, "heeler"), null);
});

test("Herdr versions compare numerically and tolerate command prefixes", () => {
  assert.equal(compareVersions("0.9.5", "0.10.0"), -1);
  assert.equal(compareVersions("0.10.0", "0.9.5"), 1);
  assert.equal(compareVersions("herdr 0.9.5", "0.9.5"), 0);
  assert.equal(compareVersions("hc 0.1.21", "0.1.21"), 0);
  assert.equal(compareVersions("0.9.5-beta.1", "0.9.5"), -1);
  assert.equal(compareVersions("0.9.5", "0.9.5-beta.1"), 1);
  assert.equal(compareVersions("unknown", "0.9.5"), null);
  assert.equal(compareVersions(null, "0.9.5"), null);
});

test("Heeler plugin status preserves installed, incompatible, disabled, blocked and missing", () => {
  const plugin = { plugin_id: "heeler", version: "0.10.1", min_herdr_version: "0.7.5", enabled: true };
  assert.equal(herdrPluginStatus(plugin, "herdr 0.9.5"), "installed");
  assert.equal(herdrPluginStatus({ ...plugin, min_herdr_version: "0.10.0" }, "herdr 0.9.5"), "incompatible");
  assert.equal(herdrPluginStatus({ ...plugin, enabled: false }, "herdr 0.9.5"), "disabled");
  assert.equal(herdrPluginStatus(plugin, null), "blocked");
  assert.equal(herdrPluginStatus(plugin, "not-a-version"), "blocked");
  assert.equal(herdrPluginStatus(null, "herdr 0.9.5"), "missing");
  assert.equal(herdrPluginStatus({ plugin_id: "heeler", enabled: true }, "herdr 0.9.5"), "installed");
});

test("Herdr socket API protocol is read from the bundled schema metadata", () => {
  assert.equal(schemaProtocol('{"protocol":22,"schema_version":1}'), 22);
  assert.equal(schemaProtocol('{"protocol":"22"}'), null);
  assert.equal(schemaProtocol('{"schemas":{}}'), null);
  assert.equal(schemaProtocol("not json"), null);
});

test("Heeler host-helper version is read from the known local path", () => {
  const root = join("/home", "operator", ".local", "share", "heeler", "host-helper");
  const metadataPath = join(root, "app", "version.json");
  const files = new Map([[metadataPath, { version: "0.5.12" }]]);
  const check = heelerHostHelper(root, (path) => files.has(path), (path) => files.get(path) ?? null);
  assert.equal(check.id, "heeler-host-helper");
  assert.equal(check.status, "installed");
  assert.equal(check.version, "0.5.12");
  assert.equal(check.path, metadataPath);
});

test("Heeler host-helper reports a missing path and unreadable metadata", () => {
  assert.equal(heelerHostHelper("/absent", () => false, () => null).status, "missing");
  assert.equal(heelerHostHelper("/root", () => true, () => null).status, "blocked");
  assert.equal(heelerHostHelper("/root", () => true, () => ({})).status, "blocked");
  assert.equal(heelerHostHelper("/root", () => true, () => ({ version: 5 })).status, "blocked");
});

test("Herdr desktop app presence uses documented per-platform install paths", () => {
  const linuxPath = join("/home", "operator", ".local", "bin", "herdr-app");
  assert.equal(herdrAppPath({ platform: "linux", home: "/home/operator", env: {} }, (path) => path === linuxPath), linuxPath);
  assert.equal(herdrAppPath({ platform: "linux", home: "/home/operator", env: {} }, () => false), null);

  const macPath = join("/Applications", "Herdr.app", "Contents", "MacOS", "Herdr");
  assert.equal(herdrAppPath({ platform: "darwin", home: "/Users/operator", env: {} }, (path) => path === macPath), macPath);

  const localAppData = join("/users", "operator", "AppData", "Local");
  const windowsPath = join(localAppData, "Programs", "herdr-app", "herdr-app.exe");
  const probe = { platform: "win32", home: "/users/operator", env: { LOCALAPPDATA: localAppData } };
  assert.equal(herdrAppPath(probe, (path) => path === windowsPath), windowsPath);
  assert.equal(herdrAppPath({ platform: "win32", home: "/users/operator", env: {} }, (path) => path.includes("AppData")), join(
    "/users", "operator", "AppData", "Local", "Programs", "herdr-app", "herdr-app.exe",
  ));
});

test("CodeGraph capability is installed when the CLI version is available", () => {
  const check = codegraphCheck("/repo", "1.2.3", () => false);
  assert.equal(check.id, "codegraph");
  assert.equal(check.status, "installed");
  assert.equal(check.version, "1.2.3");
  assert.equal(check.index_path, null);
});

test("CodeGraph capability is installed when a worktree-local index exists", () => {
  const indexPath = join("/repo", ".codegraph");
  const check = codegraphCheck("/repo", null, (path) => path === indexPath);
  assert.equal(check.status, "installed");
  assert.equal(check.version, null);
  assert.equal(check.index_path, indexPath);
});

test("CodeGraph capability is missing without CLI or index", () => {
  const check = codegraphCheck("/repo", null, () => false);
  assert.equal(check.status, "missing");
  assert.equal(check.index_path, null);
});
