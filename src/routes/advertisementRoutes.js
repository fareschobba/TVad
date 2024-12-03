const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  createAdvertisement,
  getAllAdvertisements,
  updateAdvertisement,
  deleteAdvertisement
} = require('../controllers/advertisementController');

const router = express.Router();

// Public route
router.get('/', getAllAdvertisements);

// Protected routes
router.post('/', protect, createAdvertisement);
router.put('/:id', protect, updateAdvertisement);
router.delete('/:id', protect, deleteAdvertisement);

module.exports = router;