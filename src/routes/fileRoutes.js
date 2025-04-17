const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { protect } = require('../middleware/authMiddleware');
const fileController = require('../controllers/fileController');
const { isVideoFile } = require('../utils/fileValidation');

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
        message: err.message
      });
    } else if (err) {
      // An unknown error occurred
      return res.status(500).json({
        error: 'Server error',
        message: err.message
      });
    }
    // Everything went fine
    next();
  });
};

// File upload route that handles both direct files and YouTube URLs
router.post('/upload', 
  protect,
  uploadMiddleware,
  fileController.uploadFile
);

router.get('/',protect, fileController.listFiles);
router.get('/:fileId/content',protect, fileController.getFileContent);
router.put('/:fileId/content',protect, fileController.updateFileContent);
router.delete('/:fileId',protect, fileController.deleteFile);
router.get('/:fileId/info',protect, fileController.getFileInfo);
router.get('/:fileId/download-url',protect, fileController.getDownloadUrl);

module.exports = router;



