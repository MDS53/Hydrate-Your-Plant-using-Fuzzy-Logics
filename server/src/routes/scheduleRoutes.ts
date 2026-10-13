import { Router } from 'express';
import {
  getPlantSchedules,
  generateSchedule,
  triggerDailyReEvaluation,
  triggerMorningReminders,
} from '../controllers/scheduleController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireAuth);

router.get('/plant/:plantId', getPlantSchedules);
router.post('/generate', generateSchedule);
router.post('/trigger-eval', triggerDailyReEvaluation);
router.post('/trigger-reminders', triggerMorningReminders);

export default router;
