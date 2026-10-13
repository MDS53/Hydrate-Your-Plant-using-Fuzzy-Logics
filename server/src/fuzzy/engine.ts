import {
  getTemperatureMemberships,
  getHumidityMemberships,
  getRainMemberships,
  TemperatureSet,
  HumiditySet,
  RainSet,
} from './sets.js';
import { performMamdaniInference, RuleExecutionResult } from './inference.js';
import { centroidDefuzzify } from './defuzzifier.js';

export interface FuzzyCalculationInputs {
  temp: number; // Celsius
  humidity: number; // %
  rainMm: number; // mm in 24h
  environment: 'indoor' | 'balcony' | 'outdoor';
  droughtTolerance: 'low' | 'medium' | 'high';
  potMaterial?: 'plastic' | 'terracotta' | 'ceramic';
  baseWaterMl: number;
}

export interface FuzzyEngineOutput {
  rawFuzzyFactor: number;
  finalFuzzyFactor: number;
  suggestedWaterMl: number;
  baseWaterMl: number;
  shouldSkipOrMinimal: boolean;
  reason: string;
  badge: {
    temp: string;
    humidity: string;
    rain: string;
    emoji: string;
  };
  explanation: {
    inputs: {
      temp: number;
      humidity: number;
      rainMm: number;
      environment: 'indoor' | 'balcony' | 'outdoor';
      droughtTolerance: 'low' | 'medium' | 'high';
      potMaterial: string;
    };
    memberships: {
      temperature: Record<TemperatureSet, number>;
      humidity: Record<HumiditySet, number>;
      rain: Record<RainSet, number>;
    };
    rulesTriggered: RuleExecutionResult[];
    defuzzification: {
      centroidFactor: number;
      afterPlantContextDamping: number;
      finalRoundedFactor: number;
    };
  };
}

