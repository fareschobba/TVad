const Device = require('../models/device');
const Advertisement = require('../models/advertisement');
const Schedule = require('../models/schedule');

const checkScheduleOverlap = async (deviceId, startTime, playTime, currentScheduleId = null) => {
    if (!playTime || playTime <= 0) {
        throw new Error('playTime must be greater than 0');
    }

    const endTime = new Date(new Date(startTime).getTime() + playTime * 1000);
    const overlapQuery = {
        deviceId,
        isDeleted: false,
        $or: [
            {
                startTime: { $lt: endTime },
                endTime: { $gt: startTime }
            },
            {
                startTime: { $gte: startTime },
                endTime: { $lte: endTime }
            }
        ]
    };

    if (currentScheduleId) {
        overlapQuery._id = { $ne: currentScheduleId };
    }

    return await Schedule.findOne(overlapQuery);
};


// Create schedule
exports.createSchedule = async (req, res) => {
  try {
    const { advertisementIds, deviceId, startTime, playTime, playMode, repeat } = req.body;

    // Validate device exists and not deleted
    const device = await Device.findOne({ _id: deviceId, isDeleted: false });
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    // Validate all advertisements exist and not deleted
    const advertisements = await Advertisement.find({
      _id: { $in: advertisementIds },
      isDeleted: false
    });
    if (advertisements.length !== advertisementIds.length) {
      return res.status(404).json({
        success: false,
        message: 'One or more advertisements not found'
      });
    }

    // Check for schedule overlap
    // const overlappingSchedule = await checkScheduleOverlap(deviceId, startTime, playTime);
    // if (overlappingSchedule) {
    //   return res.status(400).json({
    //     success: false,
    //     message: 'Schedule overlaps with an existing schedule',
    //     conflictingSchedule: overlappingSchedule
    //   });
    // }

    const endTime = new Date(new Date(startTime).getTime() + playTime * 1000);
    const schedule = await Schedule.create({
      advertisementIds,
      deviceId,
      startTime,
      endTime,
      playTime,
      playMode,
      repeat
    });

    res.status(201).json({
      success: true,
      data: schedule
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};


// Get all schedules
exports.getAllSchedules = async (req, res) => {
  try {
    const schedules = await Schedule.find({ isDeleted: false })
      .populate('deviceId', 'name description')
      .populate('advertisementIds', 'name description videoUrl orientation');

    res.status(200).json({
      success: true,
      data: schedules
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get schedules by filter (advertisementId/deviceId/date)
exports.getSchedulesByFilter = async (req, res) => {
  try {
    const { advertisementId, deviceId, date } = req.query;
    const query = { isDeleted: false };

    if (advertisementId) {
      query.advertisementIds = advertisementId;
    }
    if (deviceId) {
      query.deviceId = deviceId;
    }
    if (date) {
      const searchDate = new Date(date);
      const nextDay = new Date(searchDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      query.startTime = {
        $gte: searchDate,
        $lt: nextDay
      };
    }

    const schedules = await Schedule.find(query)
      .populate('deviceId', 'name description')
      .populate('advertisementIds', 'name description videoUrl orientation');

    res.status(200).json({
      success: true,
      data: schedules
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update schedule
exports.updateSchedule = async (req, res) => {
  try {
    const { advertisementIds, startTime, playTime, playMode, repeat } = req.body;
    const scheduleId = req.params.id;

    // Validate schedule exists
    const schedule = await Schedule.findOne({ _id: scheduleId, isDeleted: false });
    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
    }

    // If advertisementIds are being updated, validate they exist
    if (advertisementIds) {
      const advertisements = await Advertisement.find({
        _id: { $in: advertisementIds },
        isDeleted: false
      });
      if (advertisements.length !== advertisementIds.length) {
        return res.status(404).json({
          success: false,
          message: 'One or more advertisements not found'
        });
      }
    }

    // Check for schedule overlap if time-related fields are being updated
    if (startTime || playTime) {
      const newStartTime = startTime || schedule.startTime;
      const newPlayTime = playTime || schedule.playTime;
      const overlappingSchedule = await checkScheduleOverlap(
        schedule.deviceId,
        newStartTime,
        newPlayTime,
        scheduleId
      );
      
      if (overlappingSchedule) {
        return res.status(400).json({
          success: false,
          message: 'Schedule update would create an overlap with an existing schedule',
          conflictingSchedule: overlappingSchedule
        });
      }
    }

    // Calculate new endTime if needed
    const endTime = startTime || playTime ? 
      new Date(new Date(startTime || schedule.startTime).getTime() + (playTime || schedule.playTime) * 60000) :
      schedule.endTime;

    const updatedSchedule = await Schedule.findByIdAndUpdate(
      scheduleId,
      {
        advertisementIds,
        startTime,
        endTime,
        playTime,
        playMode,
        repeat
      },
      { new: true, runValidators: true }
    ).populate('deviceId', 'name description')
     .populate('advertisementIds', 'name description');

    res.status(200).json({
      success: true,
      data: updatedSchedule
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Delete schedule (soft delete)
exports.deleteSchedule = async (req, res) => {
  try {
    const schedule = await Schedule.findByIdAndUpdate(
      req.params.id,
      { isDeleted: true },
      { new: true }
    );

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Schedule deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
