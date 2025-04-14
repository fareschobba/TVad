const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const youtubeController = require('../controllers/youtubeController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Define allowed video MIME types
const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/x-matroska',  // MKV
  'video/x-msvideo',   // AVI
  'video/quicktime',   // MOV
  'video/webm',        // WebM
  'video/x-flv'        // FLV
];

// Configure multer for file uploads with file type validation
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_VIDEO_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only video files are allowed.'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024 // 50MB limit
  }
});

// File routes with error handling
router.post('/upload', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: 'File size limit exceeded',
          message: 'Maximum file size allowed is 50MB'
        });
      }
      return res.status(400).json({
        error: 'Upload error',
        message: err.message
      });
    } else if (err) {
      return res.status(400).json({
        error: 'Invalid file',
        message: err.message
      });
    }
    next();
  });
}, fileController.uploadFile);

router.get('/', fileController.listFiles);
router.get('/:fileId/content', fileController.getFileContent);
router.put('/:fileId/content', fileController.updateFileContent);
router.delete('/:fileId', fileController.deleteFile);
router.get('/:fileId/info', fileController.getFileInfo);
router.get('/:fileId/download-url', fileController.getDownloadUrl);

// Remove these YouTube routes
router.post('/youtube/info', youtubeController.getVideoInfo);
router.post('/youtube/download', youtubeController.downloadVideo);

module.exports = router;




