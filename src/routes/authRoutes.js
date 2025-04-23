// src/routes/authRoutes.js
const express = require('express');
const { 
  login, 
  createInitialAdmin, 
  authenticateAdmin, 
  validatePassword, 
  changePassword,
  changePasswordWithVerification 
} = require('../controllers/authController');
const router = express.Router();

router.post('/login', login);
router.post('/setup', createInitialAdmin);
router.put('/change-password', authenticateAdmin, validatePassword, changePassword);
// Add new route for password change with verification
router.put('/change-password-verify', validatePassword, changePasswordWithVerification);

module.exports = router;
