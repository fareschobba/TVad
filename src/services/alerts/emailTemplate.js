// src/services/alerts/emailTemplate.js

const RULE_LABELS = {
  OFFLINE:      'Device Offline',
  STOPPED:      'Playlist Stopped',
  STUCK:        'Playlist Stuck',
  BACKGROUNDED: 'App Backgrounded'
};

const iso = (d) => (d instanceof Date ? d.toISOString() : (d ? new Date(d).toISOString() : 'n/a'));

function buildDeviceAlertEmail(kind, { rule, device, snapshot = {}, timestamps = {} }) {
  const label = RULE_LABELS[rule] || rule;
  const name = device.name || device.deviceId;
  const tag = kind === 'ENTER' ? '[TVad ALERT]' : '[TVad RECOVERED]';
  const subject = `${tag} ${name} (${device.deviceId}) — ${label}`;

  const lines = [
    `${kind === 'ENTER' ? 'ALERT' : 'RECOVERED'}: ${label}`,
    `Device: ${name} (${device.deviceId})`,
    `Owner: ${device.ownerName || 'n/a'}`,
    `Event time (server): ${iso(timestamps.detectedAt || timestamps.recoveredAt)}`,
    `Last seen: ${iso(timestamps.lastSeenAt)}`,
    `Player state: ${snapshot.playerState || 'n/a'}`,
    `Current ad: ${snapshot.currentAd || 'n/a'}`,
    `isStuck: ${snapshot.isStuck === true}`
  ];
  if (kind === 'RECOVER' && timestamps.downForMs != null) {
    lines.push(`Was in bad state for: ${Math.round(timestamps.downForMs / 60000)} min`);
  }
  const text = lines.join('\n');

  const color = kind === 'ENTER' ? '#c0392b' : '#27ae60';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color:${color};">${kind === 'ENTER' ? '🔴' : '🟢'} ${label}</h2>
      <p><strong>${name}</strong> (${device.deviceId})</p>
      <table style="border-collapse:collapse;">
        ${lines.slice(2).map(l => {
          const i = l.indexOf(':');
          return `<tr><td style="padding:2px 12px 2px 0;color:#555;">${l.slice(0, i)}</td><td>${l.slice(i + 1).trim()}</td></tr>`;
        }).join('')}
      </table>
      <p style="color:#999;font-size:12px;">AROMAMASTER — automated device monitoring</p>
    </div>`;

  return { subject, text, html };
}

module.exports = { buildDeviceAlertEmail, RULE_LABELS };
