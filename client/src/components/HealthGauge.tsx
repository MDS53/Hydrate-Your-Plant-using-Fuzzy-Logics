import React from 'react';
import { HealthScore } from '../types/index.js';

interface HealthGaugeProps {
  health: HealthScore;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
}

export const HealthGauge: React.FC<HealthGaugeProps> = ({
  health,
  size = 'md',
  showDetails = false,
}) => {
  const { score, label, emoji, color, breakdown } = health;

  // SVG dimensions
  const dimensions = size === 'sm' ? 64 : size === 'lg' ? 140 : 96;
  const strokeWidth = size === 'sm' ? 6 : size === 'lg' ? 12 : 9;
  const radius = (dimensions - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative inline-flex items-center justify-center">
        <svg
          width={dimensions}
          height={dimensions}
          className="transform -rotate-90 transition-all duration-700 ease-out"
        >
          {/* Background circle */}
          <circle
            cx={dimensions / 2}
            cy={dimensions / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-stone-200 dark:text-stone-800"
            fill="transparent"
          />
          {/* Progress circle */}
          <circle
            cx={dimensions / 2}
            cy={dimensions / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className={size === 'sm' ? 'text-base' : size === 'lg' ? 'text-3xl' : 'text-xl'}>
            {emoji}
          </span>
          <span
            className={`font-bold tracking-tight text-stone-900 dark:text-white ${
              size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-xl' : 'text-sm'
            }`}
          >
            {score}%
          </span>
        </div>
      </div>

      <div className="mt-1 text-center">
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
          style={{ backgroundColor: `${color}18`, color }}
        >
          {label}
        </span>
      </div>

      {showDetails && breakdown && (
        <div className="w-full mt-3 pt-3 border-t border-stone-200 dark:border-stone-800 text-[11px] text-stone-500 dark:text-stone-400 space-y-1">
          <div className="flex justify-between">
            <span>Consistency:</span>
            <span className="font-medium text-stone-700 dark:text-stone-300">{breakdown.consistencyPoints}/40</span>
          </div>
          <div className="flex justify-between">
            <span>Punctuality:</span>
            <span className="font-medium text-stone-700 dark:text-stone-300">{breakdown.punctualityPoints}/30</span>
          </div>
          <div className="flex justify-between">
            <span>Fuzzy Adherence:</span>
            <span className="font-medium text-stone-700 dark:text-stone-300">{breakdown.adherencePoints}/30</span>
          </div>
        </div>
      )}
    </div>
  );
};
