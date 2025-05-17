const Advertisement = require('../models/advertisement');
const cloudinaryService = require('../services/cloudinary.service');
const fs = require('fs/promises');
const { isVideoFile } = require('../utils/fileValidation');
const cloudinaryYoutubeService = require('../services/cloudinary-youtube.service');

// Get all advertisements
const getAllAdvertisements = async (req, res) => {
  try {
    const advertisements = await Advertisement.find({ 
      isDeleted: false,
      //uploadType: { $in: ['cloudinary', 'cloudinary-youtube'] }
    })
      .populate('userId', 'username email')
      .lean();

    // Check file existence for each advertisement
    const advertisementsWithFileStatus = await Promise.all(
      advertisements.map(async (ad) => {
        if (ad.fileId) {
          try {
            const fileInfo = await cloudinaryService.getFileInfo(ad.fileId);
            return {
              ...ad,
              fileExists: true,
              fileInfo: {
                contentType: fileInfo.contentType,
                contentLength: fileInfo.contentLength,
                uploadTimestamp: fileInfo.uploadTimestamp
              }
            };
          } catch (error) {
            return {
              ...ad,
              fileExists: false,
              fileError: 'File not found in storage'
            };
          }
        }
        return {
          ...ad,
          fileExists: false
        };
      })
    );

    res.status(200).json({
      success: true,
      data: advertisementsWithFileStatus
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Unable to retrieve advertisements. Please try again later.'
    });
  }
};

// Get advertisement by ID
const getAdvertisementById = async (req, res) => {
  try {
    const advertisement = await Advertisement.findOne({ 
      _id: req.params.id, 
      isDeleted: false,
      //uploadType: { $in: ['cloudinary', 'cloudinary-youtube'] }
    }).populate('userId', 'username email');

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found'
      });
    }

    // Verify file existence in Cloudinary
    if (advertisement.fileId) {
      try {
        const fileInfo = await cloudinaryService.getFileInfo(advertisement.fileId);
        advertisement._doc.fileExists = true;
        advertisement._doc.fileInfo = {
          contentType: fileInfo.contentType,
          contentLength: fileInfo.contentLength,
          uploadTimestamp: fileInfo.uploadTimestamp
        };
      } catch (error) {
        advertisement._doc.fileExists = false;
        advertisement._doc.fileError = 'File not found in storage';
      }
    }

    res.status(200).json({
      success: true,
      data: advertisement
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Unable to retrieve advertisement details. Please try again later.'
    });
  }
};

// Get advertisements by user ID
const getAdvertisementsByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    // Build query
    const query = {
      userId,
      isDeleted: false,
      //uploadType: { $in: ['cloudinary', 'cloudinary-youtube'] }
    };

    // Add status filter if provided
    if (status) {
      if (!['pending', 'active', 'inactive'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status value'
        });
      }
      query.status = status;
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Get all advertisements
    const advertisements = await Advertisement.find(query)
      .populate('userId', 'username email')
      .sort(sort)
      .lean();

    // Check file existence for each advertisement
    const advertisementsWithFileStatus = await Promise.all(
      advertisements.map(async (ad) => {
        if (ad.fileId) {
          try {
            const fileInfo = await cloudinaryService.getFileInfo(ad.fileId);
            return {
              ...ad,
              fileExists: true,
              fileInfo: {
                contentType: fileInfo.contentType,
                contentLength: fileInfo.contentLength,
                uploadTimestamp: fileInfo.uploadTimestamp
              }
            };
          } catch (error) {
            return {
              ...ad,
              fileExists: false,
              fileError: 'File not found in storage'
            };
          }
        }
        return {
          ...ad,
          fileExists: false
        };
      })
    );

    res.status(200).json({
      success: true,
      data: advertisementsWithFileStatus
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Unable to retrieve user advertisements. Please try again later.'
    });
  }
};

// Update advertisement (simple - no file)
const updateAdvertisementSimple = async (req, res) => {
  try {
    const { name, description, orientation } = req.body;
    
    // Validate required fields
    if (!name && !description && !orientation) {
      return res.status(400).json({
        success: false,
        message: 'At least one field to update is required'
      });
    }

    // Build update object
    const updateData = {};
    if (name) updateData.name = name;
    if (description) updateData.description = description;
    if (orientation) {
      if (!['portrait', 'landscape'].includes(orientation)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid orientation. Must be either "portrait" or "landscape"'
        });
      }
      updateData.orientation = orientation;
    }

    const advertisement = await Advertisement.findOneAndUpdate(
      { 
        _id: req.params.id, 
        isDeleted: false,
        userId: req.user._id,
        // //uploadType: { $in: ['cloudinary', 'cloudinary-youtube'] }
      },
      updateData,
      { 
        new: true,
        runValidators: true 
      }
    ).populate('userId', 'username email');

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found or unauthorized'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Advertisement updated successfully',
      data: advertisement
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update advertisement details. Please verify your input and try again.'
    });
  }
};

