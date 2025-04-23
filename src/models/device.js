// src/models/device.js
const mongoose = require('mongoose');
const { generateRandomId } = require('../utils/generateId');

const deviceSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    unique: true,
    required: true,
    uppercase: true
  },
  name: {
    type: String,
    required: [true, 'Device name is required'],
    unique: true,
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Device description is required'],
    trim: true
  },
  orientation: {
    type: String,
    required: [true, 'Device orientation is required'],
    enum: ['portrait', 'landscape']
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminUser',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  isPaired: {
    type: Boolean,
    default: false
  }
});

deviceSchema.pre('save', function(next) {
  if (this.isNew) {
    this.deviceId = this.deviceId.toUpperCase();
  }
  next();
});

const Device = mongoose.model('Device', deviceSchema);
module.exports = Device;
