const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  createSchedule,
  getAllSchedules,
  getSchedulesByFilter,
  updateSchedule,
  deleteSchedule
} = require('../controllers/scheduleController');

const router = express.Router();

// Public routes
router.get('/', getAllSchedules);
router.get('/search', getSchedulesByFilter);

// Protected routes
router.post('/', protect, createSchedule);
router.put('/:id', protect, updateSchedule);
router.delete('/:id', protect, deleteSchedule);

module.exports = router;