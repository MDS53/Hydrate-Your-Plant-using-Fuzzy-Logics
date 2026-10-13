import { Types } from 'mongoose';
import { WaterLog, IWaterLog } from '../models/WaterLog.js';
import { Schedule, ISchedule } from '../models/Schedule.js';
import { Plant, IPlant } from '../models/Plant.js';
import { Achievement, IAchievement } from '../models/Achievement.js';

export interface HealthScoreResult {
  score: number; // 0 - 100
  label: 'Thriving' | 'OK' | 'Thirsty' | 'Critical';
  emoji: string;
  color: string;
  breakdown: {
    consistencyPoints: number; // up to 40
    punctualityPoints: number; // up to 30
    adherencePoints: number;   // up to 30
  };
}

/**
 * Compute plant health score (0 - 100)
 */
export function calculateHealthScore(
  logs: IWaterLog[],
  schedules: ISchedule[]
): HealthScoreResult {
  if (logs.length === 0 && schedules.length === 0) {
    return {
      score: 100,
      label: 'Thriving',
      emoji: '🌿',
      color: '#10b981',
      breakdown: { consistencyPoints: 40, punctualityPoints: 30, adherencePoints: 30 },
    };
  }

  // 1. Consistency (Ratio of completed vs missed) - max 40 pts
  const totalCompleted = logs.filter((l) => l.status === 'poured').length;
  const totalMissed = schedules.filter((s) => s.status === 'missed').length + logs.filter((l) => l.status === 'missed').length;
  const totalEvents = totalCompleted + totalMissed;
  
  let consistencyRate = totalEvents > 0 ? totalCompleted / totalEvents : 1.0;
  const consistencyPoints = Math.round(consistencyRate * 40);

  // 2. Punctuality / Timeliness (Late or snoozed penalty) - max 30 pts
  let punctualityPoints = 30;
  if (totalMissed > 0) {
    punctualityPoints = Math.max(0, 30 - totalMissed * 8);
  }

  // 3. Adherence to fuzzy suggestion (How closely actual matches suggested amount) - max 30 pts
  let totalAdherenceRatio = 0;
  let pouredCount = 0;

  for (const log of logs) {
    if (log.status === 'poured' && log.suggestedAmountMl > 0) {
      const diff = Math.abs(log.amountMl - log.suggestedAmountMl);
      const ratio = Math.max(0, 1 - diff / log.suggestedAmountMl);
      totalAdherenceRatio += ratio;
      pouredCount++;
    }
  }

  const avgAdherence = pouredCount > 0 ? totalAdherenceRatio / pouredCount : 0.95;
  const adherencePoints = Math.round(avgAdherence * 30);

  const rawScore = consistencyPoints + punctualityPoints + adherencePoints;
  const score = Math.max(10, Math.min(100, rawScore));

  let label: 'Thriving' | 'OK' | 'Thirsty' | 'Critical';
  let emoji = '🌿';
  let color = '#10b981';

  if (score >= 85) {
    label = 'Thriving';
    emoji = '🌿';
    color = '#10b981';
  } else if (score >= 70) {
    label = 'OK';
    emoji = '🪴';
    color = '#3b82f6';
  } else if (score >= 45) {
    label = 'Thirsty';
    emoji = '🥀';
    color = '#f59e0b';
  } else {
    label = 'Critical';
    emoji = '🚨';
    color = '#ef4444';
  }

  return {
    score,
    label,
    emoji,
    color,
    breakdown: { consistencyPoints, punctualityPoints, adherencePoints },
  };
}

/**
 * Calculate streaks (current and best)
 */
