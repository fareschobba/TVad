const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/roleMiddleware');
const {
  createClient,
  updateProfile,
  toggleAccountStatus,
  resetUserAccount,
  changeUserRole,
  getAllUsers,
  getUserWithVideos
} = require('../controllers/userController');

const router = express.Router();

// Admin routes
router.post('/Create-client', protect, isAdmin, createClient);
router.patch('/clients/:userId/toggle-status', protect, isAdmin, toggleAccountStatus);
router.post('/reset-account-by-admin', protect, isAdmin, resetUserAccount);
router.patch('/clients/:userId/role', protect, isAdmin, changeUserRole);

// User routes with videos
router.get('/', protect, isAdmin, getAllUsers);
router.get('/:userId/videos', protect, getUserWithVideos);

// Client routes
router.patch('/profile', protect, updateProfile);
router.post('/reset-account', resetUserAccount);

module.exports = router;



