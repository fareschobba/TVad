const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  createAdvertisement,
  getAllAdvertisements,
  updateAdvertisement,
  deleteAdvertisement,
  undeleteAdvertisement,
  getAdvertisementById,
  deleteAdvertisementById
} = require('../controllers/advertisementController');

const router = express.Router();

// Public route
router.get('/', getAllAdvertisements);

// Protected routes
router.post('/', protect, createAdvertisement);
router.put('/:id', protect, updateAdvertisement);
router.delete('/:id', protect, deleteAdvertisement);
router.get('/:id',  getAdvertisementById);
router.delete('/undelete/:id', protect, undeleteAdvertisement);
router.delete('/deleteById/:id', protect, deleteAdvertisementById);

module.exports = router;