#!/usr/bin/env node
// scripts/test-alert-email.js
//
// Send a synthetic device-alert email NOW, without waiting for thresholds.
// Bypasses ALERTS_ENABLED, quiet hours, warmup, dedup, and the rate cap — this is a
// deliberate test fire intended to verify SMTP creds, recipient delivery, and the
// template render end-to-end in seconds, not minutes.
//
// Usage (on the VPS, from the project root):
//   npm run alert:test                                      # ENTER + OFFLINE + TEST-DEVICE
//   npm run alert:test -- --rule=STOPPED --kind=RECOVER     # try different shapes
//   npm run alert:test -- --device=Lobby                    # pick a device label
//   npm run alert:test -- --dry                             # preview, do NOT send
//
// Honors ALERT_RECIPIENTS and SMTP_* from .env. Exits 0 on success, non-zero on error.

require('dotenv').config();
const { loadAlertConfig } = require('../src/config/alerts');
const { buildDeviceAlertEmail } = require('../src/services/alerts/emailTemplate');
const emailService = require('../src/services/email.service');

function parseArgs(argv) {
  const out = {};
  for (const a of argv.slice(2)) {
    if (a === '--dry') { out.dry = true; continue; }
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  const rule = String(args.rule || 'OFFLINE').toUpperCase();
  const kind = String(args.kind || 'ENTER').toUpperCase();
  const deviceId = String(args.device || 'TEST-DEVICE');
  const dry = !!args.dry;

  if (!['OFFLINE', 'STOPPED', 'STUCK'].includes(rule)) {
    console.error(`[alert-test] invalid --rule "${rule}"; use OFFLINE | STOPPED | STUCK`);
    process.exit(2);
  }
  if (!['ENTER', 'RECOVER'].includes(kind)) {
    console.error(`[alert-test] invalid --kind "${kind}"; use ENTER | RECOVER`);
    process.exit(2);
  }

  const config = loadAlertConfig();
  if (!dry && config.recipients.length === 0) {
    console.error('[alert-test] ALERT_RECIPIENTS is empty. Set it in .env (comma-separated) and retry, or pass --dry to preview without sending.');
    process.exit(2);
  }

  const now = Date.now();
  const tenMinAgo = now - 10 * 60 * 1000;
  const device = { deviceId, name: `${deviceId} (synthetic)`, userId: 'test' };
  const snapshot = {
    playerState: rule === 'STOPPED' ? 'idle' : 'playing',
    currentAd: 'test-ad',
    isStuck: rule === 'STUCK',
    appState: 'foreground'
  };
  const timestamps = kind === 'ENTER'
    ? { detectedAt: new Date(now), lastSeenAt: new Date(tenMinAgo) }
    : { recoveredAt: new Date(now), lastSeenAt: new Date(now), downForMs: now - tenMinAgo };

  if (dry) {
    const { subject, text } = buildDeviceAlertEmail(kind, { rule, device, snapshot, timestamps });
    console.log(`[alert-test] DRY RUN — would send to: ${config.recipients.join(', ') || '(no recipients set)'}`);
    console.log(`--- subject ---\n${subject}\n--- text ---\n${text}`);
    return;
  }

  console.log(`[alert-test] sending ${kind} ${rule} for ${deviceId} -> ${config.recipients.join(', ')}`);
  const info = await emailService.sendDeviceAlert({
    kind, rule, device, snapshot, timestamps, recipients: config.recipients
  });
  console.log(`[alert-test] OK — messageId=${info && info.messageId ? info.messageId : '(none)'}`);
}

main().catch(err => {
  console.error(`[alert-test] FAILED: ${err.message}`);
  process.exit(1);
});
