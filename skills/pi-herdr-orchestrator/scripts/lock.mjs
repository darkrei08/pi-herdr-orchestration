// Lightweight atomic lock based on directory creation (atomic on all POSIX/Windows filesystems)
import { mkdirSync, readFileSync, rmdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

function ownerIsAlive(lockDir) {
  try {
    const owner = JSON.parse(readFileSync(join(lockDir, "owner.json"), "utf8"));
    if (!Number.isInteger(owner.pid) || owner.pid <= 0) return false;
    try {
      process.kill(owner.pid, 0);
      return true;
    } catch (error) {
      return error.code === "EPERM";
    }
  } catch {
    return false;
  }
}

export function withLock(filePath, fn, timeoutMs = 5000) {
  const lockDir = join(dirname(filePath), `.${basename(filePath)}.lock`);
  const start = Date.now();
  let acquired = false;

  while (!acquired) {
    try {
      mkdirSync(lockDir);
      try {
        writeFileSync(join(lockDir, "owner.json"), JSON.stringify({ pid: process.pid }));
        acquired = true;
      } catch (error) {
        try { unlinkSync(join(lockDir, "owner.json")); } catch { /* ignore missing owner */ }
        try { rmdirSync(lockDir); } catch { /* ignore cleanup failure */ }
        throw error;
      }
    } catch (err) {
      if (err.code === "EEXIST") {
        // Reclaim stale locks only when their recorded owner is gone.
        try {
          const stats = statSync(lockDir);
          if (Date.now() - stats.mtimeMs > 15000 && !ownerIsAlive(lockDir)) {
            try { unlinkSync(join(lockDir, "owner.json")); } catch { /* ignore missing owner */ }
            rmdirSync(lockDir);
            continue;
          }
        } catch { /* lock was already released */ }

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
    try { unlinkSync(join(lockDir, "owner.json")); } catch { /* ignore missing owner */ }
    try { rmdirSync(lockDir); } catch { /* ignore */ }
  }
}
