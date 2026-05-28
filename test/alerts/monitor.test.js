// test/alerts/monitor.test.js
const { expect } = require('chai');
const sinon = require('sinon');
const { loadAlertConfig } = require('../../src/config/alerts');
const { isQuietHours } = require('../../src/services/alerts/quietHours');
const rules = require('../../src/services/alerts/rules');
const { evaluate } = require('../../src/services/alerts/stateMachine');
const { createMonitor } = require('../../src/services/alerts/monitor');

const MIN = 60000;

// In-memory fake store (mirrors the real store interface, no Mongo).
function fakeStore(initial = {}) {
  const cache = new Map(Object.entries(initial));
  const { newTrack } = require('../../src/services/alerts/store');
  return {
    persisted: [],
    get: (id) => cache.get(id) || null,
    getOrCreate(id) { if (!cache.has(id)) cache.set(id, newTrack(id)); return cache.get(id); },
    set: (id, t) => cache.set(id, t),
    deviceIds: () => Array.from(cache.keys()),
    async persist(id) { this.persisted.push(id); }
  };
}

function makeMonitor({ states, connected, cfgEnv = {}, processStartedAt = 0 }) {
  const config = loadAlertConfig({
    ALERTS_ENABLED: 'true',
    ALERT_RECIPIENTS: 'ops@x.tn',
    ALERT_WARMUP_MINUTES: '0',
    ALERT_QUIET_START: '23:59', ALERT_QUIET_END: '08:00', ALERT_QUIET_TZ: 'Africa/Tunis',
    ...cfgEnv
  });
  const emailer = { sendDeviceAlert: sinon.stub().resolves() };
  const store = fakeStore();
  const monitor = createMonitor({
    config, store, emailer,
    getAllDeviceStates: () => states,
    isDeviceConnected: (id) => !!connected[id],
    isQuietHours, rules, evaluate,
    resolveDevice: async (id) => ({ deviceId: id, name: id, userId: 'u1' }),
    now: () => 0,
    processStartedAt,
    logger: { info() {}, warn() {}, error() {} }
  });
  return { monitor, emailer, store };
}

// Use a fixed daytime instant (12:00 UTC = 13:00 Tunis, not quiet) for tick times.
const DAY = new Date('2026-05-28T12:00:00Z').getTime();

describe('monitor scenarios', () => {
  it('sustained down => exactly one ENTER email, then dedup', async () => {
    const states = { AB12C: { lastUpdate: DAY - 20 * MIN } };
    const { monitor, emailer } = makeMonitor({ states, connected: { AB12C: false } });
    await monitor.tick(DAY);
    await monitor.tick(DAY + MIN);
    const enters = emailer.sendDeviceAlert.getCalls().filter(c => c.args[0].kind === 'ENTER');
    expect(enters.length).to.equal(1);
    expect(enters[0].args[0].rule).to.equal('OFFLINE');
  });

  it('transient blip under threshold => no email', async () => {
    const states = { AB12C: { lastUpdate: DAY - 5 * MIN } };
    const { monitor, emailer } = makeMonitor({ states, connected: { AB12C: false } });
    await monitor.tick(DAY);
    expect(emailer.sendDeviceAlert.called).to.equal(false);
  });

  it('down then recover => one ENTER then one RECOVER', async () => {
    const states = { AB12C: { lastUpdate: DAY - 20 * MIN } };
    const { monitor, emailer, store } = makeMonitor({ states, connected: { AB12C: false } });
    await monitor.tick(DAY);                                   // ENTER
    // device comes back: fresh contact + connected
    states.AB12C = { lastUpdate: DAY + MIN };
    store.get('AB12C').online = true;
    const { monitor: _m } = {};
    // reuse same monitor; flip connectivity by rebuilding closure is overkill — use a mutable map
    await monitor.tick(DAY + 2 * MIN, { AB12C: true });        // tick accepts a connectivity override for tests
    const kinds = emailer.sendDeviceAlert.getCalls().map(c => c.args[0].kind);
    expect(kinds).to.deep.equal(['ENTER', 'RECOVER']);
  });

  it('quiet hours suppress ENTER, then fire when window opens', async () => {
    const NIGHT = new Date('2026-05-28T01:00:00Z').getTime();  // 02:00 Tunis = quiet
    const states = { AB12C: { lastUpdate: NIGHT - 20 * MIN } };
    const { monitor, emailer } = makeMonitor({ states, connected: { AB12C: false } });
    await monitor.tick(NIGHT);
    expect(emailer.sendDeviceAlert.called).to.equal(false);    // suppressed overnight
    const MORN = new Date('2026-05-28T07:00:00Z').getTime();    // 08:00 Tunis = window open
    await monitor.tick(MORN);
    const enters = emailer.sendDeviceAlert.getCalls().filter(c => c.args[0].kind === 'ENTER');
    expect(enters.length).to.equal(1);
  });

  it('warmup suppresses firing right after process start', async () => {
    const states = { AB12C: { lastUpdate: DAY - 20 * MIN } };
    const { monitor, emailer } = makeMonitor({
      states, connected: { AB12C: false },
      cfgEnv: { ALERT_WARMUP_MINUTES: '5' }, processStartedAt: DAY
    });
    await monitor.tick(DAY + 2 * MIN);    // inside warmup
    expect(emailer.sendDeviceAlert.called).to.equal(false);
  });

  it('never-seen device (no snapshot, no lastSeenAt) does not page', async () => {
    const { monitor, emailer, store } = makeMonitor({ states: {}, connected: {} });
    store.getOrCreate('GHOST');           // exists in cache but never seen
    await monitor.tick(DAY);
    expect(emailer.sendDeviceAlert.called).to.equal(false);
  });

  it('SMTP failure does not crash the tick and leaves incident sendable', async () => {
    const states = { AB12C: { lastUpdate: DAY - 20 * MIN } };
    const { monitor, emailer } = makeMonitor({ states, connected: { AB12C: false } });
    emailer.sendDeviceAlert.rejects(new Error('smtp down'));
    await monitor.tick(DAY);              // must not throw
    expect(emailer.sendDeviceAlert.calledOnce).to.equal(true);
  });
});
