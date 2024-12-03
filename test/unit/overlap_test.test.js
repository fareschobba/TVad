const chai = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');
const { expect } = chai;
const Device = require('../../src/models/device');
const Advertisement = require('../../src/models/advertisement');
const Schedule = require('../../src/models/schedule');
const { createSchedule } = require('../../src/controllers/scheduleController');

describe('Create Schedule Tests', function() {
    let sandbox;
    let req, res;
    
    beforeEach(function() {
        sandbox = sinon.createSandbox();
        res = {
            status: sinon.stub().returnsThis(),
            json: sinon.stub()
        };
    });

    afterEach(function() {
        sandbox.restore();
    });

    const validDeviceId = new mongoose.Types.ObjectId();
    const validAdId1 = new mongoose.Types.ObjectId();

    it('should return 400 when schedule overlaps', async function() {
        // Set adequate timeout
        this.timeout(5000);

        // Setup existing schedule for overlap check
        const existingSchedule = {
            _id: new mongoose.Types.ObjectId(),
            deviceId: validDeviceId,
            startTime: new Date('2024-01-01T10:30:00Z'),
            endTime: new Date('2024-01-01T11:30:00Z'),
            isDeleted: false
        };

        // Mock device find operation
        sandbox.stub(Device, 'findOne').resolves({
            _id: validDeviceId,
            isDeleted: false
        });

        // Mock advertisement find operation
        sandbox.stub(Advertisement, 'find').resolves([{
            _id: validAdId1,
            isDeleted: false
        }]);

        // Mock Schedule.findOne for overlap check
        sandbox.stub(Schedule, 'findOne').resolves(existingSchedule);

        // Setup request
        req = {
            body: {
                deviceId: validDeviceId,
                advertisementIds: [validAdId1],
                startTime: new Date('2024-01-01T11:00:00Z'),
                playTime: 60,
                playMode: 'sequential',
                repeat: false
            }
        };

        // Execute controller
        await createSchedule(req, res);

        // Verify response
        expect(res.status.calledOnce).to.be.true;
        expect(res.status.calledWith(400)).to.be.true;
        expect(res.json.calledOnce).to.be.true;
        expect(res.json.calledWith({
            success: false,
            message: 'Schedule overlaps with an existing schedule',
            conflictingSchedule: existingSchedule
        })).to.be.true;

        // Verify all stubs were called
        expect(Device.findOne.calledOnce).to.be.true;
        expect(Advertisement.find.calledOnce).to.be.true;
        expect(Schedule.findOne.calledOnce).to.be.true;
        
        // Verify correct arguments were passed to Schedule.findOne
        const scheduleQuery = Schedule.findOne.getCall(0).args[0];
        expect(scheduleQuery).to.have.property('deviceId', validDeviceId);
        expect(scheduleQuery).to.have.property('isDeleted', false);
        expect(scheduleQuery).to.have.property('$or').that.is.an('array');
    });
});