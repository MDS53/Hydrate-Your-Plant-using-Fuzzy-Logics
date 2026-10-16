import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware.js';
import { Schedule } from '../models/Schedule.js';
import { Plant } from '../models/Plant.js';
import { Caretaker } from '../models/Caretaker.js';
import { runDailyWeatherReEvaluation, dispatchMorningReminders } from '../services/schedulerService.js';
import { getWeatherForecast } from '../services/weatherService.js';
import { evaluateFuzzyWatering } from '../fuzzy/engine.js';
import crypto from 'crypto';

export async function getPlantSchedules(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { plantId } = req.params;
    const schedules = await Schedule.find({ plantId }).sort({ date: 1 });
    res.json({ schedules });
  } catch (err) {
    res.status(500).json({ error: 'Error fetching schedules' });
  }
}

export async function generateSchedule(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { plantId, weeks = 2 } = req.body;
    const plant = await Plant.findOne({ _id: plantId, userId: req.userId! });

    if (!plant) {
      res.status(404).json({ error: 'Plant not found' });
      return;
    }

    const caretakers = await Caretaker.find({ plantId: plant._id });
    const today = new Date();
    const createdSchedules = [];
    let caretakerIndex = 0;

    let weather;
    try {
      const { snapshot } = await getWeatherForecast(plant.location.lat, plant.location.lon);
      weather = snapshot;
    } catch (e) {
      // fallback
    }

    const totalDays = weeks * 7;
    const [gH, gM] = (plant.wateringTime || '08:00').split(':').map(Number);
    const safeGH = Number.isFinite(gH) ? gH : 8;
    const safeGM = Number.isFinite(gM) ? gM : 0;
    for (let i = 0; i < totalDays; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + i);
      targetDate.setHours(safeGH, safeGM, 0, 0);
      const dayOfWeek = targetDate.getDay();

      if (plant.pourDaysOfWeek.includes(dayOfWeek)) {
        // Check if schedule already exists for this date
        const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
        const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);

        const existing = await Schedule.findOne({
          plantId: plant._id,
          date: { $gte: startOfDay, $lte: endOfDay },
        });

        if (!existing) {
          let assignedTo;
          if (caretakers.length === 0 || caretakerIndex % (caretakers.length + 1) === 0) {
            assignedTo = {
              role: 'owner' as const,
              name: req.user!.name,
              email: req.user!.email,
            };
          } else {
            const ct = caretakers[(caretakerIndex - 1) % caretakers.length];
            assignedTo = {
              role: 'caretaker' as const,
              name: ct.name,
              email: ct.email,
              caretakerId: ct._id,
            };
          }
          caretakerIndex++;

          let fuzzyFactor = 1.0;
          let suggestedMl = plant.baseWaterMl;
          let fuzzyTrace = undefined;

          if (weather) {
            const fuzzyRes = evaluateFuzzyWatering({
              temp: weather.temp,
              humidity: weather.humidity,
              rainMm: weather.rainMm,
              environment: plant.environment,
              droughtTolerance: plant.careInfo.droughtTolerance,
              potMaterial: plant.pot.material,
              baseWaterMl: plant.baseWaterMl,
            });
            fuzzyFactor = fuzzyRes.finalFuzzyFactor;
            suggestedMl = fuzzyRes.suggestedWaterMl;
            fuzzyTrace = {
              reason: fuzzyRes.reason,
              factor: fuzzyFactor,
              rulesFired: fuzzyRes.explanation.rulesTriggered.map((r) => r.description),
              memberships: fuzzyRes.explanation.memberships,
              crispInputs: {
                temp: weather.temp,
                humidity: weather.humidity,
                rainMm: weather.rainMm,
                environment: plant.environment,
                droughtTolerance: plant.careInfo.droughtTolerance,
                potMaterial: plant.pot.material,
              },
            };
          }

          const magicToken = crypto.randomBytes(16).toString('hex');
          const sch = await Schedule.create({
            plantId: plant._id,
            userId: req.user!._id,
            date: targetDate,
            assignedTo,
            baseMl: plant.baseWaterMl,
            suggestedMl,
            fuzzyFactor,
            fuzzyTrace,
            weatherSnapshot: weather,
            magicToken,
          });

          createdSchedules.push(sch);
        }
      }
    }

    res.json({
      message: `Generated ${createdSchedules.length} new schedule entries`,
      schedules: createdSchedules,
    });
  } catch (err) {
    res.status(500).json({ error: 'Error generating schedule' });
  }
}

export async function triggerDailyReEvaluation(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await runDailyWeatherReEvaluation();
    res.json({ message: 'Live morning weather re-evaluation complete', ...result });
  } catch (err) {
    res.status(500).json({ error: 'Error running re-evaluation' });
  }
}

export async function triggerMorningReminders(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await dispatchMorningReminders();
    res.json({ message: 'Morning reminders dispatched', ...result });
  } catch (err) {
    res.status(500).json({ error: 'Error dispatching reminders' });
  }
}
