// src/routes/deviceRoutes.js
const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  createDevice,
  getAllDevices,
  getDeviceByNameOrId,
  updateDevice,
  deleteDevice
} = require('../controllers/deviceController');

const router = express.Router();

// Public routes (no authentication required)
router.get('/', getAllDevices);
router.get('/search', getDeviceByNameOrId);

// Protected routes (require authentication)
router.use(protect);
router.post('/', createDevice);
router.put('/:id', updateDevice);
router.delete('/:id', deleteDevice);

module.exports = router;