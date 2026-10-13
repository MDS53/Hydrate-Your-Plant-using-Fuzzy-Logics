import { Router } from 'express';
import {
  register,
  login,
  getCurrentUser,
  updateProfile,
  forgotPassword,
  resetPassword,
  getSmtpConfigHandler,
  saveSmtpConfigHandler,
  sendTestEmailHandler,
} from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { loginRateLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.post('/register', register);
router.post('/login', loginRateLimiter, login);
router.get('/me', requireAuth, getCurrentUser);
router.put('/profile', requireAuth, updateProfile);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// SMTP configuration & diagnostics
router.get('/smtp-status', getSmtpConfigHandler);
router.post('/smtp-config', requireAuth, saveSmtpConfigHandler);
router.post('/test-email', requireAuth, sendTestEmailHandler);

export default router;
