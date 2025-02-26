// src/controllers/authController.js
const jwt = require('jsonwebtoken');
const AdminUser = require('../models/adminUser');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

// Login controller
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // 1. Check if username and password exist
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide username and password',
      });
    }

    // 2. Find user and check password
    const user = await AdminUser.findOne({ username, isDeleted: false }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect username or password',
      });
    }

    // 3. Generate token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      token,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error logging in',
      error: error.message,
    });
  }
};

// Create initial admin user (should be used only once)
const createInitialAdmin = async (req, res) => {
  try {
    // Check if admin already exists
    const adminExists = await AdminUser.findOne();
    if (adminExists) {
      return res.status(400).json({
        success: false,
        message: 'Admin user already exists',
      });
    }

    // Create admin user
    const admin = await AdminUser.create({
      username: req.body.username,
      password: req.body.password,
    });

    res.status(201).json({
      success: true,
      message: 'Admin user created successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating admin user',
      error: error.message,
    });
  }
};

// Middleware to validate the new password
const validatePassword = (req, res, next) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters long',
    });
  }
  next();
};

// Middleware to authenticate the admin
const authenticateAdmin = async (req, res, next) => {
  const { username, currentPassword } = req.body;

  try {
    const admin = await AdminUser.findOne({ username }).select('+password');
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin user not found',
      });
    }

    const isPasswordValid = await admin.comparePassword(currentPassword);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    req.admin = admin; // Attach the admin to the request object
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error authenticating admin',
      error: error.message,
    });
  }
};

// Controller to handle password update
const changePassword = async (req, res) => {
  const { newPassword } = req.body;
  const { admin } = req;

  try {
    // Update the password
    admin.password = newPassword;
    await admin.save(); // This will trigger the pre('save') hook to hash the password

    res.status(200).json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating password',
      error: error.message,
    });
  }
};

module.exports = {
  login,
  createInitialAdmin,
  validatePassword,
  authenticateAdmin,
  changePassword
};