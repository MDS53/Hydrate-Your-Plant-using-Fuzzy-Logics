import { triangular, shoulderLeft, shoulderRight } from './membership.js';

export type TemperatureSet = 'Freezing' | 'Cold' | 'Cool' | 'Mild' | 'Warm' | 'Hot' | 'ScorchingHot';
export type HumiditySet = 'Dry' | 'Comfortable' | 'Humid';
export type RainSet = 'None' | 'Light' | 'Heavy';
export type WaterConsequent = 'Skip' | 'VeryLow' | 'Low' | 'Normal' | 'High' | 'VeryHigh';

/**
 * Temperature membership evaluations:
 * Freezing: <= 2°C full membership, tapering off by 5°C
 * Cold: 2°C to 12°C, peak at 7°C
 * Cool: 9°C to 19°C, peak at 14°C
 * Mild: 16°C to 24°C, peak at 20°C
 * Warm: 21°C to 29°C, peak at 25°C
 * Hot: 26°C to 36°C, peak at 31°C
 * ScorchingHot: >= 33°C, full membership by 38°C
 */
export function getTemperatureMemberships(temp: number): Record<TemperatureSet, number> {
  return {
    Freezing: shoulderLeft(temp, 2, 5),
    Cold: triangular(temp, 2, 7, 13),
    Cool: triangular(temp, 9, 14, 19),
    Mild: triangular(temp, 16, 20.5, 25),
    Warm: triangular(temp, 21, 25.5, 30),
    Hot: triangular(temp, 27, 32, 37),
    ScorchingHot: shoulderRight(temp, 33, 38),
  };
}

/**
 * Relative humidity membership evaluations:
 * Dry: < 40% (peak <= 25%)
 * Comfortable: 35% - 70% (peak 52.5%)
 * Humid: > 60% (peak >= 80%)
 */
export function getHumidityMemberships(humidity: number): Record<HumiditySet, number> {
  return {
    Dry: shoulderLeft(humidity, 28, 42),
    Comfortable: triangular(humidity, 35, 52.5, 70),
    Humid: shoulderRight(humidity, 60, 80),
  };
}

/**
 * Rain precipitation membership evaluations (mm in 24h):
 * None: <= 0.2mm
 * Light: 0.2mm - 6mm
 * Heavy: >= 4.5mm
 */
export function getRainMemberships(rainMm: number): Record<RainSet, number> {
  return {
    None: shoulderLeft(rainMm, 0.2, 1.2),
    Light: triangular(rainMm, 0.4, 3.0, 7.0),
    Heavy: shoulderRight(rainMm, 4.5, 9.0),
  };
}

/**
 * Output factor membership values over domain factor in [0.0, 1.5]
 * Output factors:
 * Skip: ~ 0.0 - 0.15
 * VeryLow: ~ 0.3 (0.15 - 0.5)
 * Low: ~ 0.65 (0.45 - 0.85)
 * Normal: ~ 1.0 (0.8 - 1.2)
 * High: ~ 1.2 (1.05 - 1.35)
 * VeryHigh: ~ 1.4 (1.25 - 1.5)
 */
export function getConsequentMembership(consequent: WaterConsequent, factor: number): number {
  switch (consequent) {
    case 'Skip':
      return shoulderLeft(factor, 0.05, 0.2);
    case 'VeryLow':
      return triangular(factor, 0.1, 0.32, 0.55);
    case 'Low':
      return triangular(factor, 0.45, 0.68, 0.88);
    case 'Normal':
      return triangular(factor, 0.8, 1.0, 1.2);
    case 'High':
      return triangular(factor, 1.05, 1.22, 1.38);
    case 'VeryHigh':
      return shoulderRight(factor, 1.22, 1.45);
  }
}
