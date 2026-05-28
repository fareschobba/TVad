// test/alerts/store.test.js
const { expect } = require('chai');
const sinon = require('sinon');
const Model = require('../../src/models/deviceAlertStatus');
const { createStore } = require('../../src/services/alerts/store');

describe('alerts store', () => {
  afterEach(() => sinon.restore());

  it('loadAll converts Mongo docs (Dates) into an in-memory numeric track map', async () => {
    const t = new Date('2026-05-28T09:00:00Z');
    sinon.stub(Model, 'find').returns({ lean: () => Promise.resolve([
      { deviceId: 'AB12C', lastSeenAt: t, online: false,
        lastSnapshot: { playerState: 'idle', currentAd: 'p1', isStuck: false, appState: 'foreground' },
        timers: { notPlayingSince: t, lastAdValue: 'p1', lastAdChangedAt: t, lastStuckPulseAt: null },
        incidents: { OFFLINE: { state: 'FIRING', badSince: t, entrySentAt: t, lastNotifiedAt: t },
                     STOPPED: { state: 'OK' }, STUCK: { state: 'OK' } } }
    ]) });

    const store = createStore({ Model });
    await store.loadAll();
    const track = store.get('AB12C');
    expect(track.lastSeenAt).to.equal(t.getTime());
    expect(track.timers.lastAdChangedAt).to.equal(t.getTime());
    expect(track.incidents.OFFLINE.state).to.equal('FIRING');
    expect(track.incidents.OFFLINE.entrySentAt).to.equal(t.getTime());
    expect(store.deviceIds()).to.deep.equal(['AB12C']);
  });

  it('upsert writes the track back as Dates via updateOne', async () => {
    const update = sinon.stub(Model, 'updateOne').resolves({});
    const store = createStore({ Model });
    const now = 1716800000000;
    store.set('XY99Z', {
      deviceId: 'XY99Z', lastSeenAt: now, online: true,
      lastSnapshot: { playerState: 'playing', currentAd: 'p2', isStuck: false, appState: 'foreground' },
      timers: { notPlayingSince: null, lastAdValue: 'p2', lastAdChangedAt: now, lastStuckPulseAt: null },
      incidents: { OFFLINE: { state: 'OK', badSince: null, entrySentAt: null, lastNotifiedAt: null },
                   STOPPED: { state: 'OK', badSince: null, entrySentAt: null, lastNotifiedAt: null },
                   STUCK:   { state: 'OK', badSince: null, entrySentAt: null, lastNotifiedAt: null } }
    });
    await store.persist('XY99Z');
    expect(update.calledOnce).to.equal(true);
    const [filter, doc, opts] = update.firstCall.args;
    expect(filter).to.deep.equal({ deviceId: 'XY99Z' });
    expect(doc.$set.lastSeenAt).to.be.instanceOf(Date);
    expect(doc.$set.lastSeenAt.getTime()).to.equal(now);
    expect(opts).to.deep.equal({ upsert: true });
  });
});
