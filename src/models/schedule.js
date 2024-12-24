const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
  advertisementIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Advertisement',
    required: true
  }],
  deviceId: {
    type: String,
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
  endTime: {
    type: Date,
    required: false // Set to true if you want it mandatory
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
  },
}, {
  timestamps: true
});

// Optionally calculate `endTime` based on `startTime` and `playTime` before saving
scheduleSchema.pre('save', function(next) {
  if (!this.endTime && this.startTime && this.playTime) {
    this.endTime = new Date(this.startTime.getTime() + this.playTime * 1000);
  }
  next();
});

const Schedule = mongoose.model('Schedule', scheduleSchema);
module.exports = Schedule;
