import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/authMiddleware.js';
import { Plant, IPlant } from '../models/Plant.js';
import { Schedule, IWeatherSnapshot } from '../models/Schedule.js';
import { WaterLog } from '../models/WaterLog.js';
import { Caretaker } from '../models/Caretaker.js';
import { Snooze } from '../models/Snooze.js';
import { User } from '../models/User.js';
import { generatePlantCareInfo, calculateBaseWaterMl } from '../services/aiService.js';
import { getWeatherForecast } from '../services/weatherService.js';
import { evaluateFuzzyWatering } from '../fuzzy/engine.js';
import { calculateHealthScore, checkAndAwardAchievements } from '../services/analyticsService.js';
import { sendScheduleNotificationEmail, sendWateringConfirmationNotification } from '../services/emailService.js';
import { dispatchDueReminders } from '../services/schedulerService.js';
import crypto from 'crypto';

const createPlantSchema = z.object({
  name: z.string().min(1, 'Plant name is required').max(100),
  emoji: z.string().optional().default('🌿'),
  photoUrl: z.string().optional(),
  location: z.object({
    city: z.string().min(1, 'City is required'),
    lat: z.number(),
    lon: z.number(),
    country: z.string().optional(),
  }),
  environment: z.enum(['indoor', 'balcony', 'outdoor']).default('indoor'),
  pot: z.object({
    volumeL: z.number().min(0.1, 'Pot volume must be at least 0.1 L'),
    diameterCm: z.number().optional(),
    heightCm: z.number().optional(),
    material: z.enum(['plastic', 'terracotta', 'ceramic']).default('plastic'),
    drainage: z.boolean().default(true),
  }),
  careInfo: z.object({
    shortDescription: z.string(),
    idealTempMin: z.number(),
    idealTempMax: z.number(),
    criticalMinTemp: z.number(),
    criticalMaxTemp: z.number(),
    light: z.string(),
    humidity: z.string(),
    soilType: z.string(),
    wateringNeeds: z.string(),
    waterMlPerPotLitre: z.number(),
    waterTypicalRange: z.string().optional(),
    recommendedFrequencyPerWeek: z.number(),
    droughtTolerance: z.enum(['low', 'medium', 'high']),
    overwateringSensitivity: z.enum(['low', 'medium', 'high']),
    commonProblems: z.array(z.string()).optional().default([]),
    tips: z.array(z.string()).optional().default([]),
  }),
  pourDaysOfWeek: z.array(z.number().min(0).max(6)).min(1, 'Select at least one day per week'),
  wateringTime: z.string().optional().default('08:00'),
  firstWateringDate: z.string().optional(),
  caretakers: z.array(z.object({
    name: z.string().min(1),
    email: z.string().email(),
  })).optional().default([]),
});

/**
 * AI preview endpoint: generates botanical data before saving
 */
export async function previewPlantCare(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'Plant name is required' });
      return;
    }

    const careInfo = await generatePlantCareInfo(name);
    res.json({ careInfo });
  } catch (err) {
    console.error('[PlantController] AI preview error:', err);
    res.status(500).json({ error: 'Failed to generate plant care preview.' });
  }
}

/**
 * GET all plants for user (card view data with today's suggestion & health)
 */
export async function getPlants(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const plants = await Plant.find({ userId, archived: false }).sort({ createdAt: -1 });

    const plantSummaries = await Promise.all(
      plants.map(async (plant) => {
        // Fetch next upcoming schedule
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const nextSchedule = await Schedule.findOne({
          plantId: plant._id,
          date: { $gte: startOfToday },
          status: { $in: ['pending', 'snoozed'] },
        }).sort({ date: 1 });

        // Fetch recent logs for health score
        const logs = await WaterLog.find({ plantId: plant._id }).sort({ pouredAt: -1 }).limit(10);
        const schedules = await Schedule.find({ plantId: plant._id }).sort({ date: -1 }).limit(10);
        const health = calculateHealthScore(logs, schedules);

        // Check if plant was watered today
        const wateredTodayLog = await WaterLog.findOne({
          plantId: plant._id,
          pouredAt: { $gte: startOfToday },
          status: 'poured',
        }).sort({ pouredAt: -1 });
        const isWateredToday = Boolean(wateredTodayLog);

        let canWaterNow = false;
        if (nextSchedule && !isWateredToday) {
          const schDate = new Date(nextSchedule.date);
          canWaterNow = schDate <= now || schDate.toDateString() === now.toDateString();
        }

        // Calculate live today suggestion if weather is accessible
        let todaySuggestion: any = {
          suggestedMl: plant.baseWaterMl,
          baseMl: plant.baseWaterMl,
          reason: 'Standard base watering',
          fuzzyFactor: 1.0,
          badge: { temp: '20°C', humidity: '50%', rain: '0 mm', emoji: '🌿' },
          shouldSkipOrMinimal: false,
        };

        if (nextSchedule && nextSchedule.weatherSnapshot) {
          todaySuggestion = {
            suggestedMl: nextSchedule.suggestedMl,
            baseMl: nextSchedule.baseMl,
            reason: nextSchedule.fuzzyTrace?.reason || 'Standard watering',
            fuzzyFactor: nextSchedule.fuzzyFactor,
            badge: {
              temp: `${nextSchedule.weatherSnapshot.temp}°C`,
              humidity: `${nextSchedule.weatherSnapshot.humidity}%`,
              rain: `${nextSchedule.weatherSnapshot.rainMm} mm`,
              emoji: nextSchedule.fuzzyFactor < 0.6 ? '❄️' : nextSchedule.fuzzyFactor > 1.15 ? '☀️' : '🌿',
            },
            shouldSkipOrMinimal: nextSchedule.fuzzyFactor < 0.4,
            weatherSnapshot: nextSchedule.weatherSnapshot,
          };
        } else if (plant.location) {
          try {
            const { snapshot } = await getWeatherForecast(plant.location.lat, plant.location.lon);
            const fuzzy = evaluateFuzzyWatering({
              temp: snapshot.temp,
              humidity: snapshot.humidity,
              rainMm: snapshot.rainMm,
              environment: plant.environment,
              droughtTolerance: plant.careInfo.droughtTolerance,
              potMaterial: plant.pot.material,
              baseWaterMl: plant.baseWaterMl,
            });
            todaySuggestion = {
              suggestedMl: fuzzy.suggestedWaterMl,
              baseMl: fuzzy.baseWaterMl,
              reason: fuzzy.reason,
              fuzzyFactor: fuzzy.finalFuzzyFactor,
              badge: fuzzy.badge,
              shouldSkipOrMinimal: fuzzy.shouldSkipOrMinimal,
              weatherSnapshot: snapshot,
            };
          } catch (e) {
            // fallback
          }
        }

        // Add verbal suggestion & crisp bracket text
        const baseMl = todaySuggestion.baseMl || plant.baseWaterMl || 300;
        const suggestedMl = todaySuggestion.suggestedMl || baseMl;
        const diffMl = suggestedMl - baseMl;
        let verbalWord = '';
        if (diffMl < -75) verbalWord = 'Drastically reduce water (minimal pour)';
        else if (diffMl < -25) verbalWord = 'Reduce it moderately';
        else if (diffMl < -5) verbalWord = 'Reduce it slightly';
        else if (diffMl <= 5) verbalWord = 'Maintain standard hydration';
        else if (diffMl <= 25) verbalWord = 'Increase it slightly';
        else if (diffMl <= 75) verbalWord = 'Increase it moderately';
        else verbalWord = 'Substantially increase water';

        let crispBracket = '';
        if (diffMl < 0) {
          crispBracket = `[Reduce by ${Math.abs(diffMl)} ml, Crisp target: ${suggestedMl} ml]`;
        } else if (diffMl > 0) {
          crispBracket = `[Increase by ${diffMl} ml, Crisp target: ${suggestedMl} ml]`;
        } else {
          crispBracket = `[Standard pour, Crisp target: ${suggestedMl} ml]`;
        }

        todaySuggestion.verbalSuggestion = verbalWord;
        todaySuggestion.crispBracketText = crispBracket;
        todaySuggestion.crispDeltaMl = diffMl;

        return {
          id: plant._id,
          name: plant.name,
          emoji: plant.emoji,
          photoUrl: plant.photoUrl,
          pot: plant.pot,
          location: plant.location,
          environment: plant.environment,
          baseWaterMl: plant.baseWaterMl,
          nextWateringDate: nextSchedule ? nextSchedule.date : null,
          todaySuggestion,
          health,
          pourDaysOfWeek: plant.pourDaysOfWeek,
          wateringTime: plant.wateringTime || '08:00',
          isWateredToday,
          canWaterNow,
          lastWateredAt: logs[0] ? logs[0].pouredAt : undefined,
        };
      })
    );

    res.json({ plants: plantSummaries });
  } catch (err) {
    console.error('[PlantController] getPlants error:', err);
    res.status(500).json({ error: 'Server error fetching plants.' });
  }
}

/**
 * GET single plant details
 */
export async function getPlantById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    let plant = await Plant.findOne({ _id: id, userId: req.userId! });
    if (!plant) {
      plant = await Plant.findById(id);
    }

    if (!plant) {
      res.status(404).json({ error: 'Plant not found' });
      return;
    }

    const caretakers = await Caretaker.find({ plantId: plant._id });

    // Upcoming schedules (pending or snoozed ONLY)
    let upcomingSchedules = await Schedule.find({
      plantId: plant._id,
      status: { $in: ['pending', 'snoozed'] },
    }).sort({ date: 1 }).limit(14);

    // Auto-reconcile existing schedules with plant's preferred watering time
    if (plant.wateringTime && upcomingSchedules.length > 0) {
      const [tH, tM] = plant.wateringTime.split(':').map(Number);
      const safeTH = Number.isFinite(tH) ? tH : 8;
      const safeTM = Number.isFinite(tM) ? tM : 0;
      for (const sch of upcomingSchedules) {
        const d = new Date(sch.date);
        if (d.getHours() !== safeTH || d.getMinutes() !== safeTM) {
          d.setHours(safeTH, safeTM, 0, 0);
          sch.date = d;
          await sch.save();
        }
      }
    }

    // If no upcoming schedule exists, auto-generate the next one
    if (upcomingSchedules.length === 0) {
      const pourDays = plant.pourDaysOfWeek && plant.pourDaysOfWeek.length > 0 ? plant.pourDaysOfWeek : [1];
      const [fH, fM] = (plant.wateringTime || '08:00').split(':').map(Number);
      const safeFH = Number.isFinite(fH) ? fH : 8;
      const safeFM = Number.isFinite(fM) ? fM : 0;
      const now = new Date();
      for (let d = 1; d <= 14; d++) {
        const cand = new Date(now);
        cand.setDate(cand.getDate() + d);
        cand.setHours(safeFH, safeFM, 0, 0);
        const dayIdx = cand.getDay();
        if (pourDays.includes(dayIdx)) {
          const newSch = await Schedule.create({
            plantId: plant._id,
            userId: plant.userId,
            date: cand,
            assignedTo: {
              role: 'owner',
              name: req.user?.name || 'Owner',
              email: req.user?.email || '',
            },
            baseMl: plant.baseWaterMl,
            suggestedMl: plant.baseWaterMl,
            fuzzyFactor: 1.0,
            status: 'pending',
          });
          upcomingSchedules = [newSch];
          break;
        }
      }
    }

    // Completed schedules (status == 'completed' ONLY)
    const completedSchedules = await Schedule.find({
      plantId: plant._id,
      status: 'completed',
    }).sort({ updatedAt: -1, date: -1 }).limit(20);

    const logs = await WaterLog.find({ plantId: plant._id }).sort({ pouredAt: -1 }).limit(10);
    const health = calculateHealthScore(logs, [...upcomingSchedules, ...completedSchedules]);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const wateredTodayLog = await WaterLog.findOne({
      plantId: plant._id,
      pouredAt: { $gte: todayStart },
      status: 'poured',
    }).sort({ pouredAt: -1 });

    const isWateredToday = Boolean(wateredTodayLog);

    let canWaterNow = false;
    if (upcomingSchedules.length > 0 && !isWateredToday) {
      const schDate = new Date(upcomingSchedules[0].date);
      const now = new Date();
      canWaterNow = schDate <= now || schDate.toDateString() === now.toDateString();
    }

    // Auto-trigger reminder dispatch if watering is due right now and reminder hasn't been sent yet
    if (canWaterNow && upcomingSchedules[0]?.status === 'pending' && !upcomingSchedules[0]?.lastReminderSentAt && new Date(upcomingSchedules[0].date) <= new Date()) {
      dispatchDueReminders().catch((e) => console.warn('[PlantDetail] auto-dispatch due reminder error:', e));
    }

    res.json({
      plant,
      caretakers,
      upcomingSchedules,
      completedSchedules,
      recentLogs: logs,
      health,
      isWateredToday,
      canWaterNow,
    });
  } catch (err) {
    console.error('[PlantController] getPlantById error:', err);
    res.status(500).json({ error: 'Error fetching plant details' });
  }
}

