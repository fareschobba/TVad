// test/alerts/quietHours.test.js
const { expect } = require('chai');
const { isQuietHours } = require('../../src/services/alerts/quietHours');

// Quiet window 23:59 -> 08:00 in Africa/Tunis (UTC+1, no DST).
const quiet = { start: '23:59', end: '08:00', tz: 'Africa/Tunis' };

// Helper: build a Date at a given UTC time.
const at = (iso) => new Date(iso);

describe('isQuietHours', () => {
  it('is quiet at 02:00 Tunis (01:00 UTC)', () => {
    expect(isQuietHours(at('2026-05-28T01:00:00Z'), quiet)).to.equal(true);
  });
  it('is NOT quiet at 12:00 Tunis (11:00 UTC)', () => {
    expect(isQuietHours(at('2026-05-28T11:00:00Z'), quiet)).to.equal(false);
  });
  it('is quiet exactly at 23:59 Tunis (22:59 UTC)', () => {
    expect(isQuietHours(at('2026-05-28T22:59:00Z'), quiet)).to.equal(true);
  });
  it('is NOT quiet exactly at 08:00 Tunis (07:00 UTC) — window end is exclusive', () => {
    expect(isQuietHours(at('2026-05-28T07:00:00Z'), quiet)).to.equal(false);
  });
  it('is quiet at 07:59 Tunis (06:59 UTC)', () => {
    expect(isQuietHours(at('2026-05-28T06:59:00Z'), quiet)).to.equal(true);
  });
});
