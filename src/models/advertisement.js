// src/models/advertisement.js
const mongoose = require('mongoose');

const advertisementSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Advertisement name is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Advertisement description is required'],
    trim: true
  },
  videoUrl: {
    type: String,
    required: [true, 'Video URL is required']
  },
  orientation: {
    type: String,
    required: [true, 'Orientation is required'],
    enum: ['portrait', 'landscape']
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminUser',
    required: [true, 'User ID is required']
  },
  fileName: {
    type: String,
    required: [true, 'File name is required']
  },
  fileId: {
    type: String,
    required: [true, 'File ID is required']
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'inactive'],
    default: 'pending'
  },
  uploadDate: {
    type: Date,
    default: Date.now
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
