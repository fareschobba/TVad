// src/config/alerts.js
const RULE_IDS = ['OFFLINE', 'STOPPED', 'STUCK'];

const min = (v, d) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
};
const bool = (v, d) => (v === undefined ? d : v === 'true');

function loadAlertConfig(env = process.env) {
  const recipients = (env.ALERT_RECIPIENTS || '')
    .split(',').map(s => s.trim()).filter(Boolean);

  const enabled = bool(env.ALERTS_ENABLED, false);

  if (enabled && recipients.length === 0) {
    console.warn('[alerts] ALERTS_ENABLED=true but ALERT_RECIPIENTS is empty — no emails will be sent.');
  }

  const cfg = {
    enabled,
    recipients,
    scanIntervalMs: min(env.ALERT_SCAN_INTERVAL_SEC, 60) * 1000,
    warmupMs: min(env.ALERT_WARMUP_MINUTES, 5) * 60000,
    quiet: {
      start: env.ALERT_QUIET_START || '23:59',
      end: env.ALERT_QUIET_END || '08:00',
      tz: env.ALERT_QUIET_TZ || 'Africa/Tunis'
    },
    rateCap: min(env.ALERT_RATE_CAP, 20),
    rateWindowMs: min(env.ALERT_RATE_WINDOW_MIN, 10) * 60000,
    playingStates: (env.ALERT_PLAYING_STATES || 'playing')
      .split(',').map(s => s.trim()).filter(Boolean),
    rules: {
      OFFLINE: { enabled: bool(env.ALERT_RULE_OFFLINE_ENABLED, true), thresholdMs: min(env.ALERT_OFFLINE_MINUTES, 15) * 60000 },
      STOPPED: { enabled: bool(env.ALERT_RULE_STOPPED_ENABLED, true), thresholdMs: min(env.ALERT_STOPPED_MINUTES, 12) * 60000 },
      STUCK:   { enabled: bool(env.ALERT_RULE_STUCK_ENABLED,   true), thresholdMs: min(env.ALERT_STUCK_MINUTES,   10) * 60000 }
    }
  };

  // Freeze deeply enough for our use (one level of nested objects).
  Object.freeze(cfg.quiet);
  Object.freeze(cfg.rules.OFFLINE);
  Object.freeze(cfg.rules.STOPPED);
  Object.freeze(cfg.rules.STUCK);
  Object.freeze(cfg.rules);
  return Object.freeze(cfg);
}

module.exports = { loadAlertConfig, RULE_IDS };
