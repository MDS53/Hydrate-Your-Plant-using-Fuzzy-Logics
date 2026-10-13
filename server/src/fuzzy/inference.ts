import {
  TemperatureSet,
  HumiditySet,
  RainSet,
  WaterConsequent,
  getTemperatureMemberships,
  getHumidityMemberships,
  getRainMemberships,
} from './sets.js';
import { FUZZY_RULES, FuzzyRule } from './rules.js';
import { ConsequentStrengths } from './defuzzifier.js';

export interface RuleExecutionResult {
  ruleId: string;
  description: string;
  strength: number;
  consequent: WaterConsequent;
}

export interface InferenceResult {
  consequentStrengths: ConsequentStrengths;
  rulesFired: RuleExecutionResult[];
  activeConsequents: WaterConsequent[];
}

export function performMamdaniInference(
  tempMemberships: Record<TemperatureSet, number>,
  humidityMemberships: Record<HumiditySet, number>,
  rainMemberships: Record<RainSet, number>,
  context: { environment: 'indoor' | 'balcony' | 'outdoor'; droughtTolerance: 'low' | 'medium' | 'high' }
): InferenceResult {
  const consequentStrengths: ConsequentStrengths = {
    Skip: 0,
    VeryLow: 0,
    Low: 0,
    Normal: 0,
    High: 0,
    VeryHigh: 0,
  };

  const rulesFired: RuleExecutionResult[] = [];

  for (const rule of FUZZY_RULES) {
    const { strength, consequent } = rule.evaluate(
      tempMemberships,
      humidityMemberships,
      rainMemberships,
      context
    );

    if (strength > 0.01) {
      rulesFired.push({
        ruleId: rule.id,
        description: rule.description,
        strength: Number(strength.toFixed(3)),
        consequent,
      });

      // Mamdani aggregation for same consequent: max
      if (strength > consequentStrengths[consequent]) {
        consequentStrengths[consequent] = strength;
      }
    }
  }

  const activeConsequents = (Object.keys(consequentStrengths) as WaterConsequent[]).filter(
    (c) => consequentStrengths[c] > 0
  );

  return {
    consequentStrengths,
    rulesFired,
    activeConsequents,
  };
}
