// src/services/alerts/store.js
const { freshIncident } = require('./stateMachine');
const { RULE_IDS } = require('../../config/alerts');

const msOf = (d) => (d ? new Date(d).getTime() : null);
const dateOf = (ms) => (ms == null ? null : new Date(ms));

function incidentToMs(i = {}) {
  return {
    state: i.state || 'OK',
    badSince: msOf(i.badSince),
    entrySentAt: msOf(i.entrySentAt),
    lastNotifiedAt: msOf(i.lastNotifiedAt)
  };
}
function incidentToDate(i = freshIncident()) {
  return {
    state: i.state || 'OK',
    badSince: dateOf(i.badSince),
    entrySentAt: dateOf(i.entrySentAt),
    lastNotifiedAt: dateOf(i.lastNotifiedAt)
  };
}

function docToTrack(doc) {
  const incidents = {};
  for (const r of RULE_IDS) incidents[r] = incidentToMs(doc.incidents && doc.incidents[r]);
  const t = doc.timers || {};
  return {
    deviceId: doc.deviceId,
    lastSeenAt: msOf(doc.lastSeenAt),
    online: !!doc.online,
    lastSnapshot: {
      playerState: doc.lastSnapshot?.playerState ?? null,
      currentAd: doc.lastSnapshot?.currentAd ?? null,
      isStuck: !!doc.lastSnapshot?.isStuck,
      appState: doc.lastSnapshot?.appState ?? null
    },
    timers: {
      notPlayingSince: msOf(t.notPlayingSince),
      lastAdValue: t.lastAdValue ?? null,
      lastAdChangedAt: msOf(t.lastAdChangedAt),
      lastStuckPulseAt: msOf(t.lastStuckPulseAt)
    },
    incidents
  };
}

function trackToDoc(track) {
  const incidents = {};
  for (const r of RULE_IDS) incidents[r] = incidentToDate(track.incidents[r]);
  return {
    deviceId: track.deviceId,
    lastSeenAt: dateOf(track.lastSeenAt),
    online: track.online,
    lastSnapshot: track.lastSnapshot,
    timers: {
      notPlayingSince: dateOf(track.timers.notPlayingSince),
      lastAdValue: track.timers.lastAdValue,
      lastAdChangedAt: dateOf(track.timers.lastAdChangedAt),
      lastStuckPulseAt: dateOf(track.timers.lastStuckPulseAt)
    },
    incidents,
    updatedAt: new Date()
  };
}

function newTrack(deviceId) {
  const incidents = {};
  for (const r of RULE_IDS) incidents[r] = freshIncident();
  return {
    deviceId,
    lastSeenAt: null,
    online: false,
    lastSnapshot: { playerState: null, currentAd: null, isStuck: false, appState: null },
    timers: { notPlayingSince: null, lastAdValue: null, lastAdChangedAt: null, lastStuckPulseAt: null },
    incidents
  };
}

function createStore({ Model }) {
  const cache = new Map();
  return {
    async loadAll() {
      const docs = await Model.find({}).lean();
      cache.clear();
      for (const d of docs) cache.set(d.deviceId, docToTrack(d));
    },
    get: (deviceId) => cache.get(deviceId) || null,
    getOrCreate(deviceId) {
      if (!cache.has(deviceId)) cache.set(deviceId, newTrack(deviceId));
      return cache.get(deviceId);
    },
    set: (deviceId, track) => cache.set(deviceId, track),
    deviceIds: () => Array.from(cache.keys()),
    async persist(deviceId) {
      const track = cache.get(deviceId);
      if (!track) return;
      await Model.updateOne({ deviceId }, { $set: trackToDoc(track) }, { upsert: true });
    }
  };
}

module.exports = { createStore, newTrack, docToTrack, trackToDoc };
