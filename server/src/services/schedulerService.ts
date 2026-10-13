import cron from 'node-cron';
import { Schedule, ISchedule } from '../models/Schedule.js';
import { Plant, IPlant } from '../models/Plant.js';
import { User, IUser } from '../models/User.js';
import { Caretaker } from '../models/Caretaker.js';
import { Snooze, ISnooze } from '../models/Snooze.js';
import { getWeatherForecast } from './weatherService.js';
import { evaluateFuzzyWatering } from '../fuzzy/engine.js';
import { sendWateringReminderEmail } from './emailService.js';

let isEvaluating = false;
let isProcessingSnoozes = false;

/**
 * Re-evaluate weather and fuzzy suggestion for today's scheduled plants
 */
export async function runDailyWeatherReEvaluation(): Promise<{ evaluatedCount: number }> {
  if (isEvaluating) return { evaluatedCount: 0 };
  isEvaluating = true;

  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

    const pendingSchedules = await Schedule.find({
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['pending', 'snoozed'] },
    }).populate<{ plantId: IPlant }>('plantId');

    console.log(`[Scheduler] Re-evaluating live weather for ${pendingSchedules.length} scheduled items today...`);

    let count = 0;
    for (const schedule of pendingSchedules) {
      const plant = schedule.plantId;
      if (!plant || !plant.location) continue;

      try {
        const { snapshot } = await getWeatherForecast(plant.location.lat, plant.location.lon);

        const fuzzyResult = evaluateFuzzyWatering({
          temp: snapshot.temp,
          humidity: snapshot.humidity,
          rainMm: snapshot.rainMm,
          environment: plant.environment,
          droughtTolerance: plant.careInfo.droughtTolerance,
          potMaterial: plant.pot.material,
          baseWaterMl: schedule.baseMl || plant.baseWaterMl,
        });

        schedule.suggestedMl = fuzzyResult.suggestedWaterMl;
        schedule.fuzzyFactor = fuzzyResult.finalFuzzyFactor;
        schedule.weatherSnapshot = snapshot;
        schedule.fuzzyTrace = {
          reason: fuzzyResult.reason,
          factor: fuzzyResult.finalFuzzyFactor,
          rulesFired: fuzzyResult.explanation.rulesTriggered.map((r) => r.description),
          memberships: fuzzyResult.explanation.memberships,
          crispInputs: {
            temp: snapshot.temp,
            humidity: snapshot.humidity,
            rainMm: snapshot.rainMm,
            environment: plant.environment,
            droughtTolerance: plant.careInfo.droughtTolerance,
            potMaterial: plant.pot.material,
          },
        };

        await schedule.save();
        count++;
      } catch (err) {
        console.error(`[Scheduler] Error evaluating schedule ${schedule._id}:`, err);
      }
    }

    console.log(`[Scheduler] Finished re-evaluating ${count} schedules with fresh weather.`);
    return { evaluatedCount: count };
  } finally {
    isEvaluating = false;
  }
}

/**
 * Precision minute-level reminder dispatcher:
 * Checks every minute if any pending schedule has reached or passed its selected watering time today,
 * and sends emails to both the user (owner) and their added friends/caretakers.
 */
