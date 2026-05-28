// test/alerts/emailService.test.js
const { expect } = require('chai');
const sinon = require('sinon');
const emailService = require('../../src/services/email.service');

describe('emailService.sendDeviceAlert', () => {
  afterEach(() => sinon.restore());

  it('joins recipients and delegates to sendMail with built subject', async () => {
    const stub = sinon.stub(emailService, 'sendMail').resolves({ messageId: 'x' });
    await emailService.sendDeviceAlert({
      kind: 'ENTER',
      rule: 'OFFLINE',
      device: { deviceId: 'AB12C', name: 'Lobby' },
      snapshot: {},
      timestamps: {},
      recipients: ['a@x.tn', 'b@x.tn']
    });
    expect(stub.calledOnce).to.equal(true);
    const arg = stub.firstCall.args[0];
    expect(arg.to).to.equal('a@x.tn,b@x.tn');
    expect(arg.subject).to.contain('[TVad ALERT]');
  });
});
