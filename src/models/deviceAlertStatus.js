// src/models/deviceAlertStatus.js
const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema({
  state:         { type: String, enum: ['OK', 'FIRING'], default: 'OK' },
  badSince:      { type: Date, default: null },
  entrySentAt:   { type: Date, default: null },
  lastNotifiedAt:{ type: Date, default: null }
}, { _id: false });

const deviceAlertStatusSchema = new mongoose.Schema({
  deviceId: { type: String, unique: true, required: true, index: true },
  lastSeenAt: { type: Date, default: null },
  online: { type: Boolean, default: false },
  lastSnapshot: {
    playerState: { type: String, default: null },
    currentAd:   { type: String, default: null },
    isStuck:     { type: Boolean, default: false },
    appState:    { type: String, default: null }
  },
  timers: {
    notPlayingSince:    { type: Date, default: null },
    notForegroundSince: { type: Date, default: null },
    lastAdValue:        { type: String, default: null },
    lastAdChangedAt:    { type: Date, default: null },
    lastStuckPulseAt:   { type: Date, default: null }
  },
  incidents: {
    OFFLINE:      { type: incidentSchema, default: () => ({}) },
    STOPPED:      { type: incidentSchema, default: () => ({}) },
    STUCK:        { type: incidentSchema, default: () => ({}) },
    BACKGROUNDED: { type: incidentSchema, default: () => ({}) }
  },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DeviceAlertStatus', deviceAlertStatusSchema);