// Complex advertisement update (including video file)
const updateAdvertisementComplex = async (req, res) => {
  try {
    const { name, description, orientation, youtubeUrl } = req.body;
    const advertisementId = req.params.id;

    // Find the existing advertisement
    const existingAd = await Advertisement.findOne({ 
      _id: advertisementId,
      isDeleted: false,
      userId: req.user._id,
      //uploadType: { $in: ['cloudinary', 'cloudinary-youtube'] }
    });

    if (!existingAd) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found or unauthorized'
      });
    }

    // Initialize update data
    const updateData = {};
    if (name) updateData.name = name;
    if (description) updateData.description = description;
    if (orientation) updateData.orientation = orientation;

    // Handle file update based on input type
    if (youtubeUrl && req.file) {
      return res.status(400).json({
        success: false,
        message: 'Cannot process both YouTube URL and video file. Please provide only one.'
      });
    }

    // Delete existing file if there's a new file or YouTube URL
    if ((youtubeUrl || req.file) && existingAd.fileId) {
      try {
        await cloudinaryService.deleteFile(existingAd.fileId);
      } catch (error) {
        console.error('Error during file deletion:', error);
        // Continue with the update even if deletion fails
      }
    }

    if (youtubeUrl) {
      // Handle YouTube URL upload
      try {
        if (!await cloudinaryYoutubeService.validateYouTubeUrl(youtubeUrl)) {
          return res.status(400).json({
            error: 'Invalid URL',
            message: 'Please provide a valid YouTube URL'
          });
        }

        const result = await cloudinaryYoutubeService.downloadVideo(youtubeUrl, 'highest');

        updateData.videoUrl = result.url;
        updateData.fileName = result.fileName;
        updateData.fileId = result.fileId;
        updateData.uploadType = 'cloudinary-youtube';
        updateData.sourceUrl = youtubeUrl;

      } catch (error) {
        throw new Error('Failed to process YouTube video. Please verify the URL and try again.');
      }
    } else if (req.file) {
      // Handle direct file upload
      try {
        if (!isVideoFile(req.file.mimetype)) {
          await fs.unlink(req.file.path);
          return res.status(400).json({
            error: 'Invalid file type',
            message: 'Only video files are allowed'
          });
        }

        const uploadResult = await cloudinaryService.uploadFile(
          req.file.path,
          req.file.originalname,
          req.file.mimetype
        );

        updateData.videoUrl = uploadResult.url;
        updateData.fileName = uploadResult.fileName;
        updateData.fileId = uploadResult.fileId;
        updateData.uploadType = 'cloudinary';
        updateData.sourceUrl = null;

        await fs.unlink(req.file.path);
      } catch (uploadError) {
        if (req.file.path) {
          await fs.unlink(req.file.path).catch(console.error);
        }
        throw new Error('Failed to upload video file. Please try again with a different file.');
      }
    } else if (!existingAd.videoUrl) {
      return res.status(400).json({
        success: false,
        message: 'Either a video file or YouTube URL must be provided'
      });
    }

    // Update the advertisement
    const updatedAd = await Advertisement.findOneAndUpdate(
      { _id: advertisementId },
      updateData,
      { 
        new: true,
        runValidators: true 
      }
    ).populate('userId', 'username email');

    res.status(200).json({
      success: true,
      message: 'Advertisement updated successfully',
      data: updatedAd
    });

  } catch (error) {
    console.error('Error updating advertisement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update advertisement and media content. Please check your file or URL and try again.',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Complete advertisement creation
const completeAdvertisement = async (req, res) => {
  try {
    const { advertisementId } = req.params;
    const { name, description, orientation } = req.body;
    const userId = req.user._id.toString();

    // Find the advertisement
    const advertisement = await Advertisement.findOne({
      _id: advertisementId,
      userId: userId,
      status: 'pending'
    });

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found or unauthorized'
      });
    }

    // Update advertisement details
    advertisement.name = name || advertisement.name;
    advertisement.description = description || advertisement.description;
    advertisement.orientation = orientation || advertisement.orientation;
    advertisement.status = 'active';

    await advertisement.save();

    res.status(200).json({
      success: true,
      message: 'Advertisement completed successfully',
      data: advertisement
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to complete advertisement. Please try again later.'
    });
  }
};

