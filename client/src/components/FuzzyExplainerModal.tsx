import React from 'react';
import { FuzzyTrace, TodaySuggestion } from '../types/index.js';
import { X, Sparkles, CheckCircle, Sliders, ArrowRight } from 'lucide-react';

interface FuzzyExplainerModalProps {
  isOpen: boolean;
  onClose: () => void;
  plantName: string;
  plantEmoji: string;
  todaySuggestion: TodaySuggestion;
  fuzzyTrace?: FuzzyTrace;
}

export const FuzzyExplainerModal: React.FC<FuzzyExplainerModalProps> = ({
  isOpen,
  onClose,
  plantName,
  plantEmoji,
  todaySuggestion,
  fuzzyTrace,
}) => {
  if (!isOpen) return null;

  const { suggestedMl, baseMl, reason, fuzzyFactor, badge } = todaySuggestion;
  const percentDiff = Math.round((fuzzyFactor - 1.0) * 100);

  // Fallback crisp inputs if fuzzyTrace not fully populated
  const crisp = fuzzyTrace?.crispInputs || {
    temp: parseFloat(badge.temp) || 20,
    humidity: parseFloat(badge.humidity) || 50,
    rainMm: parseFloat(badge.rain) || 0,
    environment: 'indoor',
    droughtTolerance: 'medium',
    potMaterial: 'plastic',
  };

  const memberships = fuzzyTrace?.memberships;
  const rulesFired = fuzzyTrace?.rulesFired || [
    'IF temp is Mild AND humidity is Comfortable THEN water is Normal',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md px-6 py-4 border-b border-stone-200/80 dark:border-stone-800 flex items-center justify-between z-10">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{plantEmoji}</span>
            <div>
              <h3 className="font-bold text-lg text-stone-900 dark:text-stone-100 flex items-center gap-2">
                How was this calculated?
                <Sparkles className="w-4 h-4 text-emerald-500" />
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Fuzzy Logic Hydration Engine for {plantName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Top Result Banner */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-5 text-center">
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              Final Suggested Water
            </div>
            <div className="text-4xl font-black text-emerald-700 dark:text-emerald-300 my-1">
              {suggestedMl} ml
            </div>
            <div className="text-sm font-semibold text-emerald-800/80 dark:text-emerald-400">
              Base: {baseMl} ml &bull; {percentDiff >= 0 ? `+${percentDiff}%` : `${percentDiff}%`} adjustment factor ({fuzzyFactor}×)
            </div>
            <p className="mt-2 text-xs text-emerald-900 dark:text-emerald-200 italic">
              "{reason}"
            </p>
          </div>

          {/* Step 1: Crisp Weather Inputs */}
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-stone-900 dark:text-stone-100 mb-3">
              <span className="w-6 h-6 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 flex items-center justify-center text-xs font-extrabold">1</span>
              <span>Crisp Environmental Inputs</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div className="bg-stone-50 dark:bg-stone-800/60 p-3 rounded-xl border border-stone-200/60 dark:border-stone-800">
                <span className="text-[11px] text-stone-500 block">Air Temperature</span>
                <span className="text-base font-bold text-stone-900 dark:text-stone-100">{crisp.temp}°C</span>
              </div>
              <div className="bg-stone-50 dark:bg-stone-800/60 p-3 rounded-xl border border-stone-200/60 dark:border-stone-800">
                <span className="text-[11px] text-stone-500 block">Relative Humidity</span>
                <span className="text-base font-bold text-stone-900 dark:text-stone-100">{crisp.humidity}%</span>
              </div>
              <div className="bg-stone-50 dark:bg-stone-800/60 p-3 rounded-xl border border-stone-200/60 dark:border-stone-800">
                <span className="text-[11px] text-stone-500 block">Precipitation (24h)</span>
                <span className="text-base font-bold text-stone-900 dark:text-stone-100">{crisp.rainMm} mm</span>
              </div>
              <div className="bg-stone-50 dark:bg-stone-800/60 p-3 rounded-xl border border-stone-200/60 dark:border-stone-800">
                <span className="text-[11px] text-stone-500 block">Environment</span>
                <span className="text-sm font-bold capitalize text-stone-900 dark:text-stone-100">{crisp.environment}</span>
              </div>
              <div className="bg-stone-50 dark:bg-stone-800/60 p-3 rounded-xl border border-stone-200/60 dark:border-stone-800">
                <span className="text-[11px] text-stone-500 block">Drought Tolerance</span>
                <span className="text-sm font-bold capitalize text-stone-900 dark:text-stone-100">{crisp.droughtTolerance}</span>
              </div>
              <div className="bg-stone-50 dark:bg-stone-800/60 p-3 rounded-xl border border-stone-200/60 dark:border-stone-800">
                <span className="text-[11px] text-stone-500 block">Pot Material</span>
                <span className="text-sm font-bold capitalize text-stone-900 dark:text-stone-100">{crisp.potMaterial}</span>
              </div>
            </div>
          </div>

          {/* Step 2: Fuzzification (Active Sets) */}
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-stone-900 dark:text-stone-100 mb-3">
              <span className="w-6 h-6 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 flex items-center justify-center text-xs font-extrabold">2</span>
              <span>Fuzzification Membership Degrees [0.0 - 1.0]</span>
            </div>
            
            {memberships ? (
              <div className="space-y-2.5 text-xs">
                {/* Temperature Sets */}
                <div className="bg-stone-50 dark:bg-stone-800/40 p-3 rounded-xl border border-stone-200/50 dark:border-stone-800">
                  <div className="font-semibold text-stone-700 dark:text-stone-300 mb-2">Temperature Fuzzy Sets:</div>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(memberships.temperature)
                      .filter(([_, degree]) => degree > 0)
                      .map(([set, degree]) => (
                        <div key={set} className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span>{set}</span>
                            <span className="font-mono font-bold text-emerald-600">{(degree * 100).toFixed(0)}%</span>
                          </div>
                          <div className="w-full bg-stone-200 dark:bg-stone-700 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${degree * 100}%` }} />
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Humidity & Rain */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-stone-50 dark:bg-stone-800/40 p-3 rounded-xl border border-stone-200/50 dark:border-stone-800">
                    <div className="font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Humidity Sets:</div>
                    {Object.entries(memberships.humidity)
                      .filter(([_, d]) => d > 0)
                      .map(([set, degree]) => (
                        <div key={set} className="flex justify-between text-[11px] py-0.5">
                          <span>{set}:</span>
                          <span className="font-mono font-bold text-sky-600">{(degree * 100).toFixed(0)}%</span>
                        </div>
                      ))}
                  </div>
                  <div className="bg-stone-50 dark:bg-stone-800/40 p-3 rounded-xl border border-stone-200/50 dark:border-stone-800">
                    <div className="font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Rain Sets:</div>
                    {Object.entries(memberships.rain)
                      .filter(([_, d]) => d > 0)
                      .map(([set, degree]) => (
                        <div key={set} className="flex justify-between text-[11px] py-0.5">
                          <span>{set}:</span>
                          <span className="font-mono font-bold text-blue-600">{(degree * 100).toFixed(0)}%</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-stone-500">Live membership sets evaluated based on {crisp.temp}°C and {crisp.humidity}% humidity.</p>
            )}
          </div>

          {/* Step 3: Triggered Rules */}
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-stone-900 dark:text-stone-100 mb-3">
              <span className="w-6 h-6 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 flex items-center justify-center text-xs font-extrabold">3</span>
              <span>Triggered Fuzzy Inference Rules</span>
            </div>
            <div className="space-y-2">
              {rulesFired.map((rule, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 p-3 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200/60 dark:border-stone-800 text-xs"
                >
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span className="font-mono text-stone-800 dark:text-stone-200">{rule}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Step 4: Defuzzification & Calculation Breakdown */}
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-stone-900 dark:text-stone-100 mb-3">
              <span className="w-6 h-6 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 flex items-center justify-center text-xs font-extrabold">4</span>
              <span>Centroid Defuzzification & Water Math</span>
            </div>
            <div className="bg-stone-100/80 dark:bg-stone-800/80 p-4 rounded-xl space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-stone-600 dark:text-stone-400">Centroid factor:</span>
                <span className="font-bold text-stone-900 dark:text-stone-100">{fuzzyFactor}×</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-600 dark:text-stone-400">Base water pour:</span>
                <span className="font-bold text-stone-900 dark:text-stone-100">{baseMl} ml</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-stone-200 dark:border-stone-700 text-emerald-700 dark:text-emerald-400 font-bold">
                <span className="flex items-center gap-1.5">
                  Suggested pour <ArrowRight className="w-3.5 h-3.5" />
                </span>
                <span>{suggestedMl} ml</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-stone-50 dark:bg-stone-800/50 border-t border-stone-200/80 dark:border-stone-800 text-right">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-xs"
          >
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  );
};
