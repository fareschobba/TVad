const Advertisement = require('../models/advertisement');
const b2Service = require('../services/b2.service');
const { unlinkAsync } = require('fs-extra');

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
    const advertisements = await Advertisement.find();
    res.status(200).json({
      success: true,
      data: advertisements
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
    const { name, description, orientation } = req.body;
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

    // Check if the file exists in Backblaze B2 and delete it
    if (existingAd.fileId) {
      try {
        // Verify file exists and is accessible
        const fileInfo = await b2Service.getFileInfo(existingAd.fileId);
        
        // Additional validation if needed
        if (!fileInfo || !isVideoFile(fileInfo.contentType)) {
          console.warn(`Invalid file type found in B2: ${fileInfo?.contentType}`);
        }

        // Attempt to delete the file from B2
        await b2Service.deleteFile(existingAd.fileId);
        console.log(`Successfully deleted file ${existingAd.fileId} from B2`);

      } catch (error) {
        if (error.message.includes('not found')) {
          // File doesn't exist in B2, we can proceed
          console.warn(`File ${existingAd.fileId} not found in B2, proceeding with update`);
        } else {
          // Other B2 API errors
          return res.status(500).json({
            success: false,
            message: 'Error managing existing file in B2',
            error: error.message
          });
        }
      }

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

    // Handle file update if new file is provided
    if (req.file) {
      try {
        // Validate video file type
        if (!isVideoFile(req.file.mimetype)) {
          await unlinkAsync(req.file.path); // Clean up invalid file
          return res.status(400).json({
            error: 'Invalid file type',
            message: 'Only video files are allowed'
          });
        }

        // Try to delete the existing file from B2
        if (existingAd.fileId) {
          try {
            await b2Service.deleteFile(existingAd.fileId);
          } catch (deleteError) {
            console.error('Error deleting existing file:', deleteError);
            // Continue with upload even if delete fails
          }
        }

        // Upload new file
        const uploadResult = await b2Service.uploadFile(
          req.file.path,
          req.file.originalname,
          req.file.mimetype
        );

        // Update file-related fields
        updateData.videoUrl = uploadResult.url;
        updateData.fileName = uploadResult.fileName;
        updateData.fileId = uploadResult.fileId;

        // Clean up temporary file
        await unlinkAsync(req.file.path);
      } catch (uploadError) {
        // Clean up temporary file on error
        if (req.file.path) {
          await unlinkAsync(req.file.path).catch(console.error);
        }
        throw uploadError;
      }
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
      message: error.message
    });
  }
};

const getAdvertisementById = async (req, res) => {
  try {
    const advertisement = await Advertisement.findOne({ 
      _id: req.params.id, 
      isDeleted: false 
    });

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found'
      });
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



// Complete advertisement creation after file upload
const completeAdvertisement = async (req, res) => {
  try {
    const { advertisementId } = req.params;
    const { name, description, orientation } = req.body;

    // Validate required fields
    if (!name || !description || !orientation) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required: name, description, orientation'
      });
    }

    // Validate orientation
    if (!['portrait', 'landscape'].includes(orientation)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid orientation. Must be either "portrait" or "landscape"'
      });
    }

    // Find the pending advertisement
    const advertisement = await Advertisement.findOne({
      _id: advertisementId,
      userId: req.user._id,
      status: 'pending'
    });

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: 'Pending advertisement not found or unauthorized'
      });
    }

    // Update the advertisement with complete information
    advertisement.name = name;
    advertisement.description = description;
    advertisement.orientation = orientation;
    advertisement.status = 'active';

    await advertisement.save();

    res.status(200).json({
      success: true,
      message: 'Advertisement created successfully',
      data: advertisement
    });
  } catch (error) {
    console.error('Error completing advertisement:', error);
    res.status(500).json({
      success: false,
      message: error.message
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

// Helper function to validate video file
const isVideoFile = (mimetype) => {
  const validVideoTypes = [
    'video/mp4',
    'video/mpeg',
    'video/x-matroska',  // MKV
    'video/x-msvideo',   // AVI
    'video/quicktime',   // MOV
    'video/webm',        // WebM
    'video/x-flv'        // FLV
  ];
  return validVideoTypes.includes(mimetype);
};

module.exports = {
  createAdvertisement,
  getAllAdvertisements,
  updateAdvertisementSimple,
  updateAdvertisementComplex,
  deleteAdvertisement,
  undeleteAdvertisement,
  getAdvertisementById,
  deleteAdvertisementById,
  completeAdvertisement,
  deleteAdvertisement
};
