import { WaterConsequent, getConsequentMembership } from './sets.js';

export interface ConsequentStrengths {
  Skip: number;
  VeryLow: number;
  Low: number;
  Normal: number;
  High: number;
  VeryHigh: number;
}

/**
 * Centroid defuzzification using Mamdani min implication and max aggregation.
 * Domain: x in [0.0, 1.5]
 */
export function centroidDefuzzify(
  strengths: ConsequentStrengths,
  steps: number = 300
): { factor: number; totalArea: number } {
  const minX = 0.0;
  const maxX = 1.5;
  const dx = (maxX - minX) / steps;

  let numerator = 0;
  let denominator = 0;

  const consequents: WaterConsequent[] = ['Skip', 'VeryLow', 'Low', 'Normal', 'High', 'VeryHigh'];

  for (let i = 0; i <= steps; i++) {
    const x = minX + i * dx;

    // Aggregated membership at x
    let aggregatedMu = 0;
    for (const c of consequents) {
      const alpha = strengths[c];
      if (alpha > 0) {
        const setMu = getConsequentMembership(c, x);
        const clippedMu = Math.min(alpha, setMu);
        if (clippedMu > aggregatedMu) {
          aggregatedMu = clippedMu;
        }
      }
    }

    numerator += x * aggregatedMu * dx;
    denominator += aggregatedMu * dx;
  }

  if (denominator === 0) {
    return { factor: 1.0, totalArea: 0 };
  }

  const factor = numerator / denominator;
  return { factor: Number(factor.toFixed(3)), totalArea: Number(denominator.toFixed(3)) };
}
