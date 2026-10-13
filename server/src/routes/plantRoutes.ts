import { Router } from 'express';
import {
  getPlants,
  getPlantById,
  createPlant,
  updatePlant,
  deletePlant,
  previewPlantCare,
  waterPlantNow,
  sendPlantScheduleEmail,
} from '../controllers/plantController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireAuth);

router.get('/', getPlants);
router.post('/', createPlant);
router.post('/ai-preview', previewPlantCare);
router.get('/:id', getPlantById);
router.post('/:id/water-now', waterPlantNow);
router.post('/:id/send-schedule', sendPlantScheduleEmail);
router.put('/:id', updatePlant);
router.delete('/:id', deletePlant);

export default router;