export function evaluateFuzzyWatering(inputs: FuzzyCalculationInputs): FuzzyEngineOutput {
  const {
    temp,
    humidity,
    rainMm,
    environment = 'indoor',
    droughtTolerance = 'medium',
    potMaterial = 'plastic',
    baseWaterMl,
  } = inputs;

  // 1. Fuzzification
  const tempMemberships = getTemperatureMemberships(temp);
  const humidityMemberships = getHumidityMemberships(humidity);
  const rainMemberships = getRainMemberships(rainMm);

  // 2. Mamdani Inference
  const inference = performMamdaniInference(
    tempMemberships,
    humidityMemberships,
    rainMemberships,
    { environment, droughtTolerance }
  );

  // 3. Defuzzification (Centroid)
  const { factor: rawCentroidFactor } = centroidDefuzzify(inference.consequentStrengths);

  // 4. Plant Context Adjustments
  let adjustedFactor = rawCentroidFactor;

  // Drought tolerance (succulents / desert plants vs moisture lovers)
  if (droughtTolerance === 'high') {
    // Succulent: dampen increases by 60%, amplify decreases by 35%
    if (adjustedFactor > 1.0) {
      adjustedFactor = 1.0 + (adjustedFactor - 1.0) * 0.4;
    } else {
      adjustedFactor = 1.0 - (1.0 - adjustedFactor) * 1.35;
    }
  } else if (droughtTolerance === 'low') {
    // Moisture lovers (ferns): boost increases slightly, dampen large cuts
    if (adjustedFactor > 1.0) {
      adjustedFactor = 1.0 + (adjustedFactor - 1.0) * 1.15;
    } else {
      adjustedFactor = 1.0 - (1.0 - adjustedFactor) * 0.75;
    }
  }

  // Environment Damping & Outdoor Rain Saturation
  let finalFactor = adjustedFactor;
  if (environment === 'indoor') {
    // Indoor plants are buffered by indoor climate control
    finalFactor = 1.0 + (adjustedFactor - 1.0) * 0.45;
  } else if (environment === 'balcony') {
    finalFactor = 1.0 + (adjustedFactor - 1.0) * 0.80;
    if (rainMm >= 5.0) {
      finalFactor *= 0.65; // partial wind-driven rain reach
    }
  } else {
    // Outdoor: 100% full exposure. Natural rain directly quenches plant soil!
    if (rainMm >= 4.0) {
      // Direct deduction for natural outdoor watering
      const rainOffset = Math.min(0.85, (rainMm / 10) * 0.8);
      finalFactor = Math.max(0.05, finalFactor * (1 - rainOffset));
    }
  }

  // Safety clamping between 0.05 and 1.6
  finalFactor = Math.max(0.05, Math.min(1.6, finalFactor));
  finalFactor = Number(finalFactor.toFixed(2));

  // 5. Calculate suggested volume in mL (round to nearest 10 ml)
  let suggestedWaterMl = Math.round((baseWaterMl * finalFactor) / 10) * 10;
  // Floor at minimum 10 ml
  suggestedWaterMl = Math.max(10, suggestedWaterMl);

  // Near-zero factor indicates freeze or heavy rain
  const shouldSkipOrMinimal =
    finalFactor <= 0.35 || (environment === 'outdoor' && rainMm >= 5.0) || temp <= 2.0;

  // 6. Generate human-friendly reason & badges
  const percentDiff = Math.round((finalFactor - 1.0) * 100);
  let reason = '';
  let emoji = '🌱';

  if (temp <= 2) {
    emoji = '❄️';
    reason = `Freezing weather (${temp}°C), reduced by ${Math.abs(percentDiff)}% to prevent root frost and rot`;
  } else if (environment === 'outdoor' && rainMm >= 4.5) {
    emoji = '🌧️';
    reason = `Heavy outdoor rainfall (${rainMm.toFixed(1)} mm), reduced by ${Math.abs(percentDiff)}%`;
  } else if (temp >= 28 && humidity <= 40) {
    emoji = '☀️';
    reason = `Hot and dry (${temp}°C, ${humidity}% humidity), increased by ${percentDiff}%`;
  } else if (temp >= 28) {
    emoji = '🌡️';
    reason = `Hot weather (${temp}°C), increased by ${percentDiff}%`;
  } else if (temp <= 12 && humidity >= 70) {
    emoji = '🌫️';
    reason = `Cold and humid (${temp}°C, ${humidity}% humidity), reduced by ${Math.abs(percentDiff)}%`;
  } else if (temp <= 14) {
    emoji = '🧤';
    reason = `Cool weather (${temp}°C), reduced by ${Math.abs(percentDiff)}%`;
  } else if (humidity <= 35) {
    emoji = '💨';
    reason = `Dry air (${humidity}% humidity), increased by ${percentDiff}%`;
  } else if (Math.abs(percentDiff) <= 5) {
    emoji = '✨';
    reason = `Mild conditions (${temp}°C, ${humidity}% humidity), standard watering`;
  } else if (percentDiff > 0) {
    emoji = '🌤️';
    reason = `Warm conditions (${temp}°C), increased by ${percentDiff}%`;
  } else {
    emoji = '🌿';
    reason = `Humid or cool conditions, reduced by ${Math.abs(percentDiff)}%`;
  }

  if (droughtTolerance === 'high') {
    reason += ' (succulent damped)';
  }

  return {
    rawFuzzyFactor: rawCentroidFactor,
    finalFuzzyFactor: finalFactor,
    suggestedWaterMl,
    baseWaterMl,
    shouldSkipOrMinimal,
    reason,
    badge: {
      temp: `${temp}°C`,
      humidity: `${humidity}%`,
      rain: `${rainMm.toFixed(1)} mm`,
      emoji,
    },
    explanation: {
      inputs: {
        temp,
        humidity,
        rainMm,
        environment,
        droughtTolerance,
        potMaterial,
      },
      memberships: {
        temperature: tempMemberships,
        humidity: humidityMemberships,
        rain: rainMemberships,
      },
      rulesTriggered: inference.rulesFired,
      defuzzification: {
        centroidFactor: rawCentroidFactor,
        afterPlantContextDamping: adjustedFactor,
        finalRoundedFactor: finalFactor,
      },
    },
  };
}
