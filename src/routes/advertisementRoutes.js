const express = require('express');
const multer = require('multer');
const { protect } = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/roleMiddleware');
const {
  getAllAdvertisements,
  deleteAdvertisement,
  getAdvertisementById,
  completeAdvertisement,
  updateAdvertisementSimple,
  updateAdvertisementComplex,
  getAdvertisementsByUserId,
  undeleteAdvertisement
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

// Routes
router.get('/', protect, isAdmin, getAllAdvertisements);
router.get('/:id', protect, getAdvertisementById);
router.get('/getAdvertisementsByuser/:userId', protect, getAdvertisementsByUserId);
// router.delete('/undelete/:id', protect, undeleteAdvertisement);
router.patch('/:id/updateAdsSimple', protect, updateAdvertisementSimple);
router.post('/:advertisementId/completeCreation', protect, completeAdvertisement);
router.put('/:id/updateAdsComplex', protect, upload.single('video'), updateAdvertisementComplex);
router.delete('/:advertisementId', protect, deleteAdvertisement);

module.exports = router;
