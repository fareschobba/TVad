// src/config/alerts.js
const RULE_IDS = ['OFFLINE', 'STOPPED', 'STUCK'];

// Strip an inline "# comment" tail (only when preceded by whitespace, so a literal '#'
// inside a real value is preserved) and trim. Defensive against .env files where dotenv
// did not strip inline comments (version-dependent behavior) or where a value was pasted
// from documented examples with its description attached. Without this, a trailing
// comment crashes Intl.DateTimeFormat (timezones), Number() (numerics), etc.
function clean(v) {
  if (typeof v !== 'string') return v;
  const m = v.match(/^(.*?)(?:\s+#.*)?$/s);
  return (m ? m[1] : v).trim();
}

const num = (v, d) => {
  const n = Number(clean(v));
  return Number.isFinite(n) && n > 0 ? n : d;
};
const bool = (v, d) => {
  const c = clean(v);
  return c === undefined || c === '' ? d : c === 'true';
};
const str = (v, d) => {
  const c = clean(v);
  return c === undefined || c === '' ? d : c;
};

function loadAlertConfig(env = process.env) {
  const recipients = (clean(env.ALERT_RECIPIENTS) || '')
    .split(',').map(s => s.trim()).filter(Boolean);

  const enabled = bool(env.ALERTS_ENABLED, false);

  if (enabled && recipients.length === 0) {
    console.warn('[alerts] ALERTS_ENABLED=true but ALERT_RECIPIENTS is empty — no emails will be sent.');
  }

  const cfg = {
    enabled,
    recipients,
    scanIntervalMs: num(env.ALERT_SCAN_INTERVAL_SEC, 60) * 1000,
    warmupMs: num(env.ALERT_WARMUP_MINUTES, 5) * 60000,
    quiet: {
      start: str(env.ALERT_QUIET_START, '23:59'),
      end: str(env.ALERT_QUIET_END, '08:00'),
      tz: str(env.ALERT_QUIET_TZ, 'Africa/Tunis')
    },
    rateCap: num(env.ALERT_RATE_CAP, 20),
    rateWindowMs: num(env.ALERT_RATE_WINDOW_MIN, 10) * 60000,
    playingStates: (clean(env.ALERT_PLAYING_STATES) || 'playing')
      .split(',').map(s => s.trim()).filter(Boolean),
    rules: {
      OFFLINE: { enabled: bool(env.ALERT_RULE_OFFLINE_ENABLED, true), thresholdMs: num(env.ALERT_OFFLINE_MINUTES, 15) * 60000 },
      STOPPED: { enabled: bool(env.ALERT_RULE_STOPPED_ENABLED, true), thresholdMs: num(env.ALERT_STOPPED_MINUTES, 12) * 60000 },
      STUCK:   { enabled: bool(env.ALERT_RULE_STUCK_ENABLED,   true), thresholdMs: num(env.ALERT_STUCK_MINUTES,   10) * 60000 }
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
