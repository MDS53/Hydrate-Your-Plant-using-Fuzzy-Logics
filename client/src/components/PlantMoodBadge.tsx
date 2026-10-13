import React, { useState } from 'react';
import { Info, CheckCircle2, AlertCircle, Droplets, Leaf } from 'lucide-react';

interface PlantMoodBadgeProps {
  plantName: string;
  species?: string;
  healthScore: number;
  isDueToday: boolean;
  suggestedMl: number;
  baseMl: number;
  reason?: string;
}

interface BotanicalStatus {
  title: string;
  colorClass: string;
  badgeBorder: string;
  insights: string[];
}

export const getBotanicalStatus = (
  species: string = '',
  healthScore: number,
  isDueToday: boolean,
  suggestedMl: number,
  baseMl: number
): BotanicalStatus => {
  const isSucculent = /cactus|succulent|aloe|sansevieria|snake plant|jade/i.test(species);
  const isSensitive = /calathea|ficus|fiddle|fern|peace lily|orchid/i.test(species);

  if (isDueToday || suggestedMl > baseMl * 1.25) {
    return {
      title: 'Hydration Required',
      colorClass: 'bg-amber-100/80 dark:bg-stone-800 text-amber-950 dark:text-stone-200',
      badgeBorder: 'border-amber-400 dark:border-amber-600/70',
      insights: [
        'Substrate moisture has depleted below target threshold. Watering recommended.',
        'Elevated ambient temperatures have increased transpiration rate.',
        'Root zone moisture requires replenishment according to pot volume.',
      ],
    };
  }

  if (suggestedMl < baseMl * 0.75) {
    return {
      title: 'Moisture Retentive',
      colorClass: 'bg-sky-100/80 dark:bg-stone-800 text-sky-950 dark:text-stone-200',
      badgeBorder: 'border-sky-300 dark:border-slate-600/70',
      insights: [
        'Recent humidity or precipitation indicates sufficient soil moisture.',
        'Transpiration rate is currently low; postpone watering to avoid saturation.',
        'Substrate moisture is adequate; await next scheduled cycle.',
      ],
    };
  }

  if (isSucculent) {
    return {
      title: 'Drought Adapted',
      colorClass: 'bg-emerald-100/80 dark:bg-stone-800 text-emerald-950 dark:text-stone-200',
      badgeBorder: 'border-emerald-400 dark:border-emerald-600/50',
      insights: [
        'Arid species; efficiently stores water in specialized tissue.',
        'Requires extended dry intervals between water applications.',
        'Soil aeration and drainage remain optimal.',
      ],
    };
  }

  if (isSensitive) {
    return {
      title: 'Delicate Foliage',
      colorClass: 'bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-200',
      badgeBorder: 'border-stone-400 dark:border-stone-600',
      insights: [
        'Sensitive foliage; maintain steady soil moisture and avoid extremes.',
        'Prone to humidity fluctuations; follow calibrated volume recommendations.',
        'Inspect topsoil condition before executing scheduled pours.',
      ],
    };
  }

  if (healthScore >= 85) {
    return {
      title: 'Optimal Vitality',
      colorClass: 'bg-emerald-100/90 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200',
      badgeBorder: 'border-emerald-400 dark:border-emerald-600/60',
      insights: [
        'Chlorophyll synthesis and hydration are in optimal equilibrium.',
        'Foliage turgidity and transpiration indicate excellent vitality.',
        'Balanced moisture uptake supporting steady vegetative development.',
      ],
    };
  }

  return {
    title: 'Healthy & Balanced',
    colorClass: 'bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-200',
    badgeBorder: 'border-stone-300 dark:border-stone-700',
    insights: [
      'Steady vegetative condition with balanced hydration levels.',
      'Moisture levels remain aligned with current environmental conditions.',
      'Routine watering schedule is sufficient for ongoing maintenance.',
    ],
  };
};

export const PlantMoodBadge: React.FC<PlantMoodBadgeProps> = ({
  plantName,
  species,
  healthScore,
  isDueToday,
  suggestedMl,
  baseMl,
}) => {
  const status = getBotanicalStatus(species, healthScore, isDueToday, suggestedMl, baseMl);
  const [insightIndex, setInsightIndex] = useState(0);
  const [showBubble, setShowBubble] = useState(false);

  const handleNextInsight = (e: React.MouseEvent) => {
    e.stopPropagation();
    setInsightIndex((prev) => (prev + 1) % status.insights.length);
    setShowBubble(true);
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={handleNextInsight}
        className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer select-none shadow-2xs ${status.colorClass} ${status.badgeBorder}`}
        title="Click to view botanical status observation"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-700 dark:bg-emerald-400" />
        <span className="text-[11px] font-bold tracking-tight">
          {status.title}
        </span>
        <Info className="w-3 h-3 text-stone-400 group-hover:text-stone-600 transition-colors ml-0.5" />
      </button>

      {/* Botanical Observation Popover */}
      {showBubble && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setShowBubble(false);
          }}
          className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 rounded-xl bg-stone-900/95 dark:bg-stone-900/95 text-stone-100 text-xs border border-stone-700 shadow-xl backdrop-blur-md animate-in fade-in duration-150 cursor-pointer"
        >
          <div className="flex items-start gap-2">
            <Leaf className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-[11px] text-stone-300">
                Botanical Status &bull; {status.title}
              </p>
              <p className="text-[11px] leading-relaxed mt-1 text-stone-200">
                {status.insights[insightIndex]}
              </p>
            </div>
          </div>
          <div className="mt-2 text-[10px] text-stone-400 text-right">
            Click to cycle observation / dismiss
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-stone-900/95" />
        </div>
      )}
    </div>
  );
};