// Delete advertisement
const deleteAdvertisement = async (req, res) => {
  try {
    const { advertisementId } = req.params;

    const advertisement = await Advertisement.findOne({
      _id: advertisementId,
      //uploadType: { $in: ['cloudinary', 'cloudinary-youtube'] }
    });

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found or unauthorized'
      });
    }

    // Delete file from Cloudinary
    if (advertisement.fileId) {
      await cloudinaryService.deleteFile(advertisement.fileId);
    }

    // Soft delete the advertisement
    advertisement.isDeleted = true;
    await advertisement.save();

    res.status(200).json({
      success: true,
      message: 'Advertisement deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete advertisement. Please try again later.'
    });
  }
};

// Undelete advertisement
const undeleteAdvertisement = async (req, res) => {
  try {
    const { id } = req.params;

    const advertisement = await Advertisement.findOneAndUpdate(
      { 
        _id: id, 
        isDeleted: true,
        //uploadType: { $in: ['cloudinary', 'cloudinary-youtube'] }
      },
      { isDeleted: false },
      { new: true }
    );

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found or already active'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Advertisement restored successfully',
      data: advertisement
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to restore advertisement. Please try again later.'
    });
  }
};

// Create advertisement with direct file upload
const createAdvertisementWithFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Validate file type
    if (!isVideoFile(req.file.mimetype)) {
      await fs.unlink(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Only video files are allowed.'
      });
    }

    // Upload file to Cloudinary
    const uploadResult = await cloudinaryService.uploadFile(
      req.file.path,
      req.file.originalname,
      req.file.mimetype
    );

    // Create advertisement record
    const advertisement = await Advertisement.create({
      name: req.body.name || req.file.originalname,
      description: req.body.description || 'Pending description',
      videoUrl: uploadResult.url,
      fileName: uploadResult.fileName,
      fileId: uploadResult.fileId,
      userId: req.user._id,
      orientation: req.body.orientation || 'landscape',
      status: 'pending',
      uploadType: 'cloudinary',
      uploadDate: new Date()
    });

    // Clean up temporary file
    await fs.unlink(req.file.path);

    res.status(201).json({
      success: true,
      message: 'Advertisement created successfully',
      data: {
        advertisementId: advertisement._id,
        fileInfo: uploadResult
      }
    });
  } catch (error) {
    // Clean up temporary file if it exists
    if (req.file?.path) {
      await fs.unlink(req.file.path).catch(console.error);
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create advertisement. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Create advertisement with YouTube URL
const createAdvertisementWithYouTube = async (req, res) => {
  try {
    const { youtubeUrl, name, description, orientation } = req.body;

    if (!youtubeUrl) {
      return res.status(400).json({
        success: false,
        message: 'YouTube URL is required'
      });
    }

    // Validate YouTube URL
    if (!await cloudinaryYoutubeService.validateYouTubeUrl(youtubeUrl)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid YouTube URL'
      });
    }

    // Download and process YouTube video
    const result = await cloudinaryYoutubeService.downloadVideo(youtubeUrl, 'highest');

    // Create advertisement record
    const advertisement = await Advertisement.create({
      name: name || result.title,
      description: description || 'Pending description',
      videoUrl: result.url,
      fileName: result.fileName,
      fileId: result.fileId,
      userId: req.user._id,
      orientation: orientation || 'landscape',
      status: 'pending',
      uploadType: 'cloudinary-youtube',
      sourceUrl: youtubeUrl,
      uploadDate: new Date()
    });

    res.status(201).json({
      success: true,
      message: 'Advertisement created successfully with YouTube video',
      data: {
        advertisementId: advertisement._id,
        fileInfo: result
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create advertisement from YouTube. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getAllAdvertisements,
  getAdvertisementById,
  getAdvertisementsByUserId,
  updateAdvertisementSimple,
  updateAdvertisementComplex,
  completeAdvertisement,
  deleteAdvertisement,
  undeleteAdvertisement,
  createAdvertisementWithFile,
  createAdvertisementWithYouTube
};
