const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  createSchedule,
  getAllSchedules,
  getSchedulesByFilter,
  updateSchedule,
  deleteSchedule,
  archiveSchedule,
  getArchivedSchedules,
  getScheduleById,
  deleteScheduleById
} = require('../controllers/scheduleController');

const router = express.Router();

// Public routes
router.get('/', getAllSchedules);
router.get('/search', getSchedulesByFilter);

// Protected routes
router.post('/', protect, createSchedule);
router.put('/:id', protect, updateSchedule);
router.get('/:id', protect, getScheduleById);
router.delete('/:id', protect, deleteSchedule);
router.put('/archives/:id',protect,archiveSchedule);
router.get('/archives',protect,getArchivedSchedules);
router.delete('/deleteById/:id', protect, deleteScheduleById);

module.exports = router;