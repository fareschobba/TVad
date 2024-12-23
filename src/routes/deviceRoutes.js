// src/routes/deviceRoutes.js
const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  createDevice,
  getAllDevices,
  getDeviceByNameOrId,
  updateDevice,
  deleteDevice,
  pairDevice,
  undeleteDevice,
  getDeviceById
} = require('../controllers/deviceController');

const router = express.Router();

// Public routes (no authentication required)
router.get('/', getAllDevices);
router.get('/search', getDeviceByNameOrId);


//new add
router.patch('/isPaired', pairDevice);

// Protected routes (require authentication)
router.use(protect);
router.post('/', createDevice);
router.put('/:id', updateDevice);
router.delete('/:id', deleteDevice);
router.get('/:id', getDeviceById);
router.delete('/undeleteDevice/:id', undeleteDevice);


module.exports = router;