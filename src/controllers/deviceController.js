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
      message: 'Unable to create device. Please check your input and try again.'
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
      message: 'Unable to retrieve devices. Please try again later.'
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
      message: 'Unable to find device. Please verify the device name or ID and try again.'
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
      message: 'Unable to update device. Please check your input and try again.'
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
      message: 'Unable to delete device. Please try again later.'
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
      message: 'Unable to retrieve device details. Please try again later.'
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
      message: 'Unable to restore device. Please try again later.'
    });
  }
};

// Pair device
const pairDevice = async (req, res) => {
  try {
    const { id } = req.params;
    // const userId = req.user._id;
    // const userRole = req.user.role;

    let query = { deviceId: id, isDeleted: false };
    // If not admin, only allow pairing own devices
    // if (userRole !== 'admin') {
    //   query.userId = userId;
    // }

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
      message: 'Unable to pair device. Please try again later.'
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
      message: 'Unable to unpair device. Please try again later.'
    });
  }
};

// Get device list for dashboard (simplified format)
const getDeviceList = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    let query = { isDeleted: false };
    // If not admin, only show user's devices
    if (userRole !== 'admin' && userRole !== 'SUPERADMIN') {
      query.userId = userId;
    }

    const devices = await Device.find(query)
      .populate('userId', 'username email _id')
      .select('deviceId name description location')
      .lean();

    // Format devices for dashboard compatibility
    const formattedDevices = devices.map(device => ({
      deviceId: device.deviceId,
      name: device.name,
      location: device.description || device.location || 'No location specified'
    }));

    res.status(200).json({
      success: true,
      count: formattedDevices.length,
      data: formattedDevices
    });
  } catch (error) {
    console.error('Error in getDeviceList:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to retrieve device list. Please try again later.'
    });
  }
};

// Clear device cache via API
const clearDeviceCache = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { cacheType = 'all' } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;

    // Verify device exists and user has access
    let query = { deviceId, isDeleted: false };
    if (userRole !== 'admin' && userRole !== 'SUPERADMIN') {
      query.userId = userId;
    }

    const device = await Device.findOne(query);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found or access denied'
      });
    }

    const requestId = `cache_api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Get Socket.IO instance
    const socketConfig = require('../config/socket');
    const io = socketConfig.getIO();

    if (!io) {
      return res.status(503).json({
        success: false,
        message: 'Socket.IO service unavailable'
      });
    }

    // Emit cache clear request
    io.emit(`clearCache/${deviceId}`, {
      cacheType,
      requestId,
      adminSocketId: `api_${userId}`
    });

    res.status(200).json({
      success: true,
      message: 'Cache clear request sent to device',
      data: {
        deviceId,
        cacheType,
        requestId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error in clearDeviceCache:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to clear device cache. Please try again later.'
    });
  }
};

// Request device health check via API
const requestDeviceHealthCheck = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;

    // Verify device exists and user has access
    let query = { deviceId, isDeleted: false };
    if (userRole !== 'admin' && userRole !== 'SUPERADMIN') {
      query.userId = userId;
    }

    const device = await Device.findOne(query);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found or access denied'
      });
    }

    const requestId = `health_api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Get Socket.IO instance
    const socketConfig = require('../config/socket');
    const io = socketConfig.getIO();

    if (!io) {
      return res.status(503).json({
        success: false,
        message: 'Socket.IO service unavailable'
      });
    }

    // Emit health check request
    io.emit(`healthCheck/${deviceId}`, {
      requestId,
      adminSocketId: `api_${userId}`
    });

    res.status(200).json({
      success: true,
      message: 'Health check request sent to device',
      data: {
        deviceId,
        requestId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error in requestDeviceHealthCheck:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to request device health check. Please try again later.'
    });
  }
};

// Clean USB storage on device
const cleanUsbStorage = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { cleanType = 'all' } = req.body;
    const userId = req.user?._id || 'anonymous';

    // Validate device exists
    const device = await Device.findOne({
      deviceId,
      isDeleted: false
    });

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    // Generate unique request ID
    const requestId = `usb_api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Get Socket.IO instance
    const socketConfig = require('../config/socket');
    const io = socketConfig.getIO();

    if (!io) {
      return res.status(503).json({
        success: false,
        message: 'Socket.IO service unavailable'
      });
    }

    // Emit USB storage clean request
    io.emit(`cleanUsbStorage/${deviceId}`, {
      cleanType,
      requestId,
      adminSocketId: `api_${userId}`
    });

    res.status(200).json({
      success: true,
      message: 'USB storage clean request sent to device',
      data: {
        deviceId,
        cleanType,
        requestId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error in cleanUsbStorage:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to clean USB storage. Please try again later.'
    });
  }
};

// Restart app via API
const restartApp = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;

    // Verify device exists and user has access
    let query = { deviceId, isDeleted: false };
    if (userRole !== 'admin' && userRole !== 'SUPERADMIN') {
      query.userId = userId;
    }

    const device = await Device.findOne(query);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found or access denied'
      });
    }

    const requestId = `restart_api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Get Socket.IO instance
    const socketConfig = require('../config/socket');
    const io = socketConfig.getIO();

    if (!io) {
      return res.status(503).json({
        success: false,
        message: 'Socket.IO service unavailable'
      });
    }

    // Emit app restart request
    io.emit(`restartApp/${deviceId}`, {
      requestId,
      adminSocketId: `api_${userId}`
    });

    res.status(200).json({
      success: true,
      message: 'App restart request sent to device',
      data: {
        deviceId,
        requestId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error in restartApp:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to restart app. Please try again later.'
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
  unpair,
  getDeviceList,
  clearDeviceCache,
  requestDeviceHealthCheck,
  cleanUsbStorage,
  restartApp
};
