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
  getDeviceById,
  unpair
} = require('../controllers/deviceController');

const router = express.Router();

// // All routes require authentication
// router.use(protect);

// Routes accessible by both admin and regular users
router.get('/search', getDeviceByNameOrId);
router.get('/:id', getDeviceById);
router.patch('/:id/isPaired', pairDevice);
router.patch('/:id/unpair', unpair);
router.patch('/unarchive/:id', protect, undeleteDevice); // Add this line for unarchiving

// Routes with role-based access
router.get('/', getAllDevices); // Admin sees all, users see their own
router.post('/', createDevice);
router.put('/:id', updateDevice); // Admin can update any, users their own
router.delete('/:id', deleteDevice); // Admin can delete any, users their own
router.patch('/undelete/:id', undeleteDevice); // Admin can undelete any, users their own

module.exports = router;
