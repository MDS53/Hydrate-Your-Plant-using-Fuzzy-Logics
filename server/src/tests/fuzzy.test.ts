import { describe, it, expect } from 'vitest';
import { evaluateFuzzyWatering } from '../fuzzy/engine.js';
import { triangular, shoulderLeft, shoulderRight } from '../fuzzy/membership.js';
import { centroidDefuzzify } from '../fuzzy/defuzzifier.js';

describe('Fuzzy Membership Functions', () => {
  it('evaluates triangular membership correctly', () => {
    expect(triangular(10, 5, 10, 15)).toBe(1);
    expect(triangular(5, 5, 10, 15)).toBe(0);
    expect(triangular(15, 5, 10, 15)).toBe(0);
    expect(triangular(7.5, 5, 10, 15)).toBeCloseTo(0.5, 3);
    expect(triangular(20, 5, 10, 15)).toBe(0);
  });

  it('evaluates left shoulder membership correctly', () => {
    expect(shoulderLeft(1, 2, 5)).toBe(1);
    expect(shoulderLeft(2, 2, 5)).toBe(1);
    expect(shoulderLeft(3.5, 2, 5)).toBeCloseTo(0.5, 3);
    expect(shoulderLeft(6, 2, 5)).toBe(0);
  });

  it('evaluates right shoulder membership correctly', () => {
    expect(shoulderRight(30, 33, 38)).toBe(0);
    expect(shoulderRight(35.5, 33, 38)).toBeCloseTo(0.5, 3);
    expect(shoulderRight(40, 33, 38)).toBe(1);
  });
});

describe('Centroid Defuzzifier', () => {
  it('returns baseline factor when no rules fire', () => {
    const res = centroidDefuzzify({
      Skip: 0,
      VeryLow: 0,
      Low: 0,
      Normal: 0,
      High: 0,
      VeryHigh: 0,
    });
    expect(res.factor).toBe(1.0);
  });

  it('calculates centroid for Normal consequent around 1.0', () => {
    const res = centroidDefuzzify({
      Skip: 0,
      VeryLow: 0,
      Low: 0,
      Normal: 1.0,
      High: 0,
      VeryHigh: 0,
    });
    expect(res.factor).toBeGreaterThan(0.9);
    expect(res.factor).toBeLessThan(1.1);
  });

  it('shifts towards VeryHigh when hot rules dominate', () => {
    const res = centroidDefuzzify({
      Skip: 0,
      VeryLow: 0,
      Low: 0,
      Normal: 0,
      High: 0,
      VeryHigh: 1.0,
    });
    expect(res.factor).toBeGreaterThan(1.25);
  });
});

describe('Fuzzy Watering Suggestion Engine', () => {
  const baseWaterMl = 300;

  it('handles Freezing weather: reduces water drastically and flags shouldSkipOrMinimal', () => {
    const result = evaluateFuzzyWatering({
      temp: 0,
      humidity: 60,
      rainMm: 0,
      environment: 'outdoor',
      droughtTolerance: 'medium',
      baseWaterMl,
    });

    expect(result.finalFuzzyFactor).toBeLessThan(0.5);
    expect(result.suggestedWaterMl).toBeLessThan(150);
    expect(result.shouldSkipOrMinimal).toBe(true);
    expect(result.reason).toContain('Freezing');
    expect(result.badge.emoji).toBe('❄️');
  });

  it('handles Mild & Comfortable conditions: preserves normal base water', () => {
    const result = evaluateFuzzyWatering({
      temp: 20,
      humidity: 50,
      rainMm: 0,
      environment: 'indoor',
      droughtTolerance: 'medium',
      baseWaterMl,
    });

    // Should stay close to 1.0 factor
    expect(result.finalFuzzyFactor).toBeGreaterThan(0.9);
    expect(result.finalFuzzyFactor).toBeLessThan(1.1);
    expect(result.suggestedWaterMl).toBeGreaterThanOrEqual(280);
    expect(result.suggestedWaterMl).toBeLessThanOrEqual(320);
    expect(result.shouldSkipOrMinimal).toBe(false);
  });

  it('handles Hot & Dry weather: increases water amount', () => {
    const result = evaluateFuzzyWatering({
      temp: 34,
      humidity: 25,
      rainMm: 0,
      environment: 'outdoor',
      droughtTolerance: 'medium',
      baseWaterMl,
    });

    expect(result.finalFuzzyFactor).toBeGreaterThan(1.15);
    expect(result.suggestedWaterMl).toBeGreaterThan(baseWaterMl);
    expect(result.reason).toMatch(/Hot/i);
  });

  it('handles Heavy Rain on Outdoor plants: drastically reduces and recommends skip', () => {
    const result = evaluateFuzzyWatering({
      temp: 18,
      humidity: 85,
      rainMm: 12.0,
      environment: 'outdoor',
      droughtTolerance: 'medium',
      baseWaterMl,
    });

    expect(result.finalFuzzyFactor).toBeLessThan(0.5);
    expect(result.shouldSkipOrMinimal).toBe(true);
    expect(result.reason).toMatch(/Rain|reduced/i);
  });

  it('moderates adjustments for Indoor plants compared to Outdoor', () => {
    const outdoorResult = evaluateFuzzyWatering({
      temp: 35,
      humidity: 20,
      rainMm: 0,
      environment: 'outdoor',
      droughtTolerance: 'medium',
      baseWaterMl,
    });

    const indoorResult = evaluateFuzzyWatering({
      temp: 35,
      humidity: 20,
      rainMm: 0,
      environment: 'indoor',
      droughtTolerance: 'medium',
      baseWaterMl,
    });

    // Indoor factor should be buffered closer to 1.0 than outdoor
    expect(indoorResult.finalFuzzyFactor).toBeLessThan(outdoorResult.finalFuzzyFactor);
    expect(indoorResult.suggestedWaterMl).toBeLessThan(outdoorResult.suggestedWaterMl);
  });

  it('succulents (high drought tolerance) dampen heat increases', () => {
    const regularResult = evaluateFuzzyWatering({
      temp: 33,
      humidity: 30,
      rainMm: 0,
      environment: 'balcony',
      droughtTolerance: 'medium',
      baseWaterMl,
    });

    const succulentResult = evaluateFuzzyWatering({
      temp: 33,
      humidity: 30,
      rainMm: 0,
      environment: 'balcony',
      droughtTolerance: 'high',
      baseWaterMl,
    });

    expect(succulentResult.finalFuzzyFactor).toBeLessThan(regularResult.finalFuzzyFactor);
  });

  it('rounds suggested water to nearest 10 ml', () => {
    const result = evaluateFuzzyWatering({
      temp: 23,
      humidity: 45,
      rainMm: 0,
      environment: 'indoor',
      droughtTolerance: 'medium',
      baseWaterMl: 255,
    });

    expect(result.suggestedWaterMl % 10).toBe(0);
  });

  it('provides comprehensive explanation trace for UI transparency panel', () => {
    const result = evaluateFuzzyWatering({
      temp: 22,
      humidity: 48,
      rainMm: 0.5,
      environment: 'indoor',
      droughtTolerance: 'medium',
      baseWaterMl: 300,
    });

    expect(result.explanation).toBeDefined();
    expect(result.explanation.memberships.temperature).toBeDefined();
    expect(result.explanation.rulesTriggered.length).toBeGreaterThan(0);
    expect(result.explanation.defuzzification.centroidFactor).toBeGreaterThan(0);
  });
});
