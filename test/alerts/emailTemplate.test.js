// test/alerts/emailTemplate.test.js
const { expect } = require('chai');
const { buildDeviceAlertEmail, RULE_LABELS } = require('../../src/services/alerts/emailTemplate');

const base = {
  rule: 'OFFLINE',
  device: { deviceId: 'AB12C', name: 'Lobby Screen', userId: 'u1' },
  snapshot: { playerState: 'idle', currentAd: 'promo_07', isStuck: false },
  timestamps: { detectedAt: new Date('2026-05-28T10:00:00Z'), lastSeenAt: new Date('2026-05-28T09:45:00Z') }
};

describe('buildDeviceAlertEmail', () => {
  it('entry subject carries ALERT tag, device name+id and rule label', () => {
    const m = buildDeviceAlertEmail('ENTER', base);
    expect(m.subject).to.contain('[TVad ALERT]');
    expect(m.subject).to.contain('Lobby Screen');
    expect(m.subject).to.contain('AB12C');
    expect(m.subject).to.contain(RULE_LABELS.OFFLINE);
    expect(m.text).to.contain('AB12C');
    expect(m.html).to.contain('Lobby Screen');
  });

  it('recovery subject carries RECOVERED tag', () => {
    const m = buildDeviceAlertEmail('RECOVER', base);
    expect(m.subject).to.contain('[TVad RECOVERED]');
  });

  it('returns to/text/html strings', () => {
    const m = buildDeviceAlertEmail('ENTER', base);
    expect(m).to.have.keys(['subject', 'text', 'html']);
    expect(m.text).to.be.a('string');
    expect(m.html).to.be.a('string');
  });
});
