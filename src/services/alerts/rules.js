// src/services/alerts/rules.js

// Socket not in room AND we have heard from it before AND silence exceeds threshold.
function isOffline(ctx, cfg) {
  if (ctx.online) return false;
  if (ctx.lastSeenAt == null) return false;            // never seen => UNKNOWN, not DOWN
  return (ctx.now - ctx.lastSeenAt) > cfg.rules.OFFLINE.thresholdMs;
}

// Online but not actively playing, sustained past threshold.
function isStopped(ctx, cfg) {
  if (!ctx.online) return false;                       // offline rule owns disconnected devices
  if (ctx.notPlayingSince == null) return false;       // currently playing
  return (ctx.now - ctx.notPlayingSince) > cfg.rules.STOPPED.thresholdMs;
}

// Online, claims to be playing, same ad for too long, AND a device-side stuck pulse
// was observed within the threshold window (corroboration vs a legitimately long ad).
function isStuck(ctx, cfg) {
  if (!ctx.online || !ctx.isPlaying) return false;
  if (ctx.lastAdChangedAt == null) return false;
  const t = cfg.rules.STUCK.thresholdMs;
  const adStale = (ctx.now - ctx.lastAdChangedAt) > t;
  const recentPulse = ctx.lastStuckPulseAt != null && (ctx.now - ctx.lastStuckPulseAt) <= t;
  return adStale && recentPulse;
}

module.exports = { isOffline, isStopped, isStuck };