/**
 * CREATE plant profile
 */
export async function createPlant(req: AuthRequest, res: Response): Promise<void> {
  try {
    const validated = createPlantSchema.parse(req.body);
    const userId = req.user!._id;

    // Calculate base water amount
    const baseWaterMl = calculateBaseWaterMl(
      validated.careInfo.waterMlPerPotLitre,
      validated.pot.volumeL,
      validated.pot.material,
      validated.pot.drainage
    );

    const plant = await Plant.create({
      userId,
      name: validated.name,
      emoji: validated.emoji || '🌿',
      photoUrl: validated.photoUrl,
      location: validated.location,
      environment: validated.environment,
      pot: validated.pot,
      careInfo: validated.careInfo,
      baseWaterMl,
      pourDaysOfWeek: validated.pourDaysOfWeek,
      wateringTime: validated.wateringTime || '08:00',
    });

    // Save caretakers if provided
    const createdCaretakers = [];
    if (validated.caretakers && validated.caretakers.length > 0) {
      for (const ct of validated.caretakers) {
        const token = crypto.randomBytes(20).toString('hex');
        const caretakerDoc = await Caretaker.create({
          plantId: plant._id,
          name: ct.name.trim(),
          email: ct.email.toLowerCase().trim(),
          invitedBy: userId,
          magicTokenHash: token,
          tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        });
        createdCaretakers.push(caretakerDoc);
      }
    }

    // Generate initial schedules for next 2 weeks
    const today = new Date();
    const assignedDates: string[] = [];
    let caretakerIndex = 0;

    const [wHourStr, wMinStr] = (validated.wateringTime || '08:00').split(':');
    const parsedWH = parseInt(wHourStr, 10);
    const wateringHour = Number.isFinite(parsedWH) ? parsedWH : 8;
    const parsedWM = parseInt(wMinStr, 10);
    const wateringMin = Number.isFinite(parsedWM) ? parsedWM : 0;

    // Check weather forecast for initial suggestion
    let initialWeather;
    try {
      const { snapshot } = await getWeatherForecast(validated.location.lat, validated.location.lon);
      initialWeather = snapshot;
    } catch (e) {
      // fallback
    }

    for (let i = 0; i < 14; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + i);
      targetDate.setHours(wateringHour, wateringMin, 0, 0);
      const dayOfWeek = targetDate.getDay();

      if (validated.pourDaysOfWeek.includes(dayOfWeek)) {
        // Rotate assignment between owner and caretakers
        let assignedTo;
        if (createdCaretakers.length === 0 || caretakerIndex % (createdCaretakers.length + 1) === 0) {
          assignedTo = {
            role: 'owner' as const,
            name: req.user!.name,
            email: req.user!.email,
          };
        } else {
          const ct = createdCaretakers[(caretakerIndex - 1) % createdCaretakers.length];
          assignedTo = {
            role: 'caretaker' as const,
            name: ct.name,
            email: ct.email,
            caretakerId: ct._id,
          };
        }
        caretakerIndex++;

        // Fuzzy calculation
        let fuzzyFactor = 1.0;
        let suggestedMl = baseWaterMl;
        let fuzzyTrace = undefined;

        if (initialWeather) {
          const fuzzyRes = evaluateFuzzyWatering({
            temp: initialWeather.temp,
            humidity: initialWeather.humidity,
            rainMm: initialWeather.rainMm,
            environment: validated.environment,
            droughtTolerance: validated.careInfo.droughtTolerance,
            potMaterial: validated.pot.material,
            baseWaterMl,
          });
          fuzzyFactor = fuzzyRes.finalFuzzyFactor;
          suggestedMl = fuzzyRes.suggestedWaterMl;
          fuzzyTrace = {
            reason: fuzzyRes.reason,
            factor: fuzzyFactor,
            rulesFired: fuzzyRes.explanation.rulesTriggered.map((r) => r.description),
            memberships: fuzzyRes.explanation.memberships,
            crispInputs: {
              temp: initialWeather.temp,
              humidity: initialWeather.humidity,
              rainMm: initialWeather.rainMm,
              environment: validated.environment,
              droughtTolerance: validated.careInfo.droughtTolerance,
              potMaterial: validated.pot.material,
            },
          };
        }

        const magicToken = crypto.randomBytes(16).toString('hex');
        await Schedule.create({
          plantId: plant._id,
          userId,
          date: targetDate,
          assignedTo,
          baseMl: baseWaterMl,
          suggestedMl,
          fuzzyFactor,
          fuzzyTrace,
          weatherSnapshot: initialWeather,
          magicToken,
        });

        assignedDates.push(targetDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }));
      }
    }

    // Whole schedule delivery email to owner and all caretakers
    const appUrl = process.env.APP_URL || 'http://localhost:5173';
    const potInfo = {
      volumeL: validated.pot.volumeL,
      material: validated.pot.material,
      dimensions:
        validated.pot.diameterCm && validated.pot.heightCm
          ? `Ø ${validated.pot.diameterCm} × ${validated.pot.heightCm} cm`
          : undefined,
      drainage: validated.pot.drainage,
    };
    const caretakersList = createdCaretakers.map((c) => ({ name: c.name, email: c.email }));

    // Send to owner
    await sendScheduleNotificationEmail({
      recipientEmail: req.user!.email,
      recipientName: req.user!.name,
      plantName: plant.name,
      plantEmoji: plant.emoji,
      plantId: plant._id.toString(),
      assignedDates,
      baseAmountMl: baseWaterMl,
      wateringTime: validated.wateringTime || '08:00',
      potInfo,
      caretakers: caretakersList,
      appUrl,
    }).catch((err) => {
      console.warn('[CreatePlant] Schedule email error for owner:', err);
    });

    // Send to all added friends / caretakers
    for (const ct of createdCaretakers) {
      await sendScheduleNotificationEmail({
        recipientEmail: ct.email,
        recipientName: ct.name,
        plantName: plant.name,
        plantEmoji: plant.emoji,
        plantId: plant._id.toString(),
        assignedDates,
        baseAmountMl: baseWaterMl,
        wateringTime: validated.wateringTime || '08:00',
        potInfo,
        caretakers: caretakersList,
        appUrl,
      }).catch((err) => {
        console.warn(`[CreatePlant] Schedule email error for ${ct.email}:`, err);
      });
    }

    // Check if any schedule created for today is already due now and dispatch reminder right away
    dispatchDueReminders().catch((err) => {
      console.warn('[CreatePlant] Auto-dispatch due reminder error:', err);
    });

    res.status(201).json({
      message: 'Plant profile created and whole schedule dispatched to user and team!',
      plant,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.issues.map((e) => e.message).join(', ') });
      return;
    }
    console.error('[PlantController] createPlant error:', err);
    res.status(500).json({ error: 'Server error creating plant.' });
  }
}

/**
 * UPDATE plant
 */
export async function updatePlant(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const plant = await Plant.findOne({ _id: id, userId: req.userId! });

    if (!plant) {
      res.status(404).json({ error: 'Plant not found' });
      return;
    }

    const { name, emoji, environment, pot, pourDaysOfWeek, careInfo, wateringTime } = req.body;
    if (name) plant.name = name;
    if (emoji) plant.emoji = emoji;
    if (environment) plant.environment = environment;
    if (wateringTime) {
      plant.wateringTime = wateringTime;
      const [uH, uM] = wateringTime.split(':').map(Number);
      const safeUH = Number.isFinite(uH) ? uH : 8;
      const safeUM = Number.isFinite(uM) ? uM : 0;
      const pendingSchedules = await Schedule.find({ plantId: plant._id, status: 'pending' });
      for (const sch of pendingSchedules) {
        const d = new Date(sch.date);
        d.setHours(safeUH, safeUM, 0, 0);
        sch.date = d;
        await sch.save();
      }
    }
    if (pot) {
      plant.pot = { ...plant.pot, ...pot };
      // Recalculate base water amount
      plant.baseWaterMl = calculateBaseWaterMl(
        plant.careInfo.waterMlPerPotLitre,
        plant.pot.volumeL,
        plant.pot.material,
        plant.pot.drainage
      );
    }
    if (careInfo) {
      plant.careInfo = { ...plant.careInfo, ...careInfo };
      plant.baseWaterMl = calculateBaseWaterMl(
        plant.careInfo.waterMlPerPotLitre,
        plant.pot.volumeL,
        plant.pot.material,
        plant.pot.drainage
      );
    }
    if (pourDaysOfWeek && Array.isArray(pourDaysOfWeek)) {
      plant.pourDaysOfWeek = pourDaysOfWeek;
    }

    await plant.save();
    res.json({ message: 'Plant updated successfully', plant });
  } catch (err) {
    res.status(500).json({ error: 'Error updating plant' });
  }
}

