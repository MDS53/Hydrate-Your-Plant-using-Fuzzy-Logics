import React, { useState, useEffect } from 'react';
import { PlantSummary } from '../types/index.js';
import { apiRequest } from '../api/client.js';
import {
  X,
  Droplet,
  CloudSun,
  Sparkles,
  User,
  Check,
  AlertCircle,
  Thermometer,
  Wind,
  CloudRain,
  Flame,
  ArrowRight,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface WaterNowModalProps {
  isOpen: boolean;
  onClose: () => void;
  plant: PlantSummary;
  defaultUserName?: string;
  onSuccess: () => void;
}

export const WaterNowModal: React.FC<WaterNowModalProps> = ({
  isOpen,
  onClose,
  plant,
  defaultUserName = 'Sophia Botanica',
  onSuccess,
}) => {
  const [personName, setPersonName] = useState(defaultUserName);
  const [pourAmount, setPourAmount] = useState<number>(plant.todaySuggestion.suggestedMl);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPourAmount(plant.todaySuggestion.suggestedMl);
      setPersonName(defaultUserName || 'Sophia Botanica');
      setError(null);
    }
  }, [isOpen, plant, defaultUserName]);

  if (!isOpen) return null;

  const baseMl = plant.baseWaterMl || plant.todaySuggestion.baseMl || 300;
  const suggestedMl = plant.todaySuggestion.suggestedMl || baseMl;
  const diffMl = suggestedMl - baseMl;
  const fuzzyFactor = plant.todaySuggestion.fuzzyFactor || 1.0;

  // Determine Verbal Suggestion in words
  let verbalWord = plant.todaySuggestion.verbalSuggestion;
  if (!verbalWord) {
    if (diffMl < -75) verbalWord = 'Drastically reduce water (minimal pour)';
    else if (diffMl < -25) verbalWord = 'Reduce it moderately';
    else if (diffMl < -5) verbalWord = 'Reduce it slightly';
    else if (diffMl <= 5) verbalWord = 'Maintain standard hydration';
    else if (diffMl <= 25) verbalWord = 'Increase it slightly';
    else if (diffMl <= 75) verbalWord = 'Increase it moderately';
    else verbalWord = 'Substantially increase water';
  }

  // Determine Crisp text in brackets
  let crispBracket = plant.todaySuggestion.crispBracketText;
  if (!crispBracket) {
    if (diffMl < 0) {
      crispBracket = `[Reduce by ${Math.abs(diffMl)} ml, Crisp target: ${suggestedMl} ml]`;
    } else if (diffMl > 0) {
      crispBracket = `[Increase by ${diffMl} ml, Crisp target: ${suggestedMl} ml]`;
    } else {
      crispBracket = `[Standard pour, Crisp target: ${suggestedMl} ml]`;
    }
  }

  // Weather snapshot
  const badge = plant.todaySuggestion.badge;
  const weatherSnap = plant.todaySuggestion.weatherSnapshot;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personName.trim()) {
      setError('Please mention your name before confirming!');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await apiRequest(`/plants/${plant.id}/water-now`, {
        method: 'POST',
        body: JSON.stringify({
          amountMl: pourAmount,
          personName: personName.trim(),
          notes: notes.trim() || undefined,
        }),
      });

      confetti({
        particleCount: 55,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#22c55e', '#38bdf8', '#a3e635', '#f59e0b', '#ec4899'],
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record watering session');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="glass-card w-full max-w-lg rounded-3xl p-6 sm:p-7 shadow-2xl border border-emerald-500/30 relative max-h-[92vh] overflow-y-auto space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: Plant Name & Close */}
        <div className="flex items-start justify-between gap-3 border-b border-stone-200/80 dark:border-emerald-900/50 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-3xl shadow-inner select-none">
              {plant.emoji || '🌿'}
            </div>
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                Log Plant Watering
              </span>
              <h2 className="text-xl font-black text-stone-900 dark:text-emerald-50 leading-tight">
                {plant.name}
              </h2>
              <span className="text-xs text-stone-500 dark:text-emerald-400/80 font-medium">
                {plant.location.city} &bull; {plant.pot.volumeL}L {plant.pot.material}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-emerald-950/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 1. Base Water Quantity & Current Weather Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Base Quantity */}
            <div className="p-4 rounded-2xl bg-stone-100/80 dark:bg-emerald-950/40 border border-stone-200/80 dark:border-emerald-900/40 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-stone-500 dark:text-emerald-400/80">
                <Droplet className="w-4 h-4 text-emerald-500" />
                <span>Base Water Quantity</span>
              </div>
              <div className="text-2xl font-black text-stone-900 dark:text-white font-mono">
                {baseMl} <span className="text-sm font-semibold text-stone-500 dark:text-emerald-400/70">ml</span>
              </div>
              <p className="text-[11px] text-stone-500 dark:text-emerald-400/60">
                Botanical standard for {plant.pot.volumeL}L pot
              </p>
            </div>

            {/* Weather Now */}
            <div className="p-4 rounded-2xl bg-sky-500/10 dark:bg-sky-950/30 border border-sky-500/20 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-sky-600 dark:text-sky-300">
                <CloudSun className="w-4 h-4 text-sky-500" />
                <span>Current Weather</span>
              </div>
              <div className="text-lg font-black text-stone-900 dark:text-sky-100 flex items-center gap-2">
                <span>{badge?.temp || `${weatherSnap?.temp || 18}°C`}</span>
                <span className="text-xs font-medium text-stone-500 dark:text-sky-300/80">
                  {badge?.emoji || '🌤️'}
                </span>
              </div>
              <p className="text-[11px] text-stone-500 dark:text-sky-300/80">
                {badge?.humidity || `${weatherSnap?.humidity || 50}%`} hum &bull; {badge?.rain || `${weatherSnap?.rainMm || 0}mm`} rain
              </p>
            </div>
          </div>

          {/* 2. Fuzzy Logic Recommendation Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-lime-500/15 border border-emerald-500/30 space-y-2 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-500 animate-spin" />
                <span>Fuzzy Logic Recommendation:</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-bold">
                Factor: {fuzzyFactor}x
              </span>
            </div>

            {/* Sassy/Verbal Advice in Words */}
            <div className="text-lg font-black text-stone-900 dark:text-emerald-100 leading-snug">
              👉 {verbalWord}
            </div>

            {/* Crisp Value Bracket */}
            <div className="text-xs font-mono font-black text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 dark:bg-emerald-950/60 p-2 rounded-xl border border-emerald-500/20">
              {crispBracket}
            </div>

            {/* Explanation Reason */}
            <p className="text-xs text-stone-600 dark:text-emerald-200/90 italic leading-relaxed pt-0.5">
              "{plant.todaySuggestion.reason}"
            </p>
          </div>

          {/* 3. Water Quantity To Pour Slider / Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-stone-700 dark:text-emerald-200 flex items-center gap-1.5">
                <Droplet className="w-3.5 h-3.5 text-emerald-500 fill-current" />
                <span>Water Volume to Pour (ml):</span>
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPourAmount(suggestedMl)}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/30 cursor-pointer"
                >
                  Fuzzy ({suggestedMl} ml)
                </button>
                <button
                  type="button"
                  onClick={() => setPourAmount(baseMl)}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-stone-200 dark:bg-emerald-950 text-stone-700 dark:text-emerald-400 hover:bg-stone-300 cursor-pointer"
                >
                  Base ({baseMl} ml)
                </button>
              </div>
            </div>

            <input
              type="number"
              min="10"
              max="10000"
              step="10"
              required
              value={pourAmount}
              onChange={(e) => setPourAmount(Number(e.target.value))}
              className="w-full px-4 py-2.5 bg-stone-50 dark:bg-emerald-950/50 border border-stone-200 dark:border-emerald-800/60 rounded-xl text-base font-black text-stone-900 dark:text-emerald-100 font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {/* 4. Mention Your Name Input */}
          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-emerald-200 mb-1.5">
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-500" />
                <span>Mention your Name *</span>
              </span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g., Sophia Botanica, Alex Green, Lucas..."
              value={personName}
              onChange={(e) => setPersonName(e.target.value)}
              className="w-full px-4 py-2.5 bg-stone-50 dark:bg-emerald-950/50 border border-stone-200 dark:border-emerald-800/60 rounded-xl text-sm font-bold text-stone-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder:text-stone-400"
            />
            <span className="text-[11px] text-stone-500 dark:text-emerald-400/70 block mt-1">
              Your name will be credited on the care team leaderboard and streaks!
            </span>
          </div>

          {/* 5. Optional Notes */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-emerald-300 mb-1">
              Observations or Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g., Soil was very dry, pruned one yellow leaf..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 bg-stone-50 dark:bg-emerald-950/30 border border-stone-200 dark:border-emerald-900/60 rounded-xl text-xs text-stone-800 dark:text-emerald-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 rounded-xl border border-stone-300 dark:border-emerald-800/60 text-xs font-bold text-stone-700 dark:text-emerald-300 hover:bg-stone-100 dark:hover:bg-emerald-950 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-2 py-3 px-5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-lime-500 hover:from-emerald-600 hover:to-teal-600 text-white font-black text-xs shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Recording Pour...</span>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Submit & Confirm Water Pour</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
