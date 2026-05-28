// src/services/alerts/stateMachine.js

function freshIncident() {
  // lastNotifiedAt is reserved for a future periodic re-alert feature; it is
  // currently written but never read.
  return { state: 'OK', badSince: null, entrySentAt: null, lastNotifiedAt: null };
}

// Pure transition. Never mutates the input incident; returns a new one.
function evaluate(incident, isBad, opts) {
  const { now, allowEntry, allowRecover } = opts;

  if (incident.state === 'OK') {
    if (!isBad) {
      // Clear any remembered pending badSince.
      if (incident.badSince == null) return { action: null, incident };
      return { action: null, incident: { ...incident, badSince: null } };
    }
    // isBad: remember when it first went bad (preserve across suppressed ticks).
    const badSince = incident.badSince == null ? now : incident.badSince;
    if (allowEntry) {
      return {
        action: 'ENTER',
        incident: { state: 'FIRING', badSince, entrySentAt: now, lastNotifiedAt: now }
      };
    }
    // Bad but not allowed to send yet (quiet / disabled / rate cap): keep waiting.
    return { action: null, incident: { ...incident, badSince } };
  }

  // state === 'FIRING'
  if (isBad) return { action: null, incident };                 // dedup while bad
  if (!allowRecover) return { action: null, incident };          // can't send recovery now; retry later
  return { action: 'RECOVER', incident: freshIncident() };
}

module.exports = { evaluate, freshIncident };