/**
 * POST /api/plants/:id/send-schedule
 * Re-send whole schedule email to user and care team on demand
 */
export async function sendPlantScheduleEmail(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    let plant = await Plant.findOne({ _id: id, userId: req.userId! });
    if (!plant) {
      plant = await Plant.findById(id);
    }
    if (!plant) {
      res.status(404).json({ error: 'Plant not found' });
      return;
    }

    const caretakers = await Caretaker.find({ plantId: plant._id });
    const schedules = await Schedule.find({
      plantId: plant._id,
      status: { $in: ['pending', 'snoozed'] },
    }).sort({ date: 1 }).limit(14);

    const appUrl = process.env.APP_URL || 'http://localhost:5173';
    const potInfo = {
      volumeL: plant.pot.volumeL,
      material: plant.pot.material,
      dimensions:
        plant.pot.diameterCm && plant.pot.heightCm
          ? `Ø ${plant.pot.diameterCm} × ${plant.pot.heightCm} cm`
          : undefined,
      drainage: plant.pot.drainage,
    };
    const caretakersList = caretakers.map((c) => ({ name: c.name, email: c.email }));
    const assignedDates = schedules.map((s) =>
      s.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    );

    const recipientsMap = new Map<string, string>();
    if (req.user?.email) {
      recipientsMap.set(req.user.email.toLowerCase(), req.user.name || 'Plant Owner');
    }
    for (const ct of caretakers) {
      if (ct.email) {
        recipientsMap.set(ct.email.toLowerCase(), ct.name);
      }
    }

    let sent = 0;
    let previewUrl: string | null = null;
    for (const [email, name] of recipientsMap.entries()) {
      try {
        const result = await sendScheduleNotificationEmail({
          recipientEmail: email,
          recipientName: name,
          plantName: plant.name,
          plantEmoji: plant.emoji || '🌿',
          plantId: plant._id.toString(),
          assignedDates,
          baseAmountMl: plant.baseWaterMl,
          wateringTime: plant.wateringTime || '08:00',
          potInfo,
          caretakers: caretakersList,
          appUrl,
        });
        if (result.previewUrl) previewUrl = result.previewUrl;
        sent++;
      } catch (e) {
        console.warn(`[SendSchedule] Delivery failed for ${email}:`, e);
      }
    }

    res.json({
      message: `Whole schedule email sent to ${sent} care team recipient(s)!`,
      sentCount: sent,
      recipients: Array.from(recipientsMap.keys()),
      previewUrl,
    });
  } catch (err: any) {
    console.error('[PlantController] sendPlantScheduleEmail error:', err);
    res.status(500).json({ error: err.message || 'Error dispatching schedule email' });
  }
}

