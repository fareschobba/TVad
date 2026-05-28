// test/alerts/config.test.js
const { expect } = require('chai');
const { loadAlertConfig, RULE_IDS } = require('../../src/config/alerts');

describe('loadAlertConfig', () => {
  it('defaults to disabled with inert settings when env is empty', () => {
    const cfg = loadAlertConfig({});
    expect(cfg.enabled).to.equal(false);
    expect(cfg.recipients).to.deep.equal([]);
    expect(cfg.scanIntervalMs).to.equal(60000);
    expect(cfg.warmupMs).to.equal(5 * 60000);
    expect(cfg.rules.OFFLINE.thresholdMs).to.equal(15 * 60000);
    expect(cfg.rules.STOPPED.thresholdMs).to.equal(12 * 60000);
    expect(cfg.rules.STUCK.thresholdMs).to.equal(10 * 60000);
    expect(cfg.playingStates).to.deep.equal(['playing']);
    expect(Object.isFrozen(cfg)).to.equal(true);
  });

  it('parses recipients, thresholds, quiet window and rule flags', () => {
    const cfg = loadAlertConfig({
      ALERTS_ENABLED: 'true',
      ALERT_RECIPIENTS: 'a@x.tn, b@x.tn ,',
      ALERT_OFFLINE_MINUTES: '20',
      ALERT_RULE_STUCK_ENABLED: 'false',
      ALERT_QUIET_START: '23:59',
      ALERT_QUIET_END: '08:00',
      ALERT_QUIET_TZ: 'Africa/Tunis'
    });
    expect(cfg.enabled).to.equal(true);
    expect(cfg.recipients).to.deep.equal(['a@x.tn', 'b@x.tn']);
    expect(cfg.rules.OFFLINE.thresholdMs).to.equal(20 * 60000);
    expect(cfg.rules.STUCK.enabled).to.equal(false);
    expect(cfg.quiet).to.deep.equal({ start: '23:59', end: '08:00', tz: 'Africa/Tunis' });
  });

  it('exposes RULE_IDS in canonical order', () => {
    expect(RULE_IDS).to.deep.equal(['OFFLINE', 'STOPPED', 'STUCK']);
  });

  // Regression: a user pasted documented examples into .env with trailing "# description"
  // tails. dotenv inline-comment handling varies across versions, so a stray comment can land
  // in the value and crash Intl.DateTimeFormat / Number(). The loader must strip "# comment"
  // tails (when preceded by whitespace) and trim, while preserving a literal '#' embedded in
  // a real value.
  it('strips inline "# comment" tails and trailing whitespace from env values', () => {
    const cfg = loadAlertConfig({
      ALERTS_ENABLED: 'true                   # MASTER SWITCH',
      ALERT_RECIPIENTS: 'a@x.tn, b@x.tn        # OPS inboxes',
      ALERT_OFFLINE_MINUTES: '20             # confirm down after this',
      ALERT_QUIET_TZ: 'Africa/Tunis                            # timezone for the quiet window',
      ALERT_QUIET_START: '23:59 # from',
      ALERT_QUIET_END: '08:00 # to',
      ALERT_PLAYING_STATES: 'playing      # healthy states',
      ALERT_RULE_STUCK_ENABLED: 'false           # disable stuck'
    });
    expect(cfg.enabled).to.equal(true);
    expect(cfg.recipients).to.deep.equal(['a@x.tn', 'b@x.tn']);
    expect(cfg.rules.OFFLINE.thresholdMs).to.equal(20 * 60000);
    expect(cfg.quiet).to.deep.equal({ start: '23:59', end: '08:00', tz: 'Africa/Tunis' });
    expect(cfg.playingStates).to.deep.equal(['playing']);
    expect(cfg.rules.STUCK.enabled).to.equal(false);
  });

  it('preserves a literal # that is NOT preceded by whitespace (in a real value)', () => {
    const cfg = loadAlertConfig({ ALERT_PLAYING_STATES: 'play#ing,ready' });
    expect(cfg.playingStates).to.deep.equal(['play#ing', 'ready']);
  });
});
