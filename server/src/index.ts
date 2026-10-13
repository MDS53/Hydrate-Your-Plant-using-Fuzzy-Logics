import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { sanitizeInputs } from './middleware/sanitize.js';
import { connectDB } from './config/db.js';
import { apiGeneralLimiter } from './middleware/rateLimit.js';
import { startCronScheduler } from './services/schedulerService.js';

import authRoutes from './routes/authRoutes.js';
import plantRoutes from './routes/plantRoutes.js';
import scheduleRoutes from './routes/scheduleRoutes.js';
import confirmationRoutes from './routes/confirmationRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import weatherRoutes from './routes/weatherRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Global middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Security: Prevent NoSQL query injection
app.use(sanitizeInputs);

// General rate limiter
app.use('/api', apiGeneralLimiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/plants', plantRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/confirm', confirmationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/weather', weatherRoutes);

import { User } from './models/User.js';
import { seedDatabase } from './scripts/seed.js';

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'Plant Care Companion API',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Seed endpoint
app.post('/api/seed', async (_req, res) => {
  try {
    await seedDatabase(false);
    res.json({ message: 'Database successfully seeded with demo user and sample plants.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Seeding failed' });
  }
});

// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[App Error]', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

async function startServer() {
  try {
    await connectDB();

    // Auto-seed if database has no users
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('[Seed] Database is currently empty. Auto-seeding sample plants and demo accounts...');
      await seedDatabase(false);
    }

    startCronScheduler();

    app.listen(PORT, () => {
      console.log(`🌿 Plant Care Companion server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