/**
 * DELETE or archive plant
 */
export async function deletePlant(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const plant = await Plant.findOne({ _id: id, userId: req.userId! });

    if (!plant) {
      res.status(404).json({ error: 'Plant not found' });
      return;
    }

    // Mark as archived or delete
    plant.archived = true;
    await plant.save();

    res.json({ message: 'Plant archived successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Error deleting plant' });
  }
}

/**
 * POST /api/plants/:id/water-now
 * Instant pour logged from dashboard modal
 */
export async function waterPlantNow(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    let plant = await Plant.findOne({ _id: id, userId: req.userId! });
    if (!plant) {
      plant = await Plant.findById(id);
    }

    if (!plant) {
      res.status(404).json({ error: 'Plant not found' });
      return;
    }

    const personName = (req.body.personName || req.user?.name || 'Sophia Botanica').trim();
    const amountMl =
      typeof req.body.amountMl === 'number' && !isNaN(req.body.amountMl)
        ? Number(req.body.amountMl)
        : plant.baseWaterMl || 300;
    const notes = req.body.notes || 'Instant pour logged from dashboard modal';

    // Fetch current weather snapshot if plant has location
    let snap: IWeatherSnapshot | undefined;
    if (plant.location) {
      try {
        const weatherRes = await getWeatherForecast(plant.location.lat, plant.location.lon);
        snap = weatherRes.snapshot;
      } catch (err) {
        console.warn('[WaterNow] Weather forecast fetch error:', err);
      }
    }

    // Mark pending or snoozed schedule as completed if one exists
    const pendingSch = await Schedule.findOne({
      plantId: plant._id,
      status: { $in: ['pending', 'snoozed'] },
    }).sort({ date: 1 });

    if (pendingSch) {
      pendingSch.status = 'completed';
      await pendingSch.save();
      // Cancel active snoozes
      await Snooze.updateMany({ scheduleId: pendingSch._id, status: 'active' }, { status: 'cancelled' });
    } else {
      // Create a completed schedule document so it appears in history
      await Schedule.create({
        plantId: plant._id,
        userId: plant.userId,
        date: new Date(),
        assignedTo: {
          role: 'owner',
          name: personName,
          email: req.user?.email || '',
        },
        baseMl: plant.baseWaterMl,
        suggestedMl: amountMl,
        fuzzyFactor: 1.0,
        status: 'completed',
        weatherSnapshot: snap,
      });
    }

    // Insert water log
    const log = await WaterLog.create({
      plantId: plant._id,
      userId: plant.userId,
      scheduleId: pendingSch?._id,
      personName,
      status: 'poured',
      amountMl,
      baseAmountMl: plant.baseWaterMl || 300,
      suggestedAmountMl: pendingSch?.suggestedMl || amountMl,
      pouredAt: new Date(),
      notes,
      weatherSnapshot: snap || pendingSch?.weatherSnapshot,
      fuzzyFactor: pendingSch?.fuzzyFactor || 1.0,
    });

    // Check and award achievements
    let badgesAwarded: any[] = [];
    try {
      badgesAwarded = await checkAndAwardAchievements(
        plant._id,
        plant.userId,
        personName,
        log
      );
    } catch (achErr) {
      console.warn('[WaterNow] checkAndAwardAchievements error:', achErr);
    }

    // Ensure a next upcoming pending schedule exists
    const remainingPending = await Schedule.findOne({
      plantId: plant._id,
      status: { $in: ['pending', 'snoozed'] },
    }).sort({ date: 1 });

    let nextScheduleDateStr: string | null = null;
    if (remainingPending) {
      nextScheduleDateStr = remainingPending.date.toISOString();
    } else {
      // Generate next recurrence
      const pourDays = plant.pourDaysOfWeek && plant.pourDaysOfWeek.length > 0 ? plant.pourDaysOfWeek : [1];
      const [recH, recM] = (plant.wateringTime || '08:00').split(':').map(Number);
      const safeRecH = Number.isFinite(recH) ? recH : 8;
      const safeRecM = Number.isFinite(recM) ? recM : 0;
      const now = new Date();
      for (let d = 1; d <= 14; d++) {
        const cand = new Date(now);
        cand.setDate(cand.getDate() + d);
        cand.setHours(safeRecH, safeRecM, 0, 0);
        const dayIdx = cand.getDay();
        if (pourDays.includes(dayIdx)) {
          let fuzzyFactor = 1.0;
          let suggestedMl = plant.baseWaterMl || 300;
          let fuzzyTrace = undefined;

          if (snap) {
            try {
              const fRes = evaluateFuzzyWatering({
                temp: snap.temp,
                humidity: snap.humidity,
                rainMm: snap.rainMm,
                environment: plant.environment,
                droughtTolerance: plant.careInfo.droughtTolerance,
                potMaterial: plant.pot.material,
                baseWaterMl: plant.baseWaterMl,
              });
              fuzzyFactor = fRes.finalFuzzyFactor;
              suggestedMl = fRes.suggestedWaterMl;
              fuzzyTrace = {
                reason: fRes.reason,
                factor: fuzzyFactor,
                rulesFired: fRes.explanation.rulesTriggered.map((r) => r.description),
                memberships: fRes.explanation.memberships,
                crispInputs: fRes.explanation.inputs,
              };
            } catch (fuzzyErr) {
              console.warn('[WaterNow] Fuzzy calculation error for next schedule:', fuzzyErr);
            }
          }

          const token = crypto.randomBytes(16).toString('hex');
          await Schedule.create({
            plantId: plant._id,
            userId: plant.userId,
            date: cand,
            assignedTo: {
              role: 'owner',
              name: req.user?.name || 'Owner',
              email: req.user?.email || '',
            },
            baseMl: plant.baseWaterMl,
            suggestedMl,
            fuzzyFactor,
            fuzzyTrace,
            weatherSnapshot: snap,
            magicToken: token,
            status: 'pending',
          });
          nextScheduleDateStr = cand.toISOString();
          break;
        }
      }
    }

    // Send confirmation email to both user (owner) and added friends (caretakers)
    const caretakers = await Caretaker.find({ plantId: plant._id });
    const owner = await User.findById(plant.userId);
    const recipientMap = new Map<string, string>();
    if (owner?.email) {
      recipientMap.set(owner.email.toLowerCase(), owner.name || 'Plant Owner');
    }
    if (req.user?.email) {
      recipientMap.set(req.user.email.toLowerCase(), req.user.name || personName);
    }
    for (const ct of caretakers) {
      if (ct.email) {
        recipientMap.set(ct.email.toLowerCase(), ct.name);
      }
    }

    const recipients = Array.from(recipientMap.entries()).map(([email, name]) => ({ email, name }));

    if (recipients.length > 0) {
      const appUrl = process.env.APP_URL || 'http://localhost:5173';
      sendWateringConfirmationNotification({
        recipients,
        pouredBy: personName,
        plantName: plant.name,
        plantEmoji: plant.emoji,
        plantId: plant._id.toString(),
        amountMl,
        status: 'poured',
        reason: notes,
        pouredAt: new Date(),
        websiteUrl: `${appUrl}/plant/${plant._id}`,
      }).catch((emailErr) => {
        console.warn('[WaterNow] Email send error:', emailErr);
      });
    }

    res.json({
      message: `Successfully recorded pour by ${personName} for ${plant.name} (${amountMl} ml)!`,
      log,
      plantName: plant.name,
      isWateredToday: true,
      nextScheduleDate: nextScheduleDateStr,
      badgesAwarded,
    });
  } catch (err: any) {
    console.error('[PlantController] waterPlantNow error:', err);
    res.status(500).json({ error: err.message || 'Server error recording watering.' });
  }
}
