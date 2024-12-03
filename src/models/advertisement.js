// src/models/advertisement.js
const mongoose = require('mongoose');

const advertisementSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  videoUrl: {
    type: String,
    required: true,
    trim: true
  },
  orientation: {
    type: String,
    enum: ['portrait', 'landscape'],
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
});

const Advertisement = mongoose.model('Advertisement', advertisementSchema);
module.exports = Advertisement;