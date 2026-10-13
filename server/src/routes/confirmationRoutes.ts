import { Router } from 'express';
import {
  getConfirmationDetails,
  submitConfirmation,
} from '../controllers/confirmationController.js';

const router = Router();

// Public routes (authenticated via scheduleId + magicToken)
router.get('/schedule/:scheduleId', getConfirmationDetails);
router.post('/submit', submitConfirmation);

export default router;
