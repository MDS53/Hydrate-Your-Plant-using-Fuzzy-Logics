import { Router } from 'express';
import {
  getPlantAnalytics,
  getOverallAnalytics,
} from '../controllers/analyticsController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireAuth);

router.get('/overall', getOverallAnalytics);
router.get('/plant/:plantId', getPlantAnalytics);

export default router;
