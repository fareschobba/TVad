// src/controllers/deviceController.js
const Device = require('../models/device');
const { generateUniqueDeviceId } = require('../utils/generateId');

// Create device
const createDevice = async (req, res) => {
  try {
    const { name, description, orientation } = req.body;
    
    // Check if device with same name exists and is not deleted
    const existingDevice = await Device.findOne({ name, isDeleted: false });
    if (existingDevice) {
      return res.status(400).json({
        success: false,
        message: 'Device with this name already exists'
      });
    }

    // Generate unique deviceId
    const deviceId = await generateUniqueDeviceId(Device);

    const device = await Device.create({
      deviceId,
      name,
      description,
      orientation
    });

    res.status(201).json({
      success: true,
      data: device
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Get all devices (excluding deleted ones)
const getAllDevices = async (req, res) => {
  try {
    const devices = await Device.find({ isDeleted: false });
    
    res.status(200).json({
      success: true,
      count: devices.length,
      data: devices
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

//Get Device by name or id
const getDeviceByNameOrId = async (req, res) => {
  try {
    const { name, deviceId } = req.query;
    
    if (!name && !deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Either name or deviceId parameter is required'
      });
    }

    let query = { isDeleted: false };

    if (name) {
      query.name = new RegExp(`^${name}$`, 'i'); // case insensitive exact match
    }

    if (deviceId) {
      query.deviceId = new RegExp(`^${deviceId}$`, 'i'); // case insensitive exact match
    }

    const device = await Device.findOne(query);

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    res.status(200).json({
      success: true,
      data: device
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update device
const updateDevice = async (req, res) => {
  try {
    const { name, description, orientation } = req.body;
    
    // Check if new name conflicts with existing device
    if (name) {
      const existingDevice = await Device.findOne({
        name,
        _id: { $ne: req.params.id },
        isDeleted: false
      });
      
      if (existingDevice) {
        return res.status(400).json({
          success: false,
          message: 'Device with this name already exists'
        });
      }
    }

    const device = await Device.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { name, description, orientation },
      { new: true, runValidators: true }
    );

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    res.status(200).json({
      success: true,
      data: device
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Soft delete device
const deleteDevice = async (req, res) => {
  try {
    const device = await Device.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { isDeleted: true },
      { new: true }
    );

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Device deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  createDevice,
  getAllDevices,
  getDeviceByNameOrId,
  updateDevice,
  deleteDevice
};