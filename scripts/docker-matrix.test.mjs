import assert from "node:assert/strict";
import test from "node:test";
import {
  ROWS,
  SAFETY_FLAGS,
  UsageError,
  classifyRow,
  containerScript,
  dockerRunArgs,
  exitCodeFor,
  formatList,
  main,
  parseArguments,
  renderResults,
  runMatrix,
} from "./docker-matrix.mjs";

const IMAGES = [
  "debian:13",
  "ubuntu:24.04",
  "fedora:42",
  "archlinux:latest",
  "opensuse/tumbleweed",
  "alpine:3.22",
  "node:24-bookworm-slim",
];

function fakeDocker({ version = "26.1.5", present = [], run = () => ({ status: 0, stdout: "checks=pass\n", stderr: "" }) } = {}) {
  const calls = [];
  const spawn = (bin, args) => {
    calls.push({ bin, args: [...args] });
    if (args[0] === "version") {
      return version
        ? { status: 0, stdout: `${version}\n`, stderr: "" }
        : { status: 1, stdout: "", stderr: "cannot connect to the docker daemon" };
    }
    if (args[0] === "image") {
      const image = args.at(-1);
      return present.includes(image)
        ? { status: 0, stdout: "sha256:1\n", stderr: "" }
        : { status: 1, stdout: "", stderr: "no such image" };
    }
    return run(args.find((arg) => IMAGES.includes(arg)), args, calls);
  };
  return { spawn, calls };
}

test("ROWS pins the seven linux families in a deterministic order", () => {
  assert.deepEqual(ROWS.map((row) => row.image), IMAGES);
  assert.deepEqual(ROWS.map((row) => row.id), [
    "debian-13",
    "ubuntu-24-04",
    "fedora-42",
    "archlinux",
    "opensuse-tumbleweed",
    "alpine-3-22",
    "node-24",
  ]);
});

test("formatList prints one deterministic line per pinned row", () => {
  assert.equal(formatList(), IMAGES.map((image, index) => `${index + 1}. ${ROWS[index].id} ${image}`).join("\n"));
});

test("parseArguments accepts only list and run", () => {
  assert.deepEqual(parseArguments(["list"]), { command: "list" });
  assert.deepEqual(parseArguments(["run"]), { command: "run" });
  assert.throws(() => parseArguments([]), UsageError);
  assert.throws(() => parseArguments(["pull"]), UsageError);
  assert.throws(() => parseArguments(["run", "--pull"]), UsageError);
});

test("SAFETY_FLAGS keeps the exact non-negotiable flags", () => {
  assert.deepEqual(SAFETY_FLAGS, [
    "--rm",
    "--pull=never",
    "--network",
    "none",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    "--read-only",
  ]);
});

test("dockerRunArgs carries safety flags, bounds, read-only mount and scratch state", () => {
  const args = dockerRunArgs(ROWS[0], { repoRoot: "/repo", stateRoot: "/state-root" });
  assert.equal(args[0], "run");
  assert.deepEqual(args.slice(1, 1 + SAFETY_FLAGS.length), SAFETY_FLAGS);
  assert.equal(args[args.indexOf("--cpus") + 1], "2");
  assert.equal(args[args.indexOf("--memory") + 1], "2g");
  assert.ok(args.includes("/repo:/repo:ro") || args.includes("type=bind,src=/repo,dst=/repo,readonly"));
  assert.ok(args.some((arg) => arg.startsWith("type=bind") && arg.includes("dst=/state") && !arg.includes("readonly")));
  assert.ok(args.includes("/tmp"));
  const envFlags = args.flatMap((arg, index) => (arg === "--env" ? [args[index + 1]] : []));
  assert.deepEqual(envFlags, ["HOME=/state"]);
  assert.ok(!args.some((arg) => arg.includes("--privileged") || arg.includes("--network=host") || arg.includes("--pull=always")));
  assert.equal(args[args.indexOf(ROWS[0].image) + 1], "sh");
});

test("containerScript probes the runtimes and runs the repository checks", () => {
  const script = containerScript();
  for (const bin of ["node", "npm", "rustc", "cargo", "fast-anything", "optimaizr"]) {
    assert.ok(script.includes(`command -v ${bin}`), `missing probe for ${bin}`);
  }
  assert.ok(script.includes("node scripts/lint.mjs"));
  assert.ok(script.includes("npm test"));
  assert.ok(script.includes("exit 78"));
  assert.ok(script.includes("checks=unavailable"));
  assert.ok(script.includes("checks=pass"));
});

test("classifyRow never turns a missing image into PASS", () => {
  const blocked = classifyRow({ imagePresent: false, result: { status: 0, stdout: "checks=pass\n" } });
  assert.equal(blocked.status, "BLOCKED");
  assert.match(blocked.detail, /not present locally/);
  assert.equal(classifyRow({ imagePresent: true, result: { status: 78, stdout: "checks=unavailable\n" } }).status, "BLOCKED");
  assert.equal(classifyRow({ imagePresent: true, result: { status: 0, stdout: "runtime node=missing\nchecks=unavailable\n" } }).status, "BLOCKED");
  assert.equal(classifyRow({ imagePresent: true, result: { status: 0, stdout: "checks=pass\n" } }).status, "PASS");
  assert.equal(classifyRow({ imagePresent: true, result: { status: 1, stdout: "checks=fail\n" } }).status, "FAIL");
  assert.equal(classifyRow({ imagePresent: true, result: { status: 0, stdout: "runtime node=/usr/bin/node\n" } }).status, "FAIL");
  assert.equal(classifyRow({ imagePresent: true, result: { error: new Error("docker unavailable") } }).status, "NOT RUN");
});

