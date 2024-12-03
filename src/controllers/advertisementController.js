const Advertisement = require('../models/advertisement');

// Create advertisement
const createAdvertisement = async (req, res) => {
  try {
    const { name, description, videoUrl, orientation } = req.body;

    // Validate required fields
    if (!name || !description || !videoUrl || !orientation) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required: name, description, videoUrl, orientation'
      });
    }

    // Validate orientation
    if (!['portrait', 'landscape'].includes(orientation)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid orientation. Must be either "portrait" or "landscape"'
      });
    }

    // Create advertisement
    const advertisement = await Advertisement.create({
      name,
      description,
      videoUrl,
      orientation
    });

    res.status(201).json({
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

// Get all advertisements
const getAllAdvertisements = async (req, res) => {
  try {
    const advertisements = await Advertisement.find({ isDeleted: false });
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

// Update advertisement
const updateAdvertisement = async (req, res) => {
  try {
    const { name, description, videoUrl, orientation } = req.body;
    const updateData = {};

    // Build update object with only provided fields
    if (name) updateData.name = name;
    if (description) updateData.description = description;
    if (videoUrl) updateData.videoUrl = videoUrl;
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
      { _id: req.params.id, isDeleted: false },
      updateData,
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
      data: advertisement
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete advertisement (soft delete)
const deleteAdvertisement = async (req, res) => {
  try {
    const advertisement = await Advertisement.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { isDeleted: true },
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
      message: 'Advertisement deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  createAdvertisement,
  getAllAdvertisements,
  updateAdvertisement,
  deleteAdvertisement
};