export function calculateStreaks(logs: IWaterLog[]): { currentStreak: number; bestStreak: number } {
  const sorted = [...logs]
    .filter((l) => l.status === 'poured')
    .sort((a, b) => new Date(a.pouredAt).getTime() - new Date(b.pouredAt).getTime());

  if (sorted.length === 0) return { currentStreak: 0, bestStreak: 0 };

  let currentStreak = 0;
  let bestStreak = 0;
  let tempStreak = 0;
  let lastDate: Date | null = null;

  for (const log of sorted) {
    const logDate = new Date(log.pouredAt);
    if (!lastDate) {
      tempStreak = 1;
    } else {
      const diffDays = Math.round((logDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 10) { // within expected watering intervals
        tempStreak++;
      } else {
        tempStreak = 1;
      }
    }
    lastDate = logDate;
    if (tempStreak > bestStreak) bestStreak = tempStreak;
  }

  // Check if current streak is still active
  const now = new Date();
  if (lastDate) {
    const daysSinceLast = Math.round((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    currentStreak = daysSinceLast <= 14 ? tempStreak : 0;
  }

  return { currentStreak, bestStreak: Math.max(bestStreak, currentStreak) };
}

/**
 * Evaluate and award badges / achievements dynamically
 */
export async function checkAndAwardAchievements(
  plantId: Types.ObjectId,
  userId: Types.ObjectId,
  personName: string,
  log: IWaterLog
): Promise<IAchievement[]> {
  const newlyAwarded: IAchievement[] = [];

  const existing = await Achievement.find({ personName }).lean();
  const existingBadges = new Set(existing.map((a) => a.badge));

  const allLogs = await WaterLog.find({ personName }).sort({ pouredAt: -1 });

  // 1. Early Bird: poured before 9:00 AM
  const pouredHour = new Date(log.pouredAt).getHours();
  if (!existingBadges.has('Early Bird') && pouredHour < 9) {
    const ach = await Achievement.create({
      plantId,
      userId,
      personName,
      badge: 'Early Bird',
      description: 'Poured water before 9:00 AM! Your plant gets a fresh start to the day.',
      icon: '🌅',
    });
    newlyAwarded.push(ach);
  }

  // 2. Plant Whisperer: poured within 5% of suggested amount
  if (!existingBadges.has('Plant Whisperer') && log.suggestedAmountMl > 0) {
    const diff = Math.abs(log.amountMl - log.suggestedAmountMl);
    if (diff / log.suggestedAmountMl <= 0.05) {
      const ach = await Achievement.create({
        plantId,
        userId,
        personName,
        badge: 'Plant Whisperer',
        description: 'Poured the exact fuzzy-suggested water amount within 5% precision!',
        icon: '🎯',
      });
      newlyAwarded.push(ach);
    }
  }

  // 3. Weather Warrior: poured correctly during freezing (<5°C) or hot (>30°C) weather
  if (!existingBadges.has('Weather Warrior') && log.weatherSnapshot) {
    const temp = log.weatherSnapshot.temp;
    if (temp <= 5 || temp >= 30) {
      const ach = await Achievement.create({
        plantId,
        userId,
        personName,
        badge: 'Weather Warrior',
        description: `Successfully adapted watering to extreme ${temp}°C conditions!`,
        icon: '🛡️',
      });
      newlyAwarded.push(ach);
    }
  }

  // 4. Never Missed: 5+ completed pours with zero missed
  if (!existingBadges.has('Never Missed') && allLogs.length >= 5) {
    const missed = allLogs.some((l) => l.status === 'missed');
    if (!missed) {
      const ach = await Achievement.create({
        plantId,
        userId,
        personName,
        badge: 'Never Missed',
        description: 'Completed 5 consecutive watering sessions without missing a single pour!',
        icon: '⭐',
      });
      newlyAwarded.push(ach);
    }
  }

  return newlyAwarded;
}

/**
 * Generate smart automated insights
 */
export function generatePlantInsights(logs: IWaterLog[], plant: IPlant): string[] {
  const insights: string[] = [];

  if (logs.length === 0) {
    insights.push(`Welcome! Your ${plant.name} base water is ${plant.baseWaterMl} ml based on its ${plant.pot.volumeL}L pot.`);
    return insights;
  }

  // Weather adaptation insight
  const recentWeatherLogs = logs.slice(0, 5).filter((l) => l.weatherSnapshot);
  if (recentWeatherLogs.length > 0) {
    const freezingLog = recentWeatherLogs.find((l) => l.weatherSnapshot!.temp <= 3);
    const hotLog = recentWeatherLogs.find((l) => l.weatherSnapshot!.temp >= 30);
    const rainLog = recentWeatherLogs.find((l) => l.weatherSnapshot!.rainMm >= 4);

    if (freezingLog) {
      insights.push(`❄️ Cold snap detected (${freezingLog.weatherSnapshot!.temp}°C): water was reduced to prevent root rot and chill.`);
    }
    if (hotLog) {
      insights.push(`☀️ High temperature surge (${hotLog.weatherSnapshot!.temp}°C): watering was boosted to compensate for high transpiration.`);
    }
    if (rainLog && plant.environment === 'outdoor') {
      insights.push(`🌧️ Outdoor rainfall of ${rainLog.weatherSnapshot!.rainMm} mm naturally replenished soil moisture, saving manual water.`);
    }
  }

  // Pot material insight
  if (plant.pot.material === 'terracotta') {
    insights.push('🏺 Terracotta factor (+15%): Porous clay evaporates moisture quicker than plastic, promoting healthy root breathability.');
  } else if (!plant.pot.drainage) {
    insights.push('⚠️ No drainage hole (-20% base): Water volumes are automatically trimmed to guard against root-rot waterlogging.');
  }

  // Consistency insight
  const missedCount = logs.filter((l) => l.status === 'missed').length;
  if (missedCount === 0 && logs.length >= 3) {
    insights.push('✨ Outstanding streak! Consistency has kept the health score in peak condition.');
  }

  return insights;
}
