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

module.exports = {
  login,
  createInitialAdmin,
};