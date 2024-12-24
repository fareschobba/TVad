const Device = require("../models/device");
const Advertisement = require("../models/advertisement");
const Schedule = require("../models/schedule");
const mongoose = require("mongoose");
const socket = require('../config/socket');

const checkScheduleOverlap = async (
  deviceId,
  startTime,
  playTime,
  currentScheduleId = null
) => {
  if (!playTime || playTime <= 0) {
    throw new Error("playTime must be greater than 0");
  }

  const endTime = new Date(new Date(startTime).getTime() + playTime * 1000);
  const overlapQuery = {
    deviceId,
    isDeleted: false,
    $or: [
      {
        startTime: { $lt: endTime },
        endTime: { $gt: startTime },
      },
      {
        startTime: { $gte: startTime },
        endTime: { $lte: endTime },
      },
    ],
  };

  if (currentScheduleId) {
    overlapQuery._id = { $ne: currentScheduleId };
  }

  return await Schedule.findOne(overlapQuery);
};

// Create schedule
exports.createSchedule = async (req, res) => {
  try {
    const {
      advertisementIds,
      deviceId,
      startTime,
      playTime,
      playMode,
      repeat,
    } = req.body;

    // Validate device exists and not deleted
    const device = await Device.findOne({ _id: deviceId, isDeleted: false });
    if (!device) {
      return res.status(404).json({
        success: false,
        message: "Device not found",
      });
    }

    // Validate all advertisements exist and not deleted
    const advertisements = await Advertisement.find({
      _id: { $in: advertisementIds },
      isDeleted: false,
    });
    if (advertisements.length !== advertisementIds.length) {
      return res.status(404).json({
        success: false,
        message: "One or more advertisements not found",
      });
    }

    // Check for schedule overlap
    const overlap = await checkScheduleOverlap(deviceId, startTime, playTime);
    if (overlap) {
      return res.status(400).json({
        success: false,
        message: "Schedule overlaps with existing schedule",
      });
    }

    // Calculate end time
    const endTime = new Date(new Date(startTime).getTime() + playTime * 1000);

    // Create new schedule
    const newSchedule = new Schedule({
      advertisementIds,
      deviceId,
      startTime,
      endTime,
      playTime,
      playMode,
      repeat,
    });

    await newSchedule.save();

    // Emit socket event to notify connected clients
    const io = socket.getIO();
    io.emit(`updateSchedule/${deviceId}`, {
      schedule: newSchedule,
    device: device
    });
//console the io result
console.log(io);

    res.status(201).json({
      success: true,
      message: "Schedule created successfully",
      data: newSchedule,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all schedules
exports.getAllSchedules = async (req, res) => {
  try {
    const schedules = await Schedule.find({ isDeleted: false })
      .populate("deviceId", "name description")
      .populate("advertisementIds", "name description videoUrl orientation");

    res.status(200).json({
      success: true,
      data: schedules,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
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
      // Validate device exists and not deleted
      const device = await Device.findOne({ deviceId: deviceId, isDeleted: false });
      if (!device) {
        return res.status(404).json({
          success: false,
          message: "Device not found",
        });
      }
      console.log("device : " ,device)
      query.deviceId = device._id;
    }
    if (date) {
      const searchDate = new Date(date);
      const nextDay = new Date(searchDate);
      nextDay.setDate(nextDay.getDate() + 1);

      query.startTime = {
        $gte: searchDate,
        $lt: nextDay,
      };

      console.log("query :", query);
    }

    const schedules = await Schedule.find(query)
      .populate("deviceId", "name description")
      .populate("advertisementIds", "name description videoUrl orientation");

    res.status(200).json({
      success: true,
      data: schedules,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update schedule
exports.updateSchedule = async (req, res) => {
  try {
    const { advertisementIds, startTime, playTime, playMode, repeat, deviceId } =
      req.body;
    const scheduleId = req.params.id;

    // Validate schedule exists
    const schedule = await Schedule.findOne({
      _id: scheduleId,
      isDeleted: false,
    });
    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "Schedule not found",
      });
    }

    // If advertisementIds are being updated, validate they exist
    if (advertisementIds) {
      const advertisements = await Advertisement.find({
        _id: { $in: advertisementIds },
        isDeleted: false,
      });
      if (advertisements.length !== advertisementIds.length) {
        return res.status(404).json({
          success: false,
          message: "One or more advertisements not found",
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
          message:
            "Schedule update would create an overlap with an existing schedule",
          conflictingSchedule: overlappingSchedule,
        });
      }
    }

    // Calculate new endTime if needed
    const endTime =
      startTime || playTime
        ? new Date(
          new Date(startTime || schedule.startTime).getTime() +
          (playTime || schedule.playTime) * 60000
        )
        : schedule.endTime;

    const updatedSchedule = await Schedule.findByIdAndUpdate(
      scheduleId,
      {
        advertisementIds,
        startTime,
        endTime,
        playTime,
        playMode,
        repeat,
      },
      { new: true, runValidators: true }
    )
      .populate("deviceId", "name description")
      .populate("advertisementIds", "name description videoUrl orientation");

    // Emit socket event to notify connected clients
    const io = socket.getIO();
    io.emit(`updateSchedule/${deviceId}`, {
      schedule: updatedSchedule,
      device: updatedSchedule.deviceId
    });

    res.status(200).json({
      success: true,
      data: updatedSchedule,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
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
        message: "Schedule not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Schedule deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
exports.archiveSchedule = async (req, res) => {
  const { id } = req.params;  // L'ID passé dans l'URL

  try {
    // Vérifier si l'ID est un ObjectId valide
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID de programme invalide' });
    }

    // Mise à jour du programme pour l'archiver
    const updatedSchedule = await Schedule.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true } // Retourne le document mis à jour
    );

    if (!updatedSchedule) {
      return res.status(404).json({ message: 'Schedule introuvable' });
    }

    return res.json(updatedSchedule);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: `Erreur lors de l'archivage : ${error.message}` });
  }
};

exports.getArchivedSchedules = async (req, res) => {
  try {
    const archivedSchedules = await Schedule.find({ isDeleted: true }).populate(
      "deviceId advertisementIds" // On suppose que vous avez des références dans ces champs
    );

    if (archivedSchedules.length === 0) {
      return res.status(404).json({ message: 'Aucun programme archivé trouvé' });
    }

    return res.json(archivedSchedules);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: `Erreur lors de la récupération des schedules archivés : ${error.message}` });
  }


};

  // Update schedule by deviceId
  exports.updateScheduleByDeviceId = async (req, res) => {
    try {
      const { deviceId, advertisementIds, startTime, playTime, playMode, repeat } = req.body;
  
      // Validate device exists and not deleted
      const device = await Device.findOne({ deviceId: deviceId, isDeleted: false });
      if (!device) {
        return res.status(404).json({
          success: false,
          message: "Device not found",
        });
      }
  
      // Find the schedule by deviceId
      const schedule = await Schedule.findOne({ deviceId: device._id });
      if (!schedule) {
        return res.status(404).json({
          success: false,
          message: "Schedule not found for the device",
        });
      }
  
      // Update schedule details
      schedule.advertisementIds = advertisementIds || schedule.advertisementIds;
      schedule.startTime = startTime || schedule.startTime;
      schedule.playTime = playTime || schedule.playTime;
      schedule.playMode = playMode || schedule.playMode;
      schedule.repeat = repeat || schedule.repeat;
  
      // Calculate end time
      schedule.endTime = new Date(new Date(schedule.startTime).getTime() + schedule.playTime * 60000);
  
      await schedule.save();
  
      // Emit socket event to notify connected clients
      const io = socket.getIO();
      io.to(deviceId.toString()).emit('updateSchedule', {
        schedule: schedule,
        device: device
      });
  
      res.status(200).json({
        success: true,
        message: "Schedule updated successfully",
        data: schedule,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

  //get schedule by id populate the device and advertisement
  exports.getScheduleById = async (req, res) => {
    try {
      const schedule = await Schedule.findById(req.params.id)
        .populate("deviceId", "name description")
        .populate("advertisementIds", "name description videoUrl orientation");
  
      if (!schedule) {
        return res.status(404).json({
          success: false,
          message: "Schedule not found",
        });
      }
  
      res.status(200).json({
        success: true,
        data: schedule,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };
  
  