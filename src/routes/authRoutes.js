// src/routes/authRoutes.js
const express = require('express');
const { login, createInitialAdmin } = require('../controllers/authController');
const router = express.Router();

router.post('/login', login);
router.post('/setup', createInitialAdmin);

module.exports = router;