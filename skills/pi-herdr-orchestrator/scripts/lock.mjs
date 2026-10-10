// Lightweight atomic lock based on directory creation (atomic on all POSIX/Windows filesystems)
import { mkdirSync, rmdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

export function withLock(filePath, fn, timeoutMs = 5000) {
  const lockDir = join(dirname(filePath), `.${filePath.split("/").pop()}.lock`);
  const start = Date.now();
  let acquired = false;

  while (!acquired) {
    try {
      mkdirSync(lockDir);
      acquired = true;
    } catch (err) {
      if (err.code === "EEXIST") {
        // Check for stale lock (older than 15s)
        try {
          const stats = statSync(lockDir);
          if (Date.now() - stats.mtimeMs > 15000) {
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
    try { rmdirSync(lockDir); } catch { /* ignore */ }
  }
}
