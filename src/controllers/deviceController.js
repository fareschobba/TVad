// src/controllers/deviceController.js
const Device = require('../models/device');
const { generateUniqueDeviceId } = require('../utils/generateId');

// Create device
const createDevice = async (req, res) => {
  try {
    const { name, description, orientation } = req.body;
    const userId = req.user._id;
    
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
      orientation,
      userId
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

// Get all devices (with user role check)
const getAllDevices = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    let query = {};
    // If not admin, only show user's devices
    if (userRole !== 'admin' && userRole !== 'SUPERADMIN') {
      query.userId = userId;
    }

    const devices = await Device.find(query)
      .populate('userId', 'username email _id'); // Make sure _id is included in population

    console.log('Fetched devices:', devices); // Add logging

    res.status(200).json({
      success: true,
      count: devices.length,
      data: devices
    });
  } catch (error) {
    console.error('Error in getAllDevices:', error); // Add error logging
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get Device by name or id
const getDeviceByNameOrId = async (req, res) => {
  try {
    const { name, deviceId } = req.query;
    const userId = req.user._id;
    const userRole = req.user.role;
    
    if (!name && !deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Either name or deviceId parameter is required'
      });
    }

    let query = { isDeleted: false };

    // If not admin, only show user's devices
    if (userRole !== 'admin') {
      query.userId = userId;
    }

    if (name) {
      query.name = new RegExp(`^${name}$`, 'i');
    }

    if (deviceId) {
      query.deviceId = new RegExp(`^${deviceId}$`, 'i');
    }

    const device = await Device.findOne(query).populate('userId', 'username email');

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
    
    let query = { _id: req.params.id, isDeleted: false };
    // If not admin, only allow updating own devices
  
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
      query,
      { name, description, orientation },
      { new: true, runValidators: true }
    ).populate('userId', 'username email');

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found or access denied'
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
    const userId = req.user._id;

    let query = { 
      _id: req.params.id, 
      userId: userId // Only allow users to delete their own devices
    };

    const device = await Device.findOneAndUpdate(
      query,
      { isDeleted: true },
      { new: true }
    );

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found or access denied'
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

// Get device by ID
const getDeviceById = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    let query = { _id: req.params.id, isDeleted: false };
    // If not admin, only show user's devices
    if (userRole !== 'admin') {
      query.userId = userId;
    }

    const device = await Device.findOne(query).populate('userId', 'username email');

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found or access denied'
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

// Undelete device
const undeleteDevice = async (req, res) => {
  try {
    const userId = req.user._id;

    let query = { 
      _id: req.params.id, 
      isDeleted: true,
      userId: userId // Only allow users to unarchive their own devices
    };

    const device = await Device.findOneAndUpdate(
      query,
      { isDeleted: false },
      { new: true }
    );

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found or access denied'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Device restored successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Pair device
const pairDevice = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;

    let query = { deviceId: id, isDeleted: false };
    // If not admin, only allow pairing own devices
    if (userRole !== 'admin') {
      query.userId = userId;
    }

    const device = await Device.findOne(query);

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found or access denied'
      });
    }

    if (device.isPaired) {
      return res.status(400).json({
        success: false,
        message: 'Device is already paired'
      });
    }

    device.isPaired = true;
    await device.save();

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

// Unpair device
const unpair = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;

    let query = { deviceId: id, isDeleted: false };
    // If not admin, only allow unpairing own devices
    if (userRole !== 'admin') {
      query.userId = userId;
    }

    const device = await Device.findOne(query);

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found or access denied'
      });
    }

    if (!device.isPaired) {
      return res.status(400).json({
        success: false,
        message: 'Device is already unpaired'
      });
    }

    device.isPaired = false;
    await device.save();

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

module.exports = {
  createDevice,
  getAllDevices,
  getDeviceByNameOrId,
  updateDevice,
  deleteDevice,
  pairDevice,
  undeleteDevice,
  getDeviceById,
  unpair
};
