import { describe, it, expect } from 'vitest';
import { calculateHealthScore, calculateStreaks, generatePlantInsights } from '../services/analyticsService.js';
import { calculateBaseWaterMl } from '../services/aiService.js';
import { IWaterLog } from '../models/WaterLog.js';
import { ISchedule } from '../models/Schedule.js';
import { IPlant } from '../models/Plant.js';

describe('Base Water Calculation', () => {
  it('calculates standard base water from pot volume and ml per litre', () => {
    // 80 ml/L * 5 L * 1.0 (plastic) * 1.0 (drainage) = 400 ml
    const base = calculateBaseWaterMl(80, 5, 'plastic', true);
    expect(base).toBe(400);
  });

  it('increases base water for terracotta due to porous evaporation (+15%)', () => {
    // 50 ml/L * 3.5 L * 1.15 = 201.25 -> rounded to 200 ml
    const base = calculateBaseWaterMl(50, 3.5, 'terracotta', true);
    expect(base).toBe(200);
  });

  it('decreases base water when pot has no drainage hole (-20%) to prevent root rot', () => {
    // 80 ml/L * 5 L * 1.0 * 0.8 = 320 ml
    const base = calculateBaseWaterMl(80, 5, 'plastic', false);
    expect(base).toBe(320);
  });
});

describe('Health Score Calculation', () => {
  it('returns Thriving (100) for new plants without missed pours', () => {
    const res = calculateHealthScore([], []);
    expect(res.score).toBe(100);
    expect(res.label).toBe('Thriving');
    expect(res.emoji).toBe('🌿');
  });

  it('drops health score when missed events occur', () => {
    const missedSchedule = [{ status: 'missed' }] as ISchedule[];
    const res = calculateHealthScore([], missedSchedule);
    expect(res.score).toBeLessThan(70);
  });

  it('rewards adherence to fuzzy suggestions', () => {
    const highAdherenceLogs = [
      { status: 'poured', amountMl: 300, suggestedAmountMl: 300 },
      { status: 'poured', amountMl: 290, suggestedAmountMl: 300 },
    ] as IWaterLog[];

    const poorAdherenceLogs = [
      { status: 'poured', amountMl: 100, suggestedAmountMl: 300 },
      { status: 'poured', amountMl: 600, suggestedAmountMl: 300 },
    ] as IWaterLog[];

    const scoreHigh = calculateHealthScore(highAdherenceLogs, []);
    const scorePoor = calculateHealthScore(poorAdherenceLogs, []);

    expect(scoreHigh.score).toBeGreaterThan(scorePoor.score);
  });
});

describe('Streaks & Automated Insights', () => {
  it('computes active streaks accurately', () => {
    const now = new Date();
    const logs = [
      { status: 'poured', pouredAt: new Date(now.getTime() - 14 * 86400000) },
      { status: 'poured', pouredAt: new Date(now.getTime() - 7 * 86400000) },
      { status: 'poured', pouredAt: now },
    ] as IWaterLog[];

    const { currentStreak, bestStreak } = calculateStreaks(logs);
    expect(currentStreak).toBe(3);
    expect(bestStreak).toBe(3);
  });

  it('generates cold snap insights when freezing weather detected', () => {
    const logs = [
      {
        status: 'poured',
        pouredAt: new Date(),
        weatherSnapshot: { temp: 1, humidity: 60, rainMm: 0, fetchedAt: new Date() },
      },
    ] as unknown as IWaterLog[];

    const mockPlant = {
      name: 'Monty',
      pot: { volumeL: 5, material: 'terracotta', drainage: true },
      environment: 'indoor',
      baseWaterMl: 400,
    } as unknown as IPlant;

    const insights = generatePlantInsights(logs, mockPlant);
    expect(insights.some((i) => i.includes('Cold snap'))).toBe(true);
    expect(insights.some((i) => i.includes('Terracotta'))).toBe(true);
  });
});
