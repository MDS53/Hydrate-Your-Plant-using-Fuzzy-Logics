import React, { useState } from 'react';
import { PlantSummary } from '../types/index.js';
import { HealthGauge } from './HealthGauge.js';
import { WeatherBadge } from './WeatherBadge.js';
import { FuzzyExplainerModal } from './FuzzyExplainerModal.js';
import { PlantMoodBadge } from './PlantMoodBadge.js';
import { WaterNowModal } from './WaterNowModal.js';
import { Calendar, HelpCircle, ArrowUpRight, Droplet, MapPin, Sparkles, Check, Clock } from 'lucide-react';
import confetti from 'canvas-confetti';
import { apiRequest } from '../api/client.js';

interface PlantCardProps {
  plant: PlantSummary;
  onOpen: (id: string) => void;
  onRefresh?: () => void;
}

export const PlantCard: React.FC<PlantCardProps> = ({ plant, onOpen, onRefresh }) => {
  const [showFuzzyModal, setShowFuzzyModal] = useState(false);
  const [showWaterModal, setShowWaterModal] = useState(false);
  const [wateredJustNow, setWateredJustNow] = useState(false);

  const {
    id,
    name,
    species,
    emoji,
    pot,
    location,
    environment,
    nextWateringDate,
    todaySuggestion,
    health,
  } = plant;

  // Format next watering date & time
  const formatNextDate = (dateStr: string | null) => {
    if (!dateStr) return 'No schedule set';
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const target = new Date(date);
    target.setHours(0, 0, 0, 0);

    const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const timeFormatted = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (diffDays === 0) return `Today (${timeFormatted}) 💦`;
    if (diffDays === 1) return `Tomorrow (${timeFormatted})`;
    if (diffDays === -1) return `Yesterday (${timeFormatted}) (Overdue! 🚨)`;
    if (diffDays < 0) return `${Math.abs(diffDays)} days ago (Overdue! 🚨)`;
    return `In ${diffDays} days (${date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} at ${timeFormatted})`;
  };

  const isTodayOrPast = Boolean(
    nextWateringDate && (
      new Date(nextWateringDate).getTime() <= Date.now() ||
      new Date(nextWateringDate).toDateString() === new Date().toDateString()
    )
  );
  const isScheduleDue = isTodayOrPast;
  const isWatered = Boolean(plant.isWateredToday || wateredJustNow);
  const canWater = Boolean(!isWatered && (isScheduleDue || plant.canWaterNow));
  const isToday = nextWateringDate && formatNextDate(nextWateringDate).includes('Today');
  const isOverdue = nextWateringDate && formatNextDate(nextWateringDate).includes('Overdue');

  const envColors: Record<string, string> = {
    indoor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    balcony: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    outdoor: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30',
  };


  return (
    <>
      <div
        className={`glass-card rounded-3xl p-5 hover:shadow-2xl hover:shadow-emerald-500/10 transition-all duration-300 flex flex-col justify-between group border relative overflow-hidden ${
          isOverdue
            ? 'border-orange-500/50 shadow-orange-500/10'
            : isToday
            ? 'border-emerald-500/40 hover:border-emerald-400/80 shadow-emerald-500/5'
            : 'border-stone-200/80 dark:border-emerald-950/60'
        }`}
      >
        {/* Subtle decorative glow orb */}
        <div className="absolute -top-16 -right-16 w-32 h-32 bg-emerald-500/10 dark:bg-emerald-400/10 rounded-full blur-2xl pointer-events-none group-hover:scale-150 transition-transform duration-500" />

        <div>
          {/* Header row: Emoji/photo, Title, Health Gauge */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-100 to-teal-50 dark:from-emerald-900/60 dark:to-teal-950/40 border border-emerald-300/60 dark:border-emerald-500/30 flex items-center justify-center text-3xl shadow-inner select-none cursor-pointer group-hover:scale-110 group-hover:rotate-6 transition-all duration-300"
                title="Click to see plant profile"
                onClick={() => onOpen(id)}
              >
                <span className="group-hover:animate-plant-wiggle inline-block">
                  {emoji || '🌿'}
                </span>
              </div>
              <div>
                <h3
                  onClick={() => onOpen(id)}
                  className="font-black text-lg text-stone-950 dark:text-emerald-50 leading-tight hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                >
                  {name}
                </h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span
                    className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                      envColors[environment] || envColors.indoor
                    }`}
                  >
                    {environment}
                  </span>
                  <span className="text-[11px] text-stone-600 dark:text-emerald-400/80 flex items-center gap-0.5 font-bold">
                    <MapPin className="w-3 h-3 text-emerald-600" />
                    {location.city}
                  </span>
                </div>
              </div>
            </div>

            {/* Health Mini Gauge */}
            <div className="shrink-0">
              <HealthGauge health={health} size="sm" />
            </div>
          </div>

          {/* Funny Attention-Grabbing Plant Personality Pill */}
          <div className="mt-3 flex items-center justify-between gap-2">
            <PlantMoodBadge
              plantName={name}
              species={species}
              healthScore={health.score}
              isDueToday={Boolean(isToday || isOverdue)}
              suggestedMl={todaySuggestion.suggestedMl}
              baseMl={todaySuggestion.baseMl}
              reason={todaySuggestion.reason}
            />

            <span className="text-[11px] font-mono text-stone-600 dark:text-emerald-500/70 font-semibold">
              {pot.volumeL}L {pot.material}
            </span>
          </div>

          {/* Today's Suggested Water with Base in Brackets */}
          <div className="mt-3.5 p-3.5 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-cyan-500/10 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-[#042016]/40 border border-emerald-500/25 dark:border-emerald-500/30 relative">
            <div className="flex items-center justify-between text-xs text-emerald-950 dark:text-emerald-300 font-extrabold mb-1">
              <span className="flex items-center gap-1.5">
                <Droplet className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600 animate-pulse" />
                <span>Today's Suggestion:</span>
              </span>
              <button
                type="button"
                onClick={() => setShowFuzzyModal(true)}
                className="text-[11px] text-emerald-800 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 flex items-center gap-1 font-black underline underline-offset-2"
                title="View how fuzzy logic engine calculated this"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Why?</span>
              </button>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-stone-950 dark:text-emerald-100 tracking-tight font-mono">
                {todaySuggestion.suggestedMl} ml
              </span>
              <span className="text-xs font-bold text-stone-600 dark:text-emerald-400/80">
                (base: {todaySuggestion.baseMl} ml)
              </span>
            </div>

            <p className="mt-1 text-xs text-stone-800 dark:text-emerald-200/90 leading-relaxed font-semibold">
              {todaySuggestion.reason}
            </p>

            <div className="mt-2.5">
              <WeatherBadge
                badge={todaySuggestion.badge}
                onClick={() => setShowFuzzyModal(true)}
              />
            </div>
          </div>

          {/* Next Watering Date Alert */}
          <div className="mt-3.5 flex items-center justify-between text-xs px-1">
            <span className="text-stone-700 dark:text-emerald-400/70 flex items-center gap-1.5 font-semibold">
              <Calendar className="w-3.5 h-3.5 text-emerald-500" />
              {isWatered ? 'Next Schedule:' : 'Next Watering:'}
            </span>
            <span
              className={`font-black px-2 py-0.5 rounded-full text-xs ${
                isOverdue
                  ? 'text-orange-600 dark:text-orange-400 bg-orange-500/15 border border-orange-500/30 animate-pulse'
                  : isWatered
                  ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/20 border border-emerald-500/30'
                  : isToday
                  ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/20 border border-emerald-500/30'
                  : 'text-stone-700 dark:text-emerald-200/90'
              }`}
            >
              {formatNextDate(nextWateringDate)}
            </span>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="mt-4 pt-3 border-t border-stone-200/60 dark:border-emerald-900/40 flex items-center gap-2">
          {/* Quick-Water Action Button - only enabled when water schedule time occurred exactly */}
          {isWatered ? (
            <button
              disabled
              className="flex-1 py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 cursor-not-allowed opacity-90 shadow-xs"
              title="This plant was already watered today! Next schedule is active."
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>Today Watered ✓</span>
            </button>
          ) : !canWater ? (
            <button
              disabled
              className="flex-1 py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all bg-stone-100 dark:bg-emerald-950/20 text-stone-400 dark:text-emerald-700/60 border border-stone-200/60 dark:border-emerald-900/30 cursor-not-allowed shadow-xs"
              title={
                nextWateringDate
                  ? `Watering schedule time has not occurred yet (${formatNextDate(nextWateringDate)}). Button unlocks at scheduled time.`
                  : 'No scheduled watering time is pending.'
              }
            >
              <Clock className="w-3.5 h-3.5 text-stone-400 dark:text-emerald-700/60" />
              <span>Scheduled</span>
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowWaterModal(true);
              }}
              className="flex-1 py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white shadow-md shadow-emerald-500/25 cursor-pointer"
              title="Water schedule time occurred! Click to log pour with fuzzy suggestion"
            >
              <Droplet className="w-3.5 h-3.5 fill-current animate-pulse" />
              <span>Water Now</span>
            </button>
          )}

          {/* Open Full Profile Button */}
          <button
            onClick={() => onOpen(id)}
            className="flex-1 py-2 px-3 rounded-xl bg-stone-900 text-white dark:bg-emerald-400 dark:text-[#04140e] text-xs font-black flex items-center justify-center gap-1.5 hover:bg-emerald-600 dark:hover:bg-emerald-300 transition-colors shadow-xs cursor-pointer"
          >
            <span>Profile</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Water Now Pop-up Modal with live fuzzy suggestion, crisp values, and name input */}
      <WaterNowModal
        isOpen={showWaterModal}
        onClose={() => setShowWaterModal(false)}
        plant={plant}
        onSuccess={() => {
          setWateredJustNow(true);
          if (onRefresh) onRefresh();
        }}
      />

      {/* Fuzzy Calculation Breakdown Modal */}
      <FuzzyExplainerModal
        isOpen={showFuzzyModal}
        onClose={() => setShowFuzzyModal(false)}
        plantName={name}
        plantEmoji={emoji}
        todaySuggestion={todaySuggestion}
      />
    </>
  );
};
