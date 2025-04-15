const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect } = require('../middleware/authMiddleware');
const fileController = require('../controllers/fileController');

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
  }
});

// File upload route that handles both direct files and YouTube URLs
router.post('/upload', 
  protect,
  upload.single('video'),
  fileController.uploadFile
);

router.get('/', fileController.listFiles);
router.get('/:fileId/content', fileController.getFileContent);
router.put('/:fileId/content', fileController.updateFileContent);
router.delete('/:fileId', fileController.deleteFile);
router.get('/:fileId/info', fileController.getFileInfo);
router.get('/:fileId/download-url', fileController.getDownloadUrl);

module.exports = router;

