import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware.js';
import { Plant, IPlant } from '../models/Plant.js';
import { WaterLog } from '../models/WaterLog.js';
import { Schedule } from '../models/Schedule.js';
import { Achievement } from '../models/Achievement.js';
import {
  calculateHealthScore,
  calculateStreaks,
  generatePlantInsights,
} from '../services/analyticsService.js';

/**
 * GET Analytics for a specific plant
 */
export async function getPlantAnalytics(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { plantId } = req.params;
    const plant = await Plant.findOne({ _id: plantId, userId: req.userId! });

    if (!plant) {
      res.status(404).json({ error: 'Plant not found' });
      return;
    }

    const logs = await WaterLog.find({ plantId: plant._id }).sort({ pouredAt: 1 });
    const schedules = await Schedule.find({ plantId: plant._id }).sort({ date: 1 });

    const health = calculateHealthScore(logs, schedules);
    const streaks = calculateStreaks(logs);
    const insights = generatePlantInsights(logs, plant);

    // 1. Chart: Base vs Suggested vs Actual water per watering
    const waterComparisonData = logs.map((log) => ({
      date: new Date(log.pouredAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      baseMl: log.baseAmountMl,
      suggestedMl: log.suggestedAmountMl,
      actualMl: log.amountMl,
      person: log.personName,
      status: log.status,
    }));

    // 2. Chart: Temperature vs Water Adjustment factor
    const tempVsAdjustmentData = logs
      .filter((l) => l.weatherSnapshot)
      .map((log) => ({
        date: new Date(log.pouredAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        temperature: log.weatherSnapshot!.temp,
        fuzzyFactor: log.fuzzyFactor || 1.0,
        rainMm: log.weatherSnapshot!.rainMm,
        humidity: log.weatherSnapshot!.humidity,
      }));

    // 3. Status breakdown
    const pouredCount = logs.filter((l) => l.status === 'poured').length;
    const missedCount = logs.filter((l) => l.status === 'missed').length;
    const skippedCount = logs.filter((l) => l.status === 'skipped').length;

    // 4. Activity logs
    const recentActivity = [...logs]
      .reverse()
      .slice(0, 15)
      .map((l) => ({
        id: l._id,
        personName: l.personName,
        status: l.status,
        amountMl: l.amountMl,
        suggestedMl: l.suggestedAmountMl,
        pouredAt: l.pouredAt,
        notes: l.notes,
        weather: l.weatherSnapshot,
      }));

    // 5. Plant specific achievements
    const badges = await Achievement.find({ plantId: plant._id }).sort({ awardedAt: -1 });

    res.json({
      plant: {
        id: plant._id,
        name: plant.name,
        emoji: plant.emoji,
        pot: plant.pot,
        location: plant.location,
        baseWaterMl: plant.baseWaterMl,
      },
      health,
      streaks,
      insights,
      charts: {
        waterComparison: waterComparisonData,
        tempVsAdjustment: tempVsAdjustmentData,
        breakdown: [
          { name: 'Completed Pours', value: pouredCount, color: '#10b981' },
          { name: 'Missed', value: missedCount, color: '#ef4444' },
          { name: 'Skipped (Smart)', value: skippedCount, color: '#3b82f6' },
        ],
      },
      badges,
      recentActivity,
    });
  } catch (err) {
    console.error('[AnalyticsController] getPlantAnalytics error:', err);
    res.status(500).json({ error: 'Error generating plant analytics' });
  }
}

/**
 * GET Overall Cross-Plant Dashboard with Leaderboard & Gamification
 */
export async function getOverallAnalytics(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const plants = await Plant.find({ userId, archived: false });

    const plantSummaries = await Promise.all(
      plants.map(async (plant) => {
        const logs = await WaterLog.find({ plantId: plant._id }).sort({ pouredAt: -1 }).limit(10);
        const schedules = await Schedule.find({ plantId: plant._id }).sort({ date: -1 }).limit(10);
        const health = calculateHealthScore(logs, schedules);
        const streaks = calculateStreaks(logs);

        return {
          id: plant._id,
          name: plant.name,
          emoji: plant.emoji,
          location: plant.location.city,
          environment: plant.environment,
          potVolumeL: plant.pot.volumeL,
          baseWaterMl: plant.baseWaterMl,
          healthScore: health.score,
          healthLabel: health.label,
          healthEmoji: health.emoji,
          currentStreak: streaks.currentStreak,
          totalPours: logs.filter((l) => l.status === 'poured').length,
        };
      })
    );

    // Multi-user Leaderboard & MVP
    const allUserLogs = await WaterLog.find({ userId }).sort({ pouredAt: -1 });

    const pourCountsByPerson: Record<string, number> = {};
    const adherenceByPerson: Record<string, { totalDiffRatio: number; count: number }> = {};

    for (const log of allUserLogs) {
      if (log.status === 'poured') {
        pourCountsByPerson[log.personName] = (pourCountsByPerson[log.personName] || 0) + 1;

        if (log.suggestedAmountMl > 0) {
          if (!adherenceByPerson[log.personName]) {
            adherenceByPerson[log.personName] = { totalDiffRatio: 0, count: 0 };
          }
          const diff = Math.abs(log.amountMl - log.suggestedAmountMl);
          adherenceByPerson[log.personName].totalDiffRatio += Math.max(0, 1 - diff / log.suggestedAmountMl);
          adherenceByPerson[log.personName].count++;
        }
      }
    }

    // Leaderboard sorted by total pours
    const leaderboard = Object.keys(pourCountsByPerson).map((person) => {
      const pours = pourCountsByPerson[person];
      const adherenceInfo = adherenceByPerson[person];
      const adherencePercent = adherenceInfo && adherenceInfo.count > 0
        ? Math.round((adherenceInfo.totalDiffRatio / adherenceInfo.count) * 100)
        : 95;

      return {
        name: person,
        totalPours: pours,
        adherencePercent,
      };
    }).sort((a, b) => b.totalPours - a.totalPours);

    // MVP of the Month (most pours)
    const mvp = leaderboard.length > 0 ? leaderboard[0] : null;

    // Plant Parent of the Week
    const plantParentOfWeek = leaderboard.find((l) => l.adherencePercent >= 90) || leaderboard[0] || null;

    // Badges awarded across all user's plants
    const allBadges = await Achievement.find({ userId }).sort({ awardedAt: -1 }).limit(20);

    // Activity Feed
    const activityFeed = allUserLogs.slice(0, 15).map((l) => ({
      id: l._id,
      personName: l.personName,
      status: l.status,
      amountMl: l.amountMl,
      pouredAt: l.pouredAt,
      fuzzyFactor: l.fuzzyFactor,
    }));

    res.json({
      plantSummaries,
      leaderboard,
      mvp,
      plantParentOfWeek,
      badges: allBadges,
      activityFeed,
      stats: {
        totalPlants: plants.length,
        totalPours: allUserLogs.filter((l) => l.status === 'poured').length,
        averageHealth: plantSummaries.length > 0
          ? Math.round(plantSummaries.reduce((acc, p) => acc + p.healthScore, 0) / plantSummaries.length)
          : 100,
      },
    });
  } catch (err) {
    console.error('[AnalyticsController] getOverallAnalytics error:', err);
    res.status(500).json({ error: 'Error generating overall analytics' });
  }
}
