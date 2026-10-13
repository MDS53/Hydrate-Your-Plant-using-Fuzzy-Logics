import React from 'react';
import { WeatherBadgeInfo } from '../types/index.js';
import { Thermometer, Droplets, CloudRain } from 'lucide-react';

interface WeatherBadgeProps {
  badge: WeatherBadgeInfo;
  className?: string;
  onClick?: () => void;
}

export const WeatherBadge: React.FC<WeatherBadgeProps> = ({ badge, className = '', onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 text-xs font-medium text-emerald-900 dark:text-emerald-200 shadow-2xs ${
        onClick ? 'cursor-pointer hover:bg-emerald-100/80 dark:hover:bg-emerald-900/60 transition-colors' : ''
      } ${className}`}
    >
      <span className="text-base select-none">{badge.emoji}</span>
      <div className="flex items-center gap-2.5">
        <span className="inline-flex items-center gap-1 font-semibold">
          <Thermometer className="w-3.5 h-3.5 text-rose-500" />
          {badge.temp}
        </span>
        <span className="text-emerald-300 dark:text-emerald-700">&bull;</span>
        <span className="inline-flex items-center gap-1">
          <Droplets className="w-3.5 h-3.5 text-sky-500" />
          {badge.humidity}
        </span>
        <span className="text-emerald-300 dark:text-emerald-700">&bull;</span>
        <span className="inline-flex items-center gap-1">
          <CloudRain className="w-3.5 h-3.5 text-blue-500" />
          {badge.rain}
        </span>
      </div>
    </div>
  );
};
