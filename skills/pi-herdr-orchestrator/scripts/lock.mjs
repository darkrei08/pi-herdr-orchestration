// Atomic process-owned directory locks for concurrent mailbox mutations.
import {
  mkdirSync,
  rmdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { basename, dirname, join } from "node:path";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class LockOccupiedError extends Error {}

function processExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === "ESRCH") return false;
    throw error;
  }
}

function readLinuxBirth(pid) {
  const bootId = readFileSync("/proc/sys/kernel/random/boot_id", "utf8").trim();
  let stat;
  try {
    stat = readFileSync(`/proc/${pid}/stat`, "utf8");
  } catch (error) {
    if (error.code === "ENOENT" && !processExists(pid)) return undefined;
    throw error;
  }
  const end = stat.lastIndexOf(") ");
  const fields = end < 0 ? [] : stat.slice(end + 2).trim().split(/\s+/);
  const startTicks = fields[19];
  if (!UUID.test(bootId) || !/^\d+$/.test(startTicks ?? ""))
    throw new Error("Unable to verify lock ownership");
  return { bootId, startTicks };
}

function claimForCurrentProcess() {
  const claim = { pid: process.pid, id: randomUUID() };
  if (process.platform === "linux") claim.linuxBirth = readLinuxBirth(process.pid);
  return claim;
}

function validClaim(value, owner) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  if (
    !Number.isInteger(value.pid) ||
    value.pid <= 0 ||
    typeof value.id !== "string" ||
    !UUID.test(value.id) ||
    owner !== `${value.pid}-${value.id}`
  )
    return false;
  if (keys.length === 2) return true;
  if (
    keys.length !== 3 ||
    !value.linuxBirth ||
    typeof value.linuxBirth !== "object" ||
    Array.isArray(value.linuxBirth) ||
    Object.keys(value.linuxBirth).length !== 2 ||
    !UUID.test(value.linuxBirth.bootId) ||
    !/^\d+$/.test(value.linuxBirth.startTicks ?? "")
  )
    return false;
  return true;
}

function readOwner(lockDir) {
  let entries;
  try {
    entries = readdirSync(lockDir);
  } catch (error) {
    if (error.code === "ENOENT") throw new LockOccupiedError();
    throw new Error("Unable to verify lock ownership", { cause: error });
  }
  if (entries.length !== 1) throw new Error("Unable to verify lock ownership");
  const owner = entries[0];
  let value;
  try {
    value = JSON.parse(readFileSync(join(lockDir, owner), "utf8"));
  } catch (error) {
    throw new Error("Unable to verify lock ownership", { cause: error });
  }
  if (!validClaim(value, owner)) throw new Error("Unable to verify lock ownership");
  return { owner, claim: value };
}

function ownerIsLive(claim) {
  if (!processExists(claim.pid)) return false;
  if (process.platform !== "linux") return true;
  if (!claim.linuxBirth) throw new Error("Unable to verify lock ownership");
  const current = readLinuxBirth(claim.pid);
  if (!current) return false;
  return (
    current.bootId === claim.linuxBirth.bootId &&
    current.startTicks === claim.linuxBirth.startTicks
  );
}

function publishClaim(parent, lockDir, owner, claim) {
  const temporary = join(parent, `.${basename(lockDir)}.${randomUUID()}.tmp`);
  mkdirSync(temporary, { mode: 0o700 });
  try {
    writeFileSync(join(temporary, owner), `${JSON.stringify(claim)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    renameSync(temporary, lockDir);
  } finally {
    try { unlinkSync(join(temporary, owner)); } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    try { rmdirSync(temporary); } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
}

function recoverDeadOwner(lockDir, observed) {
  const quarantine = `${lockDir}.${randomUUID()}.stale`;
  try {
    const current = readOwner(lockDir);
    if (current.owner !== observed.owner || JSON.stringify(current.claim) !== JSON.stringify(observed.claim))
      throw new LockOccupiedError();
    renameSync(lockDir, quarantine);
  } catch (error) {
    if (error instanceof LockOccupiedError) throw error;
    if (["ENOENT", "EEXIST", "ENOTEMPTY", "EPERM"].includes(error.code))
      throw new LockOccupiedError();
    throw new Error("Unable to recover lock", { cause: error });
  }
  try {
    const current = readOwner(quarantine);
    if (current.owner !== observed.owner || JSON.stringify(current.claim) !== JSON.stringify(observed.claim))
      throw new LockOccupiedError();
    unlinkSync(join(quarantine, observed.owner));
    rmdirSync(quarantine);
  } catch (error) {
    if (error instanceof LockOccupiedError) throw error;
    throw new Error("Unable to recover lock", { cause: error });
  }
}

function acquireLock(lockDir) {
  const parent = dirname(lockDir);
  mkdirSync(parent, { recursive: true, mode: 0o700 });
  const claim = claimForCurrentProcess();
  const owner = `${claim.pid}-${claim.id}`;
  let observed;
  try {
    observed = readOwner(lockDir);
  } catch (error) {
    if (!(error instanceof LockOccupiedError)) throw error;
  }
  if (observed) {
    if (ownerIsLive(observed.claim)) throw new LockOccupiedError();
    recoverDeadOwner(lockDir, observed);
  }

  try {
    publishClaim(parent, lockDir, owner, claim);
  } catch (error) {
    if (!["EEXIST", "ENOTEMPTY", "EPERM"].includes(error.code)) throw error;
    throw new LockOccupiedError();
  }
  return () => releaseLock(lockDir, owner, claim);
}

function releaseLock(lockDir, owner, claim) {
  let observed;
  try {
    observed = readOwner(lockDir);
  } catch (error) {
    if (error instanceof LockOccupiedError) return;
    throw new Error("Unable to verify lock ownership", { cause: error });
  }
  if (observed.owner !== owner || JSON.stringify(observed.claim) !== JSON.stringify(claim))
    throw new Error("Lock ownership changed");

  const retired = `${lockDir}.${randomUUID()}.released`;
  try {
    renameSync(lockDir, retired);
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw new Error("Unable to verify lock ownership", { cause: error });
  }
  try {
    const current = readOwner(retired);
    if (current.owner !== owner || JSON.stringify(current.claim) !== JSON.stringify(claim))
      throw new Error("Lock ownership changed");
    unlinkSync(join(retired, owner));
    rmdirSync(retired);
  } catch (error) {
    throw new Error("Unable to release lock", { cause: error });
  }
}

export function withLock(filePath, fn, timeoutMs = 5000) {
  const lockDir = join(dirname(filePath), `.${basename(filePath)}.lock`);
  const start = Date.now();
  let release;

  while (!release) {
    try {
      release = acquireLock(lockDir);
    } catch (error) {
      if (!(error instanceof LockOccupiedError)) throw error;
      if (Date.now() - start > timeoutMs)
        throw new Error(`Timed out waiting for lock: ${lockDir}`);
      const waitTill = Date.now() + 50;
      while (Date.now() < waitTill) { /* synchronous lock wait */ }
    }
  }

  try {
    return fn();
  } finally {
    release();
  }
}
