// src/routes/authRoutes.js
const express = require('express');
const { login, createInitialAdmin ,  authenticateAdmin, validatePassword, changePassword} = require('../controllers/authController');
const router = express.Router();

router.post('/login', login);
router.post('/setup', createInitialAdmin);
router.put('/change-password', authenticateAdmin, validatePassword, changePassword);

module.exports = router;