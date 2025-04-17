const Advertisement = require('../models/advertisement');
const b2Service = require('../services/b2.service');
const fs = require('fs/promises');  // Change this line
const { isVideoFile } = require('../utils/fileValidation');
const youtubeService = require('../services/youtube.service');
const unlinkAsync = fs.unlink;  // Add this line
// // Create advertisement
// const createAdvertisement = async (req, res) => {
//   try {
//     const { name, description, videoUrl, orientation } = req.body;

//     // Validate required fields
//     if (!name || !description || !videoUrl || !orientation) {
//       return res.status(400).json({
//         success: false,
//         message: 'All fields are required: name, description, videoUrl, orientation'
//       });
//     }

//     // Validate orientation
//     if (!['portrait', 'landscape'].includes(orientation)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid orientation. Must be either "portrait" or "landscape"'
//       });
//     }

//     // Create advertisement
//     const advertisement = await Advertisement.create({
//       name,
//       description,
//       videoUrl,
//       orientation
//     });

//     res.status(201).json({
//       success: true,
//       data: advertisement
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: error.message
//     });
//   }
// };

// Get all advertisements
const getAllAdvertisements = async (req, res) => {
  try {
    const advertisements = await Advertisement.find({ isDeleted: false })
      .populate('userId', 'username email')
      .lean();

    // Check file existence for each advertisement
    const advertisementsWithFileStatus = await Promise.all(
      advertisements.map(async (ad) => {
        if (ad.fileId) {
          try {
            const fileInfo = await b2Service.getFileInfo(ad.fileId);
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
      message: error.message
    });
  }
};

// Simple advertisement update (name and description only)
const updateAdvertisementSimple = async (req, res) => {
  try {
    const { name, description } = req.body;
    const updateData = {};

    // Build update object with only provided fields
    if (name) updateData.name = name;
    if (description) updateData.description = description;

    // Validate that at least one field is provided
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide at least one field to update (name or description)'
      });
    }

    const advertisement = await Advertisement.findOneAndUpdate(
      { 
        _id: req.params.id, 
        isDeleted: false,
        userId: req.user._id
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
      message: error.message
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
      userId: req.user._id
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
    if (orientation) {
      if (!['portrait', 'landscape'].includes(orientation)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid orientation. Must be either "portrait" or "landscape"'
        });
      }
      updateData.orientation = orientation;
    }

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
        console.log('Attempting to delete file:', existingAd.fileId);
        
        // First try to get file info to confirm it exists
        try {
          await b2Service.getFileInfo(existingAd.fileId);
          // If file exists, delete it
          await b2Service.deleteFile(existingAd.fileId);
          console.log('Successfully deleted file:', existingAd.fileId);
        } catch (fileError) {
          console.warn('File info/delete error:', fileError.message);
          // Continue even if file doesn't exist or can't be deleted
        }
      } catch (error) {
        console.error('Error during file deletion:', error);
        // Continue with the update even if deletion fails
      }
    }

    if (youtubeUrl) {
      // Handle YouTube URL upload
      try {
        if (!await youtubeService.validateYouTubeUrl(youtubeUrl)) {
          return res.status(400).json({
            error: 'Invalid URL',
            message: 'Please provide a valid YouTube URL'
          });
        }

        const result = await youtubeService.downloadVideo(youtubeUrl, 'highest');
        console.log('YouTube download result:', result);

        updateData.videoUrl = result.url;
        updateData.fileName = result.fileName;
        updateData.fileId = result.fileId;
        updateData.uploadType = 'youtube';
        updateData.sourceUrl = youtubeUrl;

      } catch (error) {
        throw new Error(`YouTube processing failed: ${error.message}`);
      }
    } else if (req.file) {
      // Handle direct file upload
      try {
        if (!isVideoFile(req.file.mimetype)) {
          await unlinkAsync(req.file.path);
          return res.status(400).json({
            error: 'Invalid file type',
            message: 'Only video files are allowed'
          });
        }

        const uploadResult = await b2Service.uploadFile(
          req.file.path,
          req.file.originalname,
          req.file.mimetype
        );
        console.log('File upload result:', uploadResult);

        updateData.videoUrl = uploadResult.url;
        updateData.fileName = uploadResult.fileName;
        updateData.fileId = uploadResult.fileId;
        updateData.uploadType = 'direct';
        updateData.sourceUrl = null;

        await unlinkAsync(req.file.path);
      } catch (uploadError) {
        if (req.file.path) {
          await unlinkAsync(req.file.path).catch(console.error);
        }
        throw uploadError;
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
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

const getAdvertisementById = async (req, res) => {
  try {
    const advertisement = await Advertisement.findOne({ 
      _id: req.params.id, 
      isDeleted: false 
    }).populate('userId', 'username email');  // Add population for user details

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found'
      });
    }

    // Verify file existence in B2
    if (advertisement.fileId) {
      try {
        const fileInfo = await b2Service.getFileInfo(advertisement.fileId);
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
      message: error.message
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
      isDeleted: false
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
            const fileInfo = await b2Service.getFileInfo(ad.fileId);
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
      message: error.message
    });
  }
};

// Complete advertisement creation after file upload
const completeAdvertisement = async (req, res) => {
  try {
    const { advertisementId } = req.params;
    const { name, description, orientation } = req.body;
    const userId = req.user._id.toString(); // Convert to string for comparison

    // Debug logs
    console.log("Debug Info:", {
      advertisementId,
      userId,
      requestBody: req.body
    });

    // First, find without userId to check if ad exists
    const adExists = await Advertisement.findById(advertisementId);
    console.log("Advertisement found:", adExists);
    
    if (adExists) {
      console.log("Comparing IDs:", {
        "Ad userId": adExists.userId.toString(),
        "Request userId": userId,
        "Match": adExists.userId.toString() === userId
      });
    }

    // Main query
    const advertisement = await Advertisement.findOne({
      _id: advertisementId,
      userId: userId,
      status: 'pending'
    }).lean(); // Using lean() for better performance

    if (!advertisement) {
      // Detailed error response
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found or unauthorized',
        debug: {
          adExists: !!adExists,
          userMatch: adExists ? adExists.userId.toString() === userId : false,
          status: adExists ? adExists.status : null
        }
      });
    }

    // Update the advertisement
    const updatedAd = await Advertisement.findOneAndUpdate(
      { _id: advertisementId },
      {
        name,
        description,
        orientation,
        status: 'active'
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Advertisement created successfully',
      data: updatedAd
    });

  } catch (error) {
    console.error('Error completing advertisement:', error);
    res.status(500).json({
      success: false,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Delete advertisement with file
const deleteAdvertisement = async (req, res) => {
  try {
    const { advertisementId } = req.params;

    const advertisement = await Advertisement.findOne({
      _id: advertisementId,
      userId: req.user._id
    });

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found or unauthorized'
      });
    }

    // Delete file from B2
    await b2Service.deleteFile(advertisement.fileId);

    // Soft delete the advertisement
    advertisement.isDeleted = true;
    await advertisement.save();

    res.status(200).json({
      success: true,
      message: 'Advertisement deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting advertisement:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const undeleteAdvertisement = async (req, res) => {
  try {
    const advertisement = await Advertisement.findOneAndUpdate(
      { _id: req.params.id, isDeleted: true },
      { isDeleted: false },
      { new: true }
    );

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Advertisement undeleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllAdvertisements,
  updateAdvertisementSimple,
  updateAdvertisementComplex,
  deleteAdvertisement,
  getAdvertisementById,
  completeAdvertisement,getAdvertisementsByUserId,undeleteAdvertisement,
  deleteAdvertisement
};