export async function dispatchDueReminders(): Promise<{ sentCount: number }> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Find pending schedules where date <= now, within today, and reminder not yet sent
  const dueSchedules = await Schedule.find({
    date: { $gte: startOfDay, $lte: now },
    status: 'pending',
    lastReminderSentAt: { $exists: false },
  }).populate<{ plantId: IPlant }>('plantId');

  if (dueSchedules.length === 0) return { sentCount: 0 };

  console.log(`[Scheduler] ⏰ Dispatching due reminders for ${dueSchedules.length} schedules at current time (${now.toLocaleTimeString()})...`);

  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  let sent = 0;

  for (const schedule of dueSchedules) {
    const plant = schedule.plantId;
    if (!plant) continue;

    const weatherSnapshot = schedule.weatherSnapshot;
    const weatherReason = schedule.fuzzyTrace?.reason || 'Standard scheduled watering time';
    const weatherBadge = {
      temp: weatherSnapshot ? `${weatherSnapshot.temp}°C` : '20°C',
      humidity: weatherSnapshot ? `${weatherSnapshot.humidity}%` : '50%',
      rain: weatherSnapshot ? `${weatherSnapshot.rainMm} mm` : '0 mm',
      emoji: schedule.fuzzyFactor < 0.6 ? '❄️' : schedule.fuzzyFactor > 1.15 ? '☀️' : '🌿',
    };

    // Construct magic action URL & website dashboard URL
    const actionUrl = `${appUrl}/confirm?scheduleId=${schedule._id}&token=${schedule.magicToken || ''}`;
    const websiteUrl = `${appUrl}/plant/${plant._id}`;

    // Collect recipient emails: plant owner + all added friends/caretakers
    const owner = await User.findById(plant.userId);
    const caretakers = await Caretaker.find({ plantId: plant._id });

    const recipientMap = new Map<string, string>();
    if (owner?.email) {
      recipientMap.set(owner.email.toLowerCase(), owner.name || 'Plant Owner');
    }
    if (schedule.assignedTo?.email) {
      recipientMap.set(schedule.assignedTo.email.toLowerCase(), schedule.assignedTo.name);
    }
    for (const ct of caretakers) {
      if (ct.email) {
        recipientMap.set(ct.email.toLowerCase(), ct.name);
      }
    }

    const wateringTimeStr =
      plant.wateringTime ||
      (schedule.date
        ? schedule.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '08:00');

    for (const [email, name] of recipientMap.entries()) {
      try {
        await sendWateringReminderEmail({
          recipientEmail: email,
          recipientName: name,
          plantName: plant.name,
          plantEmoji: plant.emoji || '🌿',
          plantId: plant._id.toString(),
          scheduleId: schedule._id.toString(),
          wateringTime: wateringTimeStr,
          suggestedMl: schedule.suggestedMl,
          baseMl: schedule.baseMl,
          weatherReason,
          weatherBadge,
          actionUrl,
          websiteUrl,
        });
        sent++;
      } catch (err) {
        console.error(`[Scheduler] Error sending reminder to ${email}:`, err);
      }
    }

    schedule.lastReminderSentAt = new Date();
    await schedule.save();
  }

  return { sentCount: sent };
}

/**
 * Dispatch reminders for all pending schedules of today (used for manual triggers & morning catch-up)
 */
export async function dispatchMorningReminders(): Promise<{ sentCount: number }> {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

  const pendingSchedules = await Schedule.find({
    date: { $gte: startOfDay, $lte: endOfDay },
    status: 'pending',
    lastReminderSentAt: { $exists: false },
  }).populate<{ plantId: IPlant }>('plantId');

  console.log(`[Scheduler] Dispatching reminders for ${pendingSchedules.length} pending events...`);

  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  let sent = 0;

  for (const schedule of pendingSchedules) {
    const plant = schedule.plantId;
    if (!plant) continue;

    const weatherSnapshot = schedule.weatherSnapshot;
    const weatherReason = schedule.fuzzyTrace?.reason || 'Standard watering day';
    const weatherBadge = {
      temp: weatherSnapshot ? `${weatherSnapshot.temp}°C` : '20°C',
      humidity: weatherSnapshot ? `${weatherSnapshot.humidity}%` : '50%',
      rain: weatherSnapshot ? `${weatherSnapshot.rainMm} mm` : '0 mm',
      emoji: schedule.fuzzyFactor < 0.6 ? '❄️' : schedule.fuzzyFactor > 1.15 ? '☀️' : '🌿',
    };

    const actionUrl = `${appUrl}/confirm?scheduleId=${schedule._id}&token=${schedule.magicToken || ''}`;
    const websiteUrl = `${appUrl}/plant/${plant._id}`;

    const owner = await User.findById(plant.userId);
    const caretakers = await Caretaker.find({ plantId: plant._id });

    const recipientMap = new Map<string, string>();
    if (owner?.email) {
      recipientMap.set(owner.email.toLowerCase(), owner.name || 'Plant Owner');
    }
    if (schedule.assignedTo?.email) {
      recipientMap.set(schedule.assignedTo.email.toLowerCase(), schedule.assignedTo.name);
    }
    for (const ct of caretakers) {
      if (ct.email) {
        recipientMap.set(ct.email.toLowerCase(), ct.name);
      }
    }

    const wateringTimeStr =
      plant.wateringTime ||
      (schedule.date
        ? schedule.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '08:00');

    for (const [email, name] of recipientMap.entries()) {
      try {
        await sendWateringReminderEmail({
          recipientEmail: email,
          recipientName: name,
          plantName: plant.name,
          plantEmoji: plant.emoji || '🌿',
          plantId: plant._id.toString(),
          scheduleId: schedule._id.toString(),
          wateringTime: wateringTimeStr,
          suggestedMl: schedule.suggestedMl,
          baseMl: schedule.baseMl,
          weatherReason,
          weatherBadge,
          actionUrl,
          websiteUrl,
        });
        sent++;
      } catch (err) {
        console.error(`[Scheduler] Error sending reminder email to ${email}:`, err);
      }
    }

    schedule.lastReminderSentAt = new Date();
    await schedule.save();
  }

  return { sentCount: sent };
}

