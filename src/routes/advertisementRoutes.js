const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  createAdvertisement,
  getAllAdvertisements,
  updateAdvertisement,
  deleteAdvertisement,
  deleteAdvertisement,
  getAdvertisementById,
  completeAdvertisement,
  updateAdvertisementSimple,
  updateAdvertisementComplex
} = require('../controllers/advertisementController');

const router = express.Router();

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// Public route
router.get('/', getAllAdvertisements);

// Protected routes
router.post('/', protect, createAdvertisement);
router.delete('/:id', protect, deleteAdvertisement);
router.get('/:id',  getAdvertisementById);
router.delete('/undelete/:id', protect, undeleteAdvertisement);
router.delete('/deleteById/:id', protect, deleteAdvertisementById);

// Simple update route (name and description only)
router.patch('/:id/simple', 
  protect, 
  updateAdvertisementSimple
);

// Complete advertisement creation with additional info
router.post('/:advertisementId/complete',
  protect,
  completeAdvertisement
);

// Complex update route (including video file)
router.put('/:id/complex', protect,
  upload.single('video'), // Handle file upload
  updateAdvertisementComplex
);

// Delete advertisement and its file
router.delete('/:advertisementId',
  protect,
  deleteAdvertisement
);

module.exports = router;