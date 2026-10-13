import { Request, Response } from 'express';
import { z } from 'zod';
import { Schedule, ISchedule } from '../models/Schedule.js';
import { Plant, IPlant } from '../models/Plant.js';
import { WaterLog } from '../models/WaterLog.js';
import { Snooze } from '../models/Snooze.js';
import { Caretaker } from '../models/Caretaker.js';
import { User } from '../models/User.js';
import { sendWateringConfirmationNotification } from '../services/emailService.js';
import { checkAndAwardAchievements } from '../services/analyticsService.js';

const submitConfirmationSchema = z.object({
  scheduleId: z.string().min(1),
  token: z.string().optional(),
  choice: z.enum(['yes', 'no', 'snooze']),
  personName: z.string().min(1, 'Person name is required'),
  amountPouredMl: z.number().optional(),
  reason: z.string().optional(),
  snoozeMinutes: z.number().min(5).max(1440).optional(), // 5 min to 24h
});

/**
 * GET schedule details for confirmation page (publicly accessible with valid scheduleId and token, or authenticated)
 */
export async function getConfirmationDetails(req: Request, res: Response): Promise<void> {
  try {
    const { scheduleId } = req.params;
    const token = req.query.token as string | undefined;

    const schedule = await Schedule.findById(scheduleId).populate<{ plantId: IPlant }>('plantId');
    if (!schedule) {
      res.status(404).json({ error: 'Watering schedule item not found.' });
      return;
    }

    const plant = schedule.plantId;
    if (!plant) {
      res.status(404).json({ error: 'Plant associated with this schedule not found.' });
      return;
    }

    // Check existing water log for idempotency
    const existingLog = await WaterLog.findOne({ scheduleId: schedule._id });

    // Active snooze count
    const snoozes = await Snooze.find({ scheduleId: schedule._id });
    const snoozeCount = snoozes.length;

    res.json({
      schedule: {
        id: schedule._id,
        date: schedule.date,
        status: schedule.status,
        baseMl: schedule.baseMl,
        suggestedMl: schedule.suggestedMl,
        fuzzyFactor: schedule.fuzzyFactor,
        fuzzyTrace: schedule.fuzzyTrace,
        weatherSnapshot: schedule.weatherSnapshot,
        assignedTo: schedule.assignedTo,
        isCompleted: schedule.status === 'completed',
        isMissed: schedule.status === 'missed',
      },
      plant: {
        id: plant._id,
        name: plant.name,
        emoji: plant.emoji,
        pot: plant.pot,
        location: plant.location,
        environment: plant.environment,
      },
      existingLog,
      snoozeCount,
      snoozeAllowed: snoozeCount < 3 && schedule.status !== 'completed',
    });
  } catch (err) {
    console.error('[ConfirmationController] getConfirmationDetails error:', err);
    res.status(500).json({ error: 'Error loading confirmation page details.' });
  }
}

/**
 * SUBMIT confirmation: Yes / No / Snooze
 */
export async function submitConfirmation(req: Request, res: Response): Promise<void> {
  try {
    const validated = submitConfirmationSchema.parse(req.body);

    const schedule = await Schedule.findById(validated.scheduleId).populate<{ plantId: IPlant }>('plantId');
    if (!schedule) {
      res.status(404).json({ error: 'Schedule item not found' });
      return;
    }

    const plant = schedule.plantId;
    if (!plant) {
      res.status(404).json({ error: 'Plant not found' });
      return;
    }

    // Idempotency check: if already completed, return existing confirmation
    if (schedule.status === 'completed' && validated.choice === 'yes') {
      const existingLog = await WaterLog.findOne({ scheduleId: schedule._id });
      res.json({
        message: 'This watering session was already confirmed!',
        alreadyCompleted: true,
        log: existingLog,
      });
      return;
    }

    // Gather recipients for broadcast (owner + caretakers)
    const owner = await User.findById(plant.userId);
    const caretakers = await Caretaker.find({ plantId: plant._id });

    const broadcastRecipients: { email: string; name: string }[] = [];
    if (owner) {
      broadcastRecipients.push({ email: owner.email, name: owner.name });
    }
    for (const ct of caretakers) {
      broadcastRecipients.push({ email: ct.email, name: ct.name });
    }

    if (validated.choice === 'yes') {
      const amountPoured = validated.amountPouredMl || schedule.suggestedMl;

      // Create watering log
      const log = await WaterLog.create({
        plantId: plant._id,
        userId: plant.userId,
        scheduleId: schedule._id,
        personName: validated.personName.trim(),
        status: 'poured',
        amountMl: amountPoured,
        baseAmountMl: schedule.baseMl,
        suggestedAmountMl: schedule.suggestedMl,
        pouredAt: new Date(),
        notes: validated.reason,
        weatherSnapshot: schedule.weatherSnapshot,
        fuzzyFactor: schedule.fuzzyFactor,
      });

      // Update schedule status
      schedule.status = 'completed';
      await schedule.save();

      // Cancel any active snoozes
      await Snooze.updateMany({ scheduleId: schedule._id, status: 'active' }, { status: 'cancelled' });

      // Check and award achievements
      const badgesAwarded = await checkAndAwardAchievements(
        plant._id,
        plant.userId,
        validated.personName.trim(),
        log
      );

      const appUrl = process.env.APP_URL || 'http://localhost:5173';
      // Send confirmation broadcast email
      await sendWateringConfirmationNotification({
        recipients: broadcastRecipients,
        pouredBy: validated.personName.trim(),
        plantName: plant.name,
        plantEmoji: plant.emoji,
        plantId: plant._id.toString(),
        amountMl: amountPoured,
        status: 'poured',
        pouredAt: new Date(),
        websiteUrl: `${appUrl}/plant/${plant._id}`,
      });

      res.json({
        message: 'Watering confirmed successfully! Plant health score refreshed.',
        status: 'completed',
        log,
        badgesAwarded,
      });
    } else if (validated.choice === 'no') {
      // Mark as missed
      schedule.status = 'missed';
      await schedule.save();

      const log = await WaterLog.create({
        plantId: plant._id,
        userId: plant.userId,
        scheduleId: schedule._id,
        personName: validated.personName.trim(),
        status: 'missed',
        amountMl: 0,
        baseAmountMl: schedule.baseMl,
        suggestedAmountMl: schedule.suggestedMl,
        pouredAt: new Date(),
        notes: validated.reason || 'Reported not watered',
        weatherSnapshot: schedule.weatherSnapshot,
        fuzzyFactor: schedule.fuzzyFactor,
      });

      const appUrl = process.env.APP_URL || 'http://localhost:5173';
      // Notify owner and escalate to backup
      await sendWateringConfirmationNotification({
        recipients: broadcastRecipients,
        pouredBy: validated.personName.trim(),
        plantName: plant.name,
        plantEmoji: plant.emoji,
        plantId: plant._id.toString(),
        amountMl: 0,
        status: 'missed',
        reason: validated.reason || 'Watering was marked as missed',
        pouredAt: new Date(),
        websiteUrl: `${appUrl}/plant/${plant._id}`,
      });

      res.json({
        message: 'Watering marked as missed. Care team has been notified for backup.',
        status: 'missed',
        log,
      });
    } else if (validated.choice === 'snooze') {
      const existingSnoozeCount = await Snooze.countDocuments({ scheduleId: schedule._id });
      if (existingSnoozeCount >= 3) {
        res.status(400).json({ error: 'Maximum snooze limit (3) reached for this watering session.' });
        return;
      }

      const snoozeMinutes = validated.snoozeMinutes || 30;
      const snoozeUntil = new Date(Date.now() + snoozeMinutes * 60 * 1000);

      const snooze = await Snooze.create({
        plantId: plant._id,
        scheduleId: schedule._id,
        personName: validated.personName.trim(),
        email: schedule.assignedTo.email,
        snoozeUntil,
        snoozeMinutes,
        count: existingSnoozeCount + 1,
        status: 'active',
      });

      schedule.status = 'snoozed';
      await schedule.save();

      res.json({
        message: `Reminder snoozed for ${snoozeMinutes} minutes (until ${snoozeUntil.toLocaleTimeString()}).`,
        status: 'snoozed',
        snooze,
      });
    }
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.issues.map((e) => e.message).join(', ') });
      return;
    }
    console.error('[ConfirmationController] submitConfirmation error:', err);
    res.status(500).json({ error: 'Error submitting watering confirmation.' });
  }
}
