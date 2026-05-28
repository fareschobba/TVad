// test/alerts/stateMachine.test.js
const { expect } = require('chai');
const { evaluate, freshIncident } = require('../../src/services/alerts/stateMachine');

const OK = () => freshIncident();
const open = { now: 1000, allowEntry: true, allowRecover: true };

describe('evaluate', () => {
  it('OK + not bad => no-op', () => {
    const r = evaluate(OK(), false, open);
    expect(r.action).to.equal(null);
    expect(r.incident.state).to.equal('OK');
  });

  it('OK + bad + allowed => ENTER, marks entrySentAt, FIRING', () => {
    const r = evaluate(OK(), true, open);
    expect(r.action).to.equal('ENTER');
    expect(r.incident.state).to.equal('FIRING');
    expect(r.incident.entrySentAt).to.equal(1000);
    expect(r.incident.badSince).to.equal(1000);
  });

  it('FIRING + bad => dedup (no-op)', () => {
    const firing = evaluate(OK(), true, open).incident;
    const r = evaluate(firing, true, { now: 2000, allowEntry: true, allowRecover: true });
    expect(r.action).to.equal(null);
    expect(r.incident.state).to.equal('FIRING');
  });

  it('FIRING + recovered + allowed => RECOVER, back to OK', () => {
    const firing = evaluate(OK(), true, open).incident;
    const r = evaluate(firing, false, { now: 3000, allowEntry: true, allowRecover: true });
    expect(r.action).to.equal('RECOVER');
    expect(r.incident.state).to.equal('OK');
    expect(r.incident.entrySentAt).to.equal(null);
  });

  it('OK + bad but entry NOT allowed (quiet) => remembers badSince, no email', () => {
    const r = evaluate(OK(), true, { now: 1000, allowEntry: false, allowRecover: true });
    expect(r.action).to.equal(null);
    expect(r.incident.state).to.equal('OK');
    expect(r.incident.badSince).to.equal(1000);
    expect(r.incident.entrySentAt).to.equal(null);
  });

  it('quiet then window opens while still bad => fires ENTER, preserves original badSince', () => {
    const pending = evaluate(OK(), true, { now: 1000, allowEntry: false, allowRecover: true }).incident;
    const r = evaluate(pending, true, { now: 9000, allowEntry: true, allowRecover: true });
    expect(r.action).to.equal('ENTER');
    expect(r.incident.badSince).to.equal(1000);     // preserved from first observation
    expect(r.incident.entrySentAt).to.equal(9000);
  });

  it('GOLDEN RULE: bad-then-good while never allowed => no ENTER, no RECOVER', () => {
    const pending = evaluate(OK(), true, { now: 1000, allowEntry: false, allowRecover: true }).incident;
    const r = evaluate(pending, false, { now: 2000, allowEntry: true, allowRecover: true });
    expect(r.action).to.equal(null);
    expect(r.incident.state).to.equal('OK');
    expect(r.incident.badSince).to.equal(null);
  });

  it('FIRING + recovered but recovery not allowed (rate cap) => stays FIRING to retry later', () => {
    const firing = evaluate(OK(), true, open).incident;
    const r = evaluate(firing, false, { now: 3000, allowEntry: true, allowRecover: false });
    expect(r.action).to.equal(null);
    expect(r.incident.state).to.equal('FIRING');
  });
});