test("exitCodeFor ranks FAIL over BLOCKED over NOT RUN over PASS", () => {
  assert.equal(exitCodeFor([{ status: "PASS" }]), 0);
  assert.equal(exitCodeFor([{ status: "PASS" }, { status: "NOT RUN" }]), 1);
  assert.equal(exitCodeFor([{ status: "NOT RUN" }, { status: "BLOCKED" }]), 2);
  assert.equal(exitCodeFor([{ status: "BLOCKED" }, { status: "FAIL" }]), 3);
});

test("runMatrix blocks every missing image without executing it", () => {
  const docker = fakeDocker({ present: [] });
  const matrix = runMatrix({ spawn: docker.spawn, repoRoot: "/repo" });
  assert.equal(matrix.docker, "26.1.5");
  assert.deepEqual(matrix.rows.map((row) => row.status), IMAGES.map(() => "BLOCKED"));
  assert.equal(docker.calls.filter((call) => call.args[0] === "run").length, 0);
  assert.equal(docker.calls.filter((call) => call.args[0] === "image").length, IMAGES.length);
  assert.equal(exitCodeFor(matrix.rows), 2);
});

test("runMatrix reports NOT RUN for every row when docker is unavailable", () => {
  const docker = fakeDocker({ version: null, present: IMAGES });
  const matrix = runMatrix({ spawn: docker.spawn, repoRoot: "/repo" });
  assert.equal(matrix.docker, null);
  assert.deepEqual(matrix.rows.map((row) => row.status), IMAGES.map(() => "NOT RUN"));
  assert.equal(docker.calls.filter((call) => call.args[0] !== "version").length, 0);
  assert.equal(exitCodeFor(matrix.rows), 1);
});

test("runMatrix reports NOT RUN when image inspection cannot reach Docker", () => {
  const calls = [];
  const spawn = (bin, args) => {
    calls.push({ bin, args });
    if (args[0] === "version") return { status: 0, stdout: "26.1.5\n", stderr: "" };
    return { status: 1, stdout: "", stderr: "Cannot connect to the Docker daemon" };
  };
  const matrix = runMatrix({ spawn, repoRoot: "/repo" });
  assert.deepEqual(matrix.rows.map((row) => row.status), IMAGES.map(() => "NOT RUN"));
  assert.equal(calls.filter((call) => call.args[0] === "run").length, 0);
  assert.equal(exitCodeFor(matrix.rows), 1);
});

test("runMatrix inspects all images first, then executes rows sequentially in pinned order", () => {
  const docker = fakeDocker({ present: IMAGES });
  const matrix = runMatrix({ spawn: docker.spawn, repoRoot: "/repo" });
  assert.deepEqual(matrix.rows.map((row) => row.status), IMAGES.map(() => "PASS"));
  const inspectIndexes = docker.calls.flatMap((call, index) => (call.args[0] === "image" ? [index] : []));
  const runIndexes = docker.calls.flatMap((call, index) => (call.args[0] === "run" ? [index] : []));
  assert.equal(Math.max(...inspectIndexes) < Math.min(...runIndexes), true);
  assert.deepEqual(
    runIndexes.map((index) => docker.calls[index].args.find((arg) => IMAGES.includes(arg))),
    IMAGES,
  );
  assert.equal(exitCodeFor(matrix.rows), 0);
  assert.match(renderResults(matrix), /summary pass=7 blocked=0 fail=0 not-run=0/);
});

test("runMatrix keeps container failures and unavailable toolchains honest", () => {
  const docker = fakeDocker({
    present: IMAGES,
    run: (image) => {
      if (image === "node:24-bookworm-slim") return { status: 0, stdout: "checks=pass\n", stderr: "" };
      if (image === "alpine:3.22") return { status: 78, stdout: "checks=unavailable\n", stderr: "" };
      return { status: 1, stdout: "checks=fail\n", stderr: "npm test failed" };
    },
  });
  const matrix = runMatrix({ spawn: docker.spawn, repoRoot: "/repo" });
  assert.deepEqual(matrix.rows.map((row) => row.status), [
    "FAIL",
    "FAIL",
    "FAIL",
    "FAIL",
    "FAIL",
    "BLOCKED",
    "PASS",
  ]);
  assert.equal(exitCodeFor(matrix.rows), 3);
});

test("renderResults is deterministic and names runtimes", () => {
  const text = renderResults({
    docker: "26.1.5",
    rows: [{ id: "debian-13", image: "debian:13", status: "BLOCKED", runtimes: [], detail: "image not present locally" }],
  });
  assert.equal(
    text,
    [
      "docker-server=26.1.5",
      "rows=1",
      'id=debian-13 image=debian:13 status=BLOCKED runtimes=none detail="image not present locally"',
      "summary pass=0 blocked=1 fail=0 not-run=0",
    ].join("\n"),
  );
});

test("renderResults counts NOT RUN rows with the documented status spelling", () => {
  const text = renderResults({
    docker: null,
    rows: ROWS.map((row) => ({ ...row, status: "NOT RUN", runtimes: [], detail: "docker unavailable" })),
  });
  assert.match(text, /summary pass=0 blocked=0 fail=0 not-run=7/);
});

test("main lists rows and reports the matrix exit code", () => {
  const written = [];
  const stdout = { write: (chunk) => written.push(chunk) };
  assert.equal(main(["list"], { stdout }), 0);
  assert.equal(written.join(""), `${formatList()}\n`);
  const docker = fakeDocker({ present: [] });
  assert.equal(main(["run"], { stdout, spawn: docker.spawn, repoRoot: "/repo" }), 2);
  assert.throws(() => main(["bogus"], { stdout }), UsageError);
});
