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
  getUserWithVideos,
  getCurrentUser,
  updateUser
} = require('../controllers/userController');

const router = express.Router();

// Add this new route
router.get('/me/:userId', protect, getCurrentUser);

// Admin routes
router.post('/Create-client', protect, isAdmin, createClient);
router.patch('/clients/:userId/toggle-status', protect, isAdmin, toggleAccountStatus);
router.post('/reset-account-by-admin', protect, isAdmin, resetUserAccount);
router.patch('/clients/:userId/role', protect, isAdmin, changeUserRole);
router.put('/:userId', protect, isAdmin, updateUser); // Add this line for updateUser

// get User/users with videos
router.get('/', protect, isAdmin, getAllUsers);
router.get('/:userId/videos', protect,isAdmin, getUserWithVideos);

// Client routes
router.patch('/profile', protect, updateProfile);
router.post('/reset-account', resetUserAccount);

module.exports = router;



