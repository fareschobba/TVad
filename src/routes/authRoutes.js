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
const { resetUserAccount } = require('../controllers/userController');
const { loginLimiter } = require('../middleware/rateLimits');

const router = express.Router();

// Login is brute-force-attractive: tight rate limit.
router.post('/login', loginLimiter, login);

// Initial admin bootstrap. Internally idempotent — returns 400 if an admin exists.
// Rate-limited under the same login bucket to prevent setup-endpoint abuse.
router.post('/setup', loginLimiter, createInitialAdmin);

router.put('/change-password', authenticateAdmin, validatePassword, changePassword);
router.post('/reset-account', loginLimiter, resetUserAccount);
router.put('/change-password-verify', validatePassword, changePasswordWithVerification);

module.exports = router;
