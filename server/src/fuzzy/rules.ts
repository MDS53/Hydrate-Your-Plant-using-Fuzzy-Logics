import { TemperatureSet, HumiditySet, RainSet, WaterConsequent } from './sets.js';

export interface FuzzyRule {
  id: string;
  description: string;
  evaluate: (
    temp: Record<TemperatureSet, number>,
    humidity: Record<HumiditySet, number>,
    rain: Record<RainSet, number>,
    context: { environment: 'indoor' | 'balcony' | 'outdoor'; droughtTolerance: 'low' | 'medium' | 'high' }
  ) => { strength: number; consequent: WaterConsequent };
}

export const FUZZY_RULES: FuzzyRule[] = [
  // 1. Freezing weather
  {
    id: 'R1_FREEZING',
    description: 'IF temp is Freezing THEN water is VeryLow',
    evaluate: (temp) => ({
      strength: temp.Freezing,
      consequent: 'VeryLow',
    }),
  },

  // 2. Cold and humid
  {
    id: 'R2_COLD_HUMID',
    description: 'IF temp is Cold AND humidity is Humid THEN water is Low',
    evaluate: (temp, humidity) => ({
      strength: Math.min(temp.Cold, humidity.Humid),
      consequent: 'Low',
    }),
  },

  // 3. Cold and comfortable or dry
  {
    id: 'R3_COLD_DRY',
    description: 'IF temp is Cold AND (humidity is Dry OR Comfortable) THEN water is Low',
    evaluate: (temp, humidity) => ({
      strength: Math.min(temp.Cold, Math.max(humidity.Dry, humidity.Comfortable)),
      consequent: 'Low',
    }),
  },

  // 4. Cool weather
  {
    id: 'R4_COOL',
    description: 'IF temp is Cool AND humidity is Humid THEN water is Low',
    evaluate: (temp, humidity) => ({
      strength: Math.min(temp.Cool, humidity.Humid),
      consequent: 'Low',
    }),
  },
  {
    id: 'R5_COOL_NORMAL',
    description: 'IF temp is Cool AND (humidity is Comfortable OR Dry) THEN water is Normal',
    evaluate: (temp, humidity) => ({
      strength: Math.min(temp.Cool, Math.max(humidity.Comfortable, humidity.Dry)),
      consequent: 'Normal',
    }),
  },

  // 5. Mild weather
  {
    id: 'R6_MILD_COMFORTABLE',
    description: 'IF temp is Mild AND humidity is Comfortable THEN water is Normal',
    evaluate: (temp, humidity) => ({
      strength: Math.min(temp.Mild, humidity.Comfortable),
      consequent: 'Normal',
    }),
  },
  {
    id: 'R7_MILD_DRY',
    description: 'IF temp is Mild AND humidity is Dry THEN water is High',
    evaluate: (temp, humidity) => ({
      strength: Math.min(temp.Mild, humidity.Dry),
      consequent: 'High',
    }),
  },
  {
    id: 'R8_MILD_HUMID',
    description: 'IF temp is Mild AND humidity is Humid THEN water is Normal',
    evaluate: (temp, humidity) => ({
      strength: Math.min(temp.Mild, humidity.Humid),
      consequent: 'Normal',
    }),
  },

  // 6. Warm weather
  {
    id: 'R9_WARM_DRY',
    description: 'IF temp is Warm AND humidity is Dry THEN water is High',
    evaluate: (temp, humidity) => ({
      strength: Math.min(temp.Warm, humidity.Dry),
      consequent: 'High',
    }),
  },
  {
    id: 'R10_WARM_COMFORTABLE',
    description: 'IF temp is Warm AND humidity is Comfortable THEN water is High',
    evaluate: (temp, humidity) => ({
      strength: Math.min(temp.Warm, humidity.Comfortable),
      consequent: 'High',
    }),
  },
  {
    id: 'R11_WARM_HUMID',
    description: 'IF temp is Warm AND humidity is Humid THEN water is Normal',
    evaluate: (temp, humidity) => ({
      strength: Math.min(temp.Warm, humidity.Humid),
      consequent: 'Normal',
    }),
  },

  // 7. Hot and Scorching Hot weather
  {
    id: 'R12_HOT_DRY_OR_NONE_RAIN',
    description: 'IF (temp is Hot OR ScorchingHot) AND rain is None THEN water is VeryHigh',
    evaluate: (temp, _h, rain) => ({
      strength: Math.min(Math.max(temp.Hot, temp.ScorchingHot), rain.None),
      consequent: 'VeryHigh',
    }),
  },
  {
    id: 'R13_HOT_DRY_HUMIDITY',
    description: 'IF (temp is Hot OR ScorchingHot) AND humidity is Dry THEN water is VeryHigh',
    evaluate: (temp, humidity) => ({
      strength: Math.min(Math.max(temp.Hot, temp.ScorchingHot), humidity.Dry),
      consequent: 'VeryHigh',
    }),
  },

  // 8. Rain impact for outdoor & balcony plants
  {
    id: 'R14_OUTDOOR_HEAVY_RAIN',
    description: 'IF rain is Heavy AND plant is Outdoor THEN water is Skip',
    evaluate: (_t, _h, rain, context) => ({
      strength: context.environment === 'outdoor' ? rain.Heavy : 0,
      consequent: 'Skip',
    }),
  },
  {
    id: 'R15_OUTDOOR_LIGHT_RAIN',
    description: 'IF rain is Light AND plant is Outdoor THEN water is Low',
    evaluate: (_t, _h, rain, context) => ({
      strength: context.environment === 'outdoor' ? rain.Light : 0,
      consequent: 'Low',
    }),
  },
  {
    id: 'R16_BALCONY_HEAVY_RAIN',
    description: 'IF rain is Heavy AND plant is Balcony THEN water is Low',
    evaluate: (_t, _h, rain, context) => ({
      strength: context.environment === 'balcony' ? rain.Heavy * 0.75 : 0,
      consequent: 'Low',
    }),
  },
];