/**
 * Process active snoozes
 */
export async function processActiveSnoozes(): Promise<{ processedCount: number }> {
  if (isProcessingSnoozes) return { processedCount: 0 };
  isProcessingSnoozes = true;

  try {
    const now = new Date();
    const activeSnoozes = await Snooze.find({
      status: 'active',
      snoozeUntil: { $lte: now },
    });

    let count = 0;
    const appUrl = process.env.APP_URL || 'http://localhost:5173';

    for (const snooze of activeSnoozes) {
      const schedule = await Schedule.findById(snooze.scheduleId).populate<{ plantId: IPlant }>('plantId');
      if (!schedule || schedule.status === 'completed') {
        snooze.status = 'cancelled';
        await snooze.save();
        continue;
      }

      const plant = schedule.plantId;
      if (!plant) continue;

      const actionUrl = `${appUrl}/confirm?scheduleId=${schedule._id}&token=${schedule.magicToken || ''}`;
      const websiteUrl = `${appUrl}/plant/${plant._id}`;

      await sendWateringReminderEmail({
        recipientEmail: snooze.email,
        recipientName: snooze.personName,
        plantName: plant.name,
        plantEmoji: plant.emoji || '🌿',
        plantId: plant._id.toString(),
        scheduleId: schedule._id.toString(),
        wateringTime: plant.wateringTime || 'Snooze alert',
        suggestedMl: schedule.suggestedMl,
        baseMl: schedule.baseMl,
        weatherReason: `Snooze reminder: ${schedule.fuzzyTrace?.reason || 'Ready for watering'}`,
        weatherBadge: {
          temp: schedule.weatherSnapshot ? `${schedule.weatherSnapshot.temp}°C` : '20°C',
          humidity: schedule.weatherSnapshot ? `${schedule.weatherSnapshot.humidity}%` : '50%',
          rain: schedule.weatherSnapshot ? `${schedule.weatherSnapshot.rainMm} mm` : '0 mm',
          emoji: '⏰',
        },
        actionUrl,
        websiteUrl,
      });

      snooze.status = 'fired';
      await snooze.save();
      count++;
    }

    return { processedCount: count };
  } finally {
    isProcessingSnoozes = false;
  }
}

/**
 * Initialize all automated cron schedules
 */
export function startCronScheduler(): void {
  const cronTime = process.env.SCHEDULER_CRON || '0 8 * * *'; // 8:00 AM daily
  console.log(`[Scheduler] Initializing morning weather re-evaluation cron with: "${cronTime}"`);

  // Daily morning weather re-evaluation
  cron.schedule(cronTime, async () => {
    console.log('[Scheduler] Running daily morning weather re-evaluation job...');
    await runDailyWeatherReEvaluation();
  });

  // Precision minute cron: checks every minute for schedules reaching user-selected watering time!
  cron.schedule('* * * * *', async () => {
    await dispatchDueReminders();
  });

  // Check snoozes every 2 minutes
  cron.schedule('*/2 * * * *', async () => {
    await processActiveSnoozes();
  });

  console.log('[Scheduler] Background jobs successfully scheduled (including minute-by-minute reminder dispatcher).');
}
