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

// IMPORTANT: literal/specific routes MUST be declared before the '/:id' param route.
// Otherwise GET /archives matches '/:id' (id='archives') and 500s on an invalid ObjectId.
router.get('/filter', getSchedulesByFilter);  // Changed from /search to /filter
router.get('/archives', protect, getArchivedSchedules);
router.put('/archives/:id', protect, archiveSchedule);
router.delete('/deleteById/:id', protect, deleteScheduleById);

// Parameter routes
router.get('/:id/:userId', protect, getScheduleById);
router.get('/:id', protect, getAllSchedules);
router.post('/', protect, createSchedule);
router.put('/:id', protect, updateSchedule);
router.delete('/:id', protect, deleteSchedule);

module.exports = router;
