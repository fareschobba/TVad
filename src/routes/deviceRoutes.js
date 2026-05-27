// src/routes/deviceRoutes.js
const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/roleMiddleware');
const { pairLimiter } = require('../middleware/rateLimits');
const {
  createDevice,
  getAllDevices,
  getDeviceByNameOrId,
  updateDevice,
  deleteDevice,
  pairDevice,
  undeleteDevice,
  getDeviceById,
  unpair,
  getDeviceList,
  clearDeviceCache,
  requestDeviceHealthCheck,
  cleanUsbStorage,
  restartApp
} = require('../controllers/deviceController');

const router = express.Router();

// PUBLIC: device pairing endpoint. Called by the Android client at first boot with
// no JWT. Defensive controls: rate-limited, validated, idempotent (already-paired → 400),
// audited. Threat model: open endpoint → bounded by pairLimiter + deviceId existence.
// See migration_decisions: RA3.
router.patch('/:id/isPaired', pairLimiter, pairDevice);

// All routes below require authentication
router.use(protect);

// Routes accessible by both admin and regular users
router.get('/getdevicelist', getDeviceList); // Dashboard-specific endpoint
router.get('/search', getDeviceByNameOrId);
router.get('/:id', getDeviceById);

router.patch('/:id/unpair', unpair);
router.patch('/unarchive/:id', protect, undeleteDevice); // Add this line for unarchiving

// Routes with role-based access
router.get('/', getAllDevices); // Admin sees all, users see their own
router.post('/', createDevice);
router.put('/:id', updateDevice); // Admin can update any, users their own
router.delete('/:id', deleteDevice); // Admin can delete any, users their own
router.patch('/undelete/:id', undeleteDevice); // Admin can undelete any, users their own

// Monitoring (health check) stays owner-accessible; destructive operations are admin/SUPERADMIN
// only — clients may monitor but not control (matches the socket-layer monitor-only policy).
router.post('/:deviceId/health/check', requestDeviceHealthCheck); // Request health check
router.post('/:deviceId/cache/clear', isAdmin, clearDeviceCache); // Clear device cache
router.post('/:deviceId/usb/clean', isAdmin, cleanUsbStorage); // Clean USB storage
router.post('/:deviceId/app/restart', isAdmin, restartApp); // Restart app

module.exports = router;
