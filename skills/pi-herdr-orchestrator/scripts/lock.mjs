// Lightweight atomic lock based on directory creation (atomic on all POSIX/Windows filesystems)
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

function cleanupWarning(scope, error) {
  if (!["ENOENT", "ENOTEMPTY", "EEXIST"].includes(error.code)) process.emitWarning(`[ORCH_LOCK_CLEANUP_FAILED] ${scope}: ${error.message}`);
}

function processExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

function linuxBirth(pid) {
  if (process.platform !== "linux") return undefined;
  const bootId = readFileSync("/proc/sys/kernel/random/boot_id", "utf8").trim();
  let stat;
  try {
    stat = readFileSync(`/proc/${pid}/stat`, "utf8");
  } catch (error) {
    if (error.code === "ENOENT" && !processExists(pid)) return undefined;
    throw error;
  }
  const end = stat.lastIndexOf(") ");
  if (end < 0 || !stat.startsWith(`${pid} (`)) throw new Error("Invalid Linux process stat");
  const startTicks = stat.slice(end + 2).trim().split(/\s+/)[19];
  if (!bootId || !startTicks) throw new Error("Invalid Linux process identity");
  return { bootId, startTicks };
}

function readOwner(lockDir, read = readFileSync) {
  try {
    return { owner: JSON.parse(read(join(lockDir, "owner.json"), "utf8")) };
  } catch (error) {
    return { error };
  }
}

function ownerIsAlive(owner) {
  if (!owner) return false;
  if (!Number.isInteger(owner.pid) || owner.pid <= 0) return true;
  if (!processExists(owner.pid)) return false;
  if (process.platform !== "linux" || owner.linuxBirth === undefined) return true;
  if (!owner.linuxBirth || typeof owner.linuxBirth !== "object" || typeof owner.linuxBirth.bootId !== "string" || typeof owner.linuxBirth.startTicks !== "string") return true;
  const current = linuxBirth(owner.pid);
  return current !== undefined && current.bootId === owner.linuxBirth.bootId && current.startTicks === owner.linuxBirth.startTicks;
}

function sameOwner(left, right) {
  return Boolean(left && right && left.pid === right.pid && left.id === right.id
    && JSON.stringify(left.linuxBirth ?? null) === JSON.stringify(right.linuxBirth ?? null));
}

export function reclaimStaleLock(lockDir, { statSync: stat = statSync, readFileSync: read = readFileSync, unlinkSync: unlink = unlinkSync, rmdirSync: rmdir = rmdirSync } = {}) {
  const stats = stat(lockDir);
  if (Date.now() - stats.mtimeMs <= 15000) return false;
  const observed = readOwner(lockDir, read);
  if (observed.error || ownerIsAlive(observed.owner)) return false;
  const current = readOwner(lockDir, read);
  if (current.error || !sameOwner(observed.owner, current.owner)) return false;
  unlink(join(lockDir, "owner.json"));
  rmdir(lockDir);
  return true;
}

function publishOwner(lockDir, owner) {
  const temporary = join(lockDir, `.owner-${owner.id}.tmp`);
  try {
    writeFileSync(temporary, JSON.stringify(owner), { encoding: "utf8", mode: 0o600, flag: "wx" });
    renameSync(temporary, join(lockDir, "owner.json"));
  } finally {
    try { unlinkSync(temporary); } catch (error) { cleanupWarning("remove temporary owner", error); }
  }
}

function removeLockFiles(lockDir) {
  try { unlinkSync(join(lockDir, "owner.json")); } catch (error) { cleanupWarning("remove owner", error); }
  try { rmdirSync(lockDir); } catch (error) { cleanupWarning("remove lock directory", error); }
}

function releaseLock(lockDir, id) {
  try {
    const owner = JSON.parse(readFileSync(join(lockDir, "owner.json"), "utf8"));
    if (owner.id !== id) return;
  } catch (error) {
    cleanupWarning("read owner", error);
    return;
  }
  removeLockFiles(lockDir);
}

export function withLock(filePath, fn, timeoutMs = 5000) {
  const lockDir = join(dirname(filePath), `.${basename(filePath)}.lock`);
  const start = Date.now();
  const id = randomUUID();
  let acquired = false;

  while (!acquired) {
    try {
      mkdirSync(lockDir);
      try {
        const owner = { pid: process.pid, id, linuxBirth: linuxBirth(process.pid) };
        if (owner.linuxBirth === undefined) delete owner.linuxBirth;
        publishOwner(lockDir, owner);
        acquired = true;
      } catch (error) {
        removeLockFiles(lockDir);
        throw error;
      }
    } catch (err) {
      if (err.code === "EEXIST") {
        // Reclaim stale locks only when the recorded process identity is gone.
        try {
          if (reclaimStaleLock(lockDir)) continue;
        } catch (error) {
          cleanupWarning("reclaim stale lock", error);
        }

        if (Date.now() - start > timeoutMs) {
          throw new Error(`Timed out waiting for lock: ${lockDir}`);
        }
        // Busy wait with small synchronous pause
        const waitTill = Date.now() + 50;
        while (Date.now() < waitTill) { /* spin */ }
      } else {
        throw err;
      }
    }
  }

  try {
    return fn();
  } finally {
    releaseLock(lockDir, id);
  }
}
