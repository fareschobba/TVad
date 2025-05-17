const express = require('express');
const { 
    getAllSchedules, 
    getSchedulesByFilter, 
    createSchedule, 
    updateSchedule, 
    getScheduleById, 
    deleteSchedule,
    archiveSchedule,
    getArchivedSchedules,
    deleteScheduleById
} = require('../controllers/scheduleController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Important: Put specific routes BEFORE parameter routes
router.get('/filter',  getSchedulesByFilter);  // Changed from /search to /filter

// Then put the parameter routes
router.get('/:id', getAllSchedules);
router.post('/', protect, createSchedule);
router.put('/:id', protect, updateSchedule);
router.get('/:id/:userId', protect, getScheduleById);
router.delete('/:id', protect, deleteSchedule);
router.put('/archives/:id', protect, archiveSchedule);
router.get('/archives', protect, getArchivedSchedules);
router.delete('/deleteById/:id', protect, deleteScheduleById);

module.exports = router;
