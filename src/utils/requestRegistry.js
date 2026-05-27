// In-memory map of requestId -> { originatorSocketId, deviceId, event, expiresAt }.
// Replaces the previous processedRequests Set (which served only dedup).
// Used by socket handlers to:
//   1) detect duplicate emissions when multiple admin tabs are open
//   2) route response events back ONLY to the originator socket
//
// Records expire after TTL_MS and a sweep runs every SWEEP_MS.

const TTL_MS = 60_000;
const SWEEP_MS = 5 * 60_000;

const registry = new Map();

function register({ requestId, originatorSocketId, deviceId, event }) {
  if (!requestId) return false;
  if (registry.has(requestId)) return false; // duplicate
  registry.set(requestId, {
    originatorSocketId,
    deviceId,
    event,
    expiresAt: Date.now() + TTL_MS
  });
  return true;
}

function lookup(requestId) {
  if (!requestId) return null;
  const entry = registry.get(requestId);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    registry.delete(requestId);
    return null;
  }
  return entry;
}

function release(requestId) {
  if (!requestId) return;
  registry.delete(requestId);
}

function size() {
  return registry.size;
}

setInterval(() => {
  const now = Date.now();
  let removed = 0;
  for (const [k, v] of registry) {
    if (v.expiresAt < now) { registry.delete(k); removed++; }
  }
  if (removed > 0) console.log(`[RequestRegistry] swept ${removed} expired entries; ${registry.size} remain`);
}, SWEEP_MS).unref?.();

module.exports = { register, lookup, release, size };
