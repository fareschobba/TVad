const b2Service = require('../services/b2.service');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const unlinkAsync = promisify(fs.unlink);

// Helper function to validate video file
const isVideoFile = (mimetype) => {
  const validVideoTypes = [
    'video/mp4',
    'video/mpeg',
    'video/x-matroska',  // MKV
    'video/x-msvideo',   // AVI
    'video/quicktime',   // MOV
    'video/webm',        // WebM
    'video/x-flv'   
  ];
  return validVideoTypes.includes(mimetype);
};

exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Double-check file type (additional security layer)
    if (!isVideoFile(req.file.mimetype)) {
      await unlinkAsync(req.file.path); // Clean up invalid file
      return res.status(400).json({
        error: 'Invalid file type',
        message: 'Only video files are allowed'
      });
    }

    const result = await b2Service.uploadFile(
      req.file.path,
      req.file.originalname,
      req.file.mimetype
    );

    // Clean up the temporary file
    await unlinkAsync(req.file.path);

    res.status(200).json({
      success: true,
      file: result
    });

  } catch (error) {
    // Clean up the temporary file in case of error
    if (req.file && req.file.path) {
      try {
        await unlinkAsync(req.file.path);
      } catch (cleanupError) {
        console.error('Error cleaning up temporary file:', cleanupError);
      }
    }

    console.error('Error uploading file:', error);
    res.status(500).json({
      error: 'Failed to upload file',
      message: error.message
    });
  }
};

exports.listFiles = async (req, res) => {
  try {
    const files = await b2Service.listFiles();
    res.status(200).json(files);
  } catch (error) {
    console.error('Error listing files:', error);
    res.status(500).json({ error: 'Failed to list files', message: error.message });
  }
};

exports.getFileContent = async (req, res) => {
  try {
    const fileId = req.params.fileId;
    const { content, contentType } = await b2Service.downloadFile(fileId);
    
    res.setHeader('Content-Type', contentType);
    res.send(Buffer.from(content));
  } catch (error) {
    console.error('Error getting file content:', error);
    res.status(500).json({ error: 'Failed to get file content', message: error.message });
  }
};

exports.updateFileContent = async (req, res) => {
  try {
    const fileId = req.params.fileId;
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'No content provided' });
    }
    
    const fileInfo = await b2Service.getFileInfo(fileId);
    
    await b2Service.uploadBuffer(
      Buffer.from(content),
      fileInfo.fileName,
      fileInfo.contentType
    );
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error updating file content:', error);
    res.status(500).json({ error: 'Failed to update file content', message: error.message });
  }
};

exports.deleteFile = async (req, res) => {
  try {
    const fileId = req.params.fileId;
    
    // Verify file type before deletion
    const fileInfo = await b2Service.getFileInfo(fileId);
    if (!isVideoFile(fileInfo.contentType)) {
      return res.status(400).json({
        error: 'Invalid file type',
        message: 'Only video files can be managed through this API'
      });
    }

    await b2Service.deleteFile(fileId);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({
      error: 'Failed to delete file',
      message: error.message
    });
  }
};

exports.getFileInfo = async (req, res) => {
  try {
    const fileId = req.params.fileId;
    const fileInfo = await b2Service.getFileInfo(fileId);
    
    // Verify that the stored file is a video
    if (!isVideoFile(fileInfo.contentType)) {
      return res.status(400).json({
        error: 'Invalid file type',
        message: 'The requested file is not a video'
      });
    }

    res.status(200).json(fileInfo);
  } catch (error) {
    console.error('Error getting file info:', error);
    res.status(500).json({
      error: 'Failed to get file info',
      message: error.message
    });
  }
};

exports.getDownloadUrl = async (req, res) => {
  try {
    const fileId = req.params.fileId;
    
    // Verify file type before generating download URL
    const fileInfo = await b2Service.getFileInfo(fileId);
    if (!isVideoFile(fileInfo.contentType)) {
      return res.status(400).json({
        error: 'Invalid file type',
        message: 'Only video files can be downloaded through this API'
      });
    }

    const url = await b2Service.getDownloadUrl(fileId);
    res.status(200).json({ url });
  } catch (error) {
    console.error('Error getting download URL:', error);
    res.status(500).json({
      error: 'Failed to get download URL',
      message: error.message
    });
  }
};

