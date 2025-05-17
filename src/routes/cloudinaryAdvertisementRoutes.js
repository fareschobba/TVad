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
  undeleteAdvertisement,
  createAdvertisementWithFile,
  createAdvertisementWithYouTube,
  createAdvertisementWithProgress,
  createAdvertisementWithYouTubeProgress
} = require('../controllers/cloudinaryAdvertisementController');
const { isVideoFile } = require('../utils/fileValidation');
const path = require('path');
const router = express.Router();

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(process.cwd(), 'uploads');
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // Sanitize filename to remove special characters
    const sanitizedOriginalname = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${uniqueSuffix}-${sanitizedOriginalname}`);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Skip file validation if YouTube URL is provided
    if (req.body.youtubeUrl) {
      return cb(null, false);
    }
    
    if (isVideoFile(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only video files are allowed.'), false);
    }
  },
  limits: {
    fileSize: 1024 * 1024 * 100 // 100 MB limit
  }
}).single('video');

// Wrap upload middleware to handle errors
const uploadMiddleware = (req, res, next) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      // A Multer error occurred when uploading
      return res.status(400).json({
        error: 'Upload error',
        message: 'Invalid file type. Only video files are allowed.'
      });
    } else if (err) {
      // An unknown error occurred
      return res.status(500).json({
        error: 'Server error',
        message: 'Unable to process the file. Please try again.'
      });
    }
    // Everything went fine
    next();
  });
};

// Routes - matching the exact structure of advertisementRoutes.js
router.get('/', protect, isAdmin, getAllAdvertisements);
router.get('/:id', protect, getAdvertisementById);
router.get('/getAdvertisementsByuser/:userId', protect, getAdvertisementsByUserId);
router.delete('/undelete/:id', protect, undeleteAdvertisement);
router.patch('/:id/updateAdsSimple', protect, updateAdvertisementSimple);
router.post('/:advertisementId/completeCreation', protect, completeAdvertisement);
router.put('/:id/updateAdsComplex', protect, uploadMiddleware, updateAdvertisementComplex);
router.delete('/:advertisementId', protect, deleteAdvertisement);

// Additional routes for file and YouTube uploads
router.post('/upload', protect, uploadMiddleware, createAdvertisementWithFile);
router.post('/youtube', protect, createAdvertisementWithYouTube);
router.post('/upload-with-progress', protect, uploadMiddleware, createAdvertisementWithProgress);
router.post('/youtube-with-progress', protect, createAdvertisementWithYouTubeProgress);

module.exports = router;

