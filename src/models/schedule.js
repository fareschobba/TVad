const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
  advertisementIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Advertisement',
    required: true
  }],
  deviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device',
    required: true
  },
  startTime: {
    type: Date,
    required: true
  },
  playTime: {
    type: Number, // Duration in seconds
    required: true
  },
  playMode: {
    type: String,
    enum: ['loop', 'shuffle'],
    default: 'loop'
  },
  repeat: {
    type: String,
    enum: ['once', 'daily', 'weekly', 'monthly', 'custom'],
    required: true
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

const Schedule = mongoose.model('Schedule', scheduleSchema);
module.exports = Schedule;