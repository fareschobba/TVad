// src/services/alerts/index.js
const { loadAlertConfig } = require('../../config/alerts');
const { isQuietHours } = require('./quietHours');
const rules = require('./rules');
const { evaluate } = require('./stateMachine');
const { createStore } = require('./store');
const { createMonitor } = require('./monitor');
const Model = require('../../models/deviceAlertStatus');
const socket = require('../../config/socket');
const emailer = require('../email.service');
const Device = require('../../models/device');

// Resolve display fields for an email; cheap (alerts are rare). Populates the owner so
// emails can show a human-readable username instead of a raw Mongo ObjectId. Falls back
// to deviceId / null on any error so a missing/broken ref never crashes the dispatch.
async function resolveDevice(deviceId) {
  try {
    const d = await Device.findOne({ deviceId })
      .select('name userId')
      .populate('userId', 'username email')
      .lean();
    if (!d) return { deviceId, name: deviceId, ownerName: null, ownerEmail: null };
    const owner = d.userId && typeof d.userId === 'object' ? d.userId : null;
    return {
      deviceId,
      name: d.name || deviceId,
      ownerName: owner?.username || null,
      ownerEmail: owner?.email || null
    };
  } catch {
    return { deviceId, name: deviceId, ownerName: null, ownerEmail: null };
  }
}

async function startDeviceAlerts() {
  const config = loadAlertConfig();
  const store = createStore({ Model });
  try {
    await store.loadAll();
  } catch (err) {
    console.error('[alerts] failed to load status docs on boot:', err.message);
  }
  const monitor = createMonitor({
    config, store, emailer,
    getAllDeviceStates: socket.getAllDeviceStates,
    isDeviceConnected: socket.isDeviceConnected,
    isQuietHours, rules, evaluate, resolveDevice,
    now: () => Date.now(),
    processStartedAt: Date.now(),
    logger: console
  });
  monitor.start();
  return monitor;
}

module.exports = { startDeviceAlerts };
