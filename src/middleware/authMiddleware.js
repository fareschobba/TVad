// src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const AdminUser = require('../models/adminUser');

const protect = async (req, res, next) => {
  try {
    // 1. Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Please login to access this resource',
      });
    }

    const token = authHeader.split(' ')[1];

    // 2. Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3. Check if user exists
    const user = await AdminUser.findById(decoded.id);
    if (!user || user.isDeleted) {
      return res.status(401).json({
        success: false,
        message: 'User no longer exists',
      });
    }

    // 4. Grant access to protected route
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Not authorized to access this resource',
    });
  }
};

module.exports = { protect };