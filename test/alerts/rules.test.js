// test/alerts/rules.test.js
const { expect } = require('chai');
const { isOffline, isStopped, isStuck, isBackgrounded } = require('../../src/services/alerts/rules');

const MIN = 60000;
const cfg = {
  rules: {
    OFFLINE:      { thresholdMs: 15 * MIN },
    STOPPED:      { thresholdMs: 12 * MIN },
    STUCK:        { thresholdMs: 10 * MIN },
    BACKGROUNDED: { thresholdMs:  5 * MIN }
  }
};
const NOW = 1_000_000_000;

describe('isOffline', () => {
  it('true when socket gone AND last contact older than threshold', () => {
    const ctx = { now: NOW, online: false, lastSeenAt: NOW - 16 * MIN };
    expect(isOffline(ctx, cfg)).to.equal(true);
  });
  it('false when socket still connected (even if stale)', () => {
    const ctx = { now: NOW, online: true, lastSeenAt: NOW - 60 * MIN };
    expect(isOffline(ctx, cfg)).to.equal(false);
  });
  it('false when never seen (lastSeenAt null) — UNKNOWN is not DOWN', () => {
    const ctx = { now: NOW, online: false, lastSeenAt: null };
    expect(isOffline(ctx, cfg)).to.equal(false);
  });
  it('false when gone only 10 min (under threshold)', () => {
    const ctx = { now: NOW, online: false, lastSeenAt: NOW - 10 * MIN };
    expect(isOffline(ctx, cfg)).to.equal(false);
  });
});

describe('isStopped', () => {
  it('true when online and not-playing has held past threshold', () => {
    const ctx = { now: NOW, online: true, notPlayingSince: NOW - 13 * MIN };
    expect(isStopped(ctx, cfg)).to.equal(true);
  });
  it('false when currently playing (notPlayingSince null)', () => {
    const ctx = { now: NOW, online: true, notPlayingSince: null };
    expect(isStopped(ctx, cfg)).to.equal(false);
  });
  it('false when offline (offline rule owns that)', () => {
    const ctx = { now: NOW, online: false, notPlayingSince: NOW - 60 * MIN };
    expect(isStopped(ctx, cfg)).to.equal(false);
  });
  it('false when not-playing only 5 min', () => {
    const ctx = { now: NOW, online: true, notPlayingSince: NOW - 5 * MIN };
    expect(isStopped(ctx, cfg)).to.equal(false);
  });
});

describe('isStuck', () => {
  it('true when playing, same ad past threshold, and a stuck pulse seen within window', () => {
    const ctx = { now: NOW, online: true, isPlaying: true,
      lastAdChangedAt: NOW - 11 * MIN, lastStuckPulseAt: NOW - 2 * MIN };
    expect(isStuck(ctx, cfg)).to.equal(true);
  });
  it('false when no stuck pulse within window (likely a legitimately long ad)', () => {
    const ctx = { now: NOW, online: true, isPlaying: true,
      lastAdChangedAt: NOW - 11 * MIN, lastStuckPulseAt: null };
    expect(isStuck(ctx, cfg)).to.equal(false);
  });
  it('false when ad changed recently', () => {
    const ctx = { now: NOW, online: true, isPlaying: true,
      lastAdChangedAt: NOW - 2 * MIN, lastStuckPulseAt: NOW - 1 * MIN };
    expect(isStuck(ctx, cfg)).to.equal(false);
  });
  it('false when not playing', () => {
    const ctx = { now: NOW, online: true, isPlaying: false,
      lastAdChangedAt: NOW - 30 * MIN, lastStuckPulseAt: NOW - 1 * MIN };
    expect(isStuck(ctx, cfg)).to.equal(false);
  });
});

describe('isBackgrounded', () => {
  it('true when online and not-foreground has held past threshold', () => {
    const ctx = { now: NOW, online: true, notForegroundSince: NOW - 6 * MIN };
    expect(isBackgrounded(ctx, cfg)).to.equal(true);
  });
  it('false when currently foreground (notForegroundSince null)', () => {
    const ctx = { now: NOW, online: true, notForegroundSince: null };
    expect(isBackgrounded(ctx, cfg)).to.equal(false);
  });
  it('false when offline (offline rule owns disconnected devices)', () => {
    const ctx = { now: NOW, online: false, notForegroundSince: NOW - 60 * MIN };
    expect(isBackgrounded(ctx, cfg)).to.equal(false);
  });
  it('false when not-foreground only 2 min (under 5 min threshold)', () => {
    const ctx = { now: NOW, online: true, notForegroundSince: NOW - 2 * MIN };
    expect(isBackgrounded(ctx, cfg)).to.equal(false);
  });
});
