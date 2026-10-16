import React from 'react';
import { Pot } from '../types/index.js';
import { ShieldCheck, AlertTriangle, Layers, Ruler, Maximize2 } from 'lucide-react';

interface PotVolumePreviewProps {
  pot: Pot;
  onChange: (updated: Pot) => void;
  mode?: 'volume' | 'dimensions';
  onModeChange?: (mode: 'volume' | 'dimensions') => void;
}

interface PotPreset {
  id: 'small' | 'medium' | 'large';
  name: string;
  volumeL: number;
  diameterCm: number;
  heightCm: number;
  description: string;
  idealFor: string;
}

const POT_PRESETS: PotPreset[] = [
  {
    id: 'small',
    name: 'Small',
    volumeL: 1.0,
    diameterCm: 12,
    heightCm: 11,
    description: '1.0 L (Ø 12 × 11 cm)',
    idealFor: 'Succulents, herbs, tabletop pots',
  },
  {
    id: 'medium',
    name: 'Medium',
    volumeL: 3.5,
    diameterCm: 18,
    heightCm: 16,
    description: '3.5 L (Ø 18 × 16 cm)',
    idealFor: 'Foliage, pothos, snake plants, ferns',
  },
  {
    id: 'large',
    name: 'Large',
    volumeL: 10.0,
    diameterCm: 28,
    heightCm: 25,
    description: '10.0 L (Ø 28 × 25 cm)',
    idealFor: 'Monstera, ficus, floor plants & palms',
  },
];

export const PotVolumePreview: React.FC<PotVolumePreviewProps> = ({
  pot,
  onChange,
  mode = 'volume',
  onModeChange,
}) => {
  const { volumeL, diameterCm = 18, heightCm = 16, material, drainage } = pot;

  // Determine which preset matches current values (with tolerance)
  const matchingPreset = POT_PRESETS.find(
    (p) =>
      Math.abs(p.volumeL - volumeL) <= 0.3 &&
      Math.abs(p.diameterCm - diameterCm) <= 2 &&
      Math.abs(p.heightCm - heightCm) <= 2
  );

  const applyPreset = (preset: PotPreset) => {
    onChange({
      ...pot,
      volumeL: preset.volumeL,
      diameterCm: preset.diameterCm,
      heightCm: preset.heightCm,
    });
  };

  // Dimensions adjustment: recalculate volume
  const handleDimensionChange = (newDiameter: number, newHeight: number) => {
    // V = pi * r^2 * h / 1000 litres
    const radius = newDiameter / 2;
    const calculatedVolume = (Math.PI * Math.pow(radius, 2) * newHeight) / 1000;
    const roundedL = Number(Math.max(0.2, calculatedVolume).toFixed(1));

    onChange({
      ...pot,
      volumeL: roundedL,
      diameterCm: newDiameter,
      heightCm: newHeight,
    });
  };

  // Volume adjustment: scale dimensions proportionally
  const handleVolumeChange = (newVolume: number) => {
    // Standard nursery pot proportions: height ~ 0.88 * diameter
    // V = pi * (d/2)^2 * (0.88d) / 1000 = pi * 0.22 * d^3 / 1000 => d = cbrt(V * 1000 / (pi * 0.22))
    const approxD = Math.round(Math.cbrt((newVolume * 1000) / (Math.PI * 0.22)));
    const clampedD = Math.max(8, Math.min(50, approxD));
    const approxH = Math.max(8, Math.min(60, Math.round(clampedD * 0.88)));

    onChange({
      ...pot,
      volumeL: newVolume,
      diameterCm: clampedD,
      heightCm: approxH,
    });
  };

  const materialModifiers: Record<Pot['material'], { factor: string; label: string; desc: string }> = {
    plastic: { factor: '±0%', label: 'Plastic (Standard)', desc: 'Standard non-porous soil moisture retention' },
    terracotta: { factor: '+15%', label: 'Terracotta (Clay, +15%)', desc: 'Porous clay promotes natural evaporation' },
    ceramic: { factor: '-5%', label: 'Ceramic (Glazed, -5%)', desc: 'Glazed exterior retains moisture longer' },
  };

  return (
    <div className="bg-stone-50/90 dark:bg-stone-900/70 p-5 sm:p-6 rounded-2xl border border-stone-200 dark:border-stone-800 space-y-5">
      {/* Header & Size Preset Selection */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <label className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <span>Pot Size Selection</span>
            </label>
          </div>

          {onModeChange && (
            <div className="flex bg-stone-200/70 dark:bg-stone-800 p-0.5 rounded-lg text-xs font-medium self-start sm:self-auto">
              <button
                type="button"
                onClick={() => onModeChange('volume')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  mode === 'volume'
                    ? 'bg-white dark:bg-stone-700 text-emerald-800 dark:text-emerald-300 font-bold shadow-2xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                }`}
              >
                Volume (L)
              </button>
              <button
                type="button"
                onClick={() => onModeChange('dimensions')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  mode === 'dimensions'
                    ? 'bg-white dark:bg-stone-700 text-emerald-800 dark:text-emerald-300 font-bold shadow-2xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                }`}
              >
                Dimensions (cm)
              </button>
            </div>
          )}
        </div>

        {/* Small, Medium, Large Presets */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {POT_PRESETS.map((preset) => {
            const isSelected = matchingPreset?.id === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                  isSelected
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-700 dark:border-emerald-600 text-stone-900 dark:text-stone-100 shadow-sm ring-1 ring-emerald-700/30'
                    : 'bg-white dark:bg-stone-800/60 border-stone-200 dark:border-stone-700/80 text-stone-700 dark:text-stone-300 hover:border-emerald-600/50 hover:bg-stone-100/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm text-stone-900 dark:text-stone-100">
                    {preset.name}
                  </span>
                  <span
                    className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                      isSelected
                        ? 'bg-emerald-700 text-white dark:bg-emerald-600'
                        : 'bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300'
                    }`}
                  >
                    {preset.volumeL} L
                  </span>
                </div>
                <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-400 flex items-center gap-1">
                  <Ruler className="w-3 h-3 shrink-0" />
                  <span>Ø {preset.diameterCm} cm × {preset.heightCm} cm</span>
                </div>
                <div className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 line-clamp-1">
                  {preset.idealFor}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Live Sliders: Volume & Dimensions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center pt-2 border-t border-stone-200/80 dark:border-stone-800">
        <div className="space-y-4">
          {mode === 'volume' ? (
            <div>
              <div className="flex justify-between text-xs text-stone-700 dark:text-stone-300 mb-1.5 font-medium">
                <span className="flex items-center gap-1">
                  <Maximize2 className="w-3.5 h-3.5 text-stone-400" />
                  <span>Pot Volume:</span>
                </span>
                <span className="font-extrabold text-emerald-800 dark:text-emerald-400 text-sm">
                  {volumeL} Litres
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="25"
                step="0.5"
                value={volumeL}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-full accent-emerald-700 h-2 bg-stone-200 dark:bg-stone-800 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-stone-500 mt-1.5 font-medium">
                <span>0.5 L (Small desk)</span>
                <span>3.5 L (Medium)</span>
                <span>10 L (Large)</span>
                <span>25 L (Tree)</span>
              </div>
              <div className="mt-2 text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1">
                <span>Equivalent dimensions:</span>
                <strong className="text-stone-700 dark:text-stone-300 font-mono">
                  Ø {diameterCm} cm × {heightCm} cm
                </strong>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs text-stone-700 dark:text-stone-300 mb-1">
                  <span className="flex items-center gap-1">
                    <Ruler className="w-3.5 h-3.5 text-stone-400" />
                    <span>Pot Diameter:</span>
                  </span>
                  <span className="font-bold text-stone-900 dark:text-stone-100 font-mono">
                    {diameterCm} cm
                  </span>
                </div>
                <input
                  type="range"
                  min="8"
                  max="50"
                  step="1"
                  value={diameterCm}
                  onChange={(e) => handleDimensionChange(parseInt(e.target.value, 10), heightCm)}
                  className="w-full accent-emerald-700 h-2 bg-stone-200 dark:bg-stone-800 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-stone-700 dark:text-stone-300 mb-1">
                  <span className="flex items-center gap-1">
                    <Ruler className="w-3.5 h-3.5 text-stone-400" />
                    <span>Pot Height:</span>
                  </span>
                  <span className="font-bold text-stone-900 dark:text-stone-100 font-mono">
                    {heightCm} cm
                  </span>
                </div>
                <input
                  type="range"
                  min="8"
                  max="60"
                  step="1"
                  value={heightCm}
                  onChange={(e) => handleDimensionChange(diameterCm, parseInt(e.target.value, 10))}
                  className="w-full accent-emerald-700 h-2 bg-stone-200 dark:bg-stone-800 rounded-lg cursor-pointer"
                />
              </div>

              <div className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1">
                <span>Calculated volume:</span>
                <strong className="text-emerald-800 dark:text-emerald-400 font-mono text-xs">
                  {volumeL} Litres
                </strong>
              </div>
            </div>
          )}

          {/* Material & Drainage */}
          <div className="pt-3 border-t border-stone-200/80 dark:border-stone-800 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">
                Pot Material:
              </label>
              <select
                value={material}
                onChange={(e) => onChange({ ...pot, material: e.target.value as Pot['material'] })}
                className="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-semibold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-emerald-700 focus:outline-none"
              >
                <option value="plastic">Plastic (Standard retention)</option>
                <option value="terracotta">Terracotta (Clay, +15%)</option>
                <option value="ceramic">Ceramic (Glazed, -5%)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">
                Drainage Hole:
              </label>
              <button
                type="button"
                onClick={() => onChange({ ...pot, drainage: !drainage })}
                className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  drainage
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-300 border-stone-300 dark:border-stone-700'
                }`}
              >
                {drainage ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
                <span>{drainage ? 'Yes (Standard drainage)' : 'No hole (-20% water)'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Live Visual Graphic Preview with Dimensions Callout */}
        <div className="bg-white dark:bg-stone-800/80 rounded-2xl p-4 sm:p-5 border border-stone-200/80 dark:border-stone-700/80 flex flex-col items-center justify-center text-center shadow-2xs">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-2">
            Visual Geometry Preview
          </span>

          {/* Top diameter callout */}
          <div className="flex items-center gap-1 text-[11px] font-mono text-stone-500 mb-1">
            <span className="text-stone-400">←</span>
            <span className="font-bold text-stone-700 dark:text-stone-300">Ø {diameterCm} cm</span>
            <span className="text-stone-400">→</span>
          </div>

          {/* Pot Graphic with Height Callout */}
          <div className="relative my-2 flex items-center justify-center gap-3">
            <div
              className={`rounded-b-2xl border-2 transition-all duration-300 relative flex items-end justify-center ${
                material === 'terracotta'
                  ? 'bg-amber-100/90 border-amber-700 dark:bg-amber-950/40 dark:border-amber-600'
                  : material === 'ceramic'
                  ? 'bg-slate-100 border-slate-600 dark:bg-slate-800 dark:border-slate-500'
                  : 'bg-stone-200 border-stone-600 dark:bg-stone-700 dark:border-stone-500'
              }`}
              style={{
                width: `${Math.min(130, Math.max(70, (diameterCm || 18) * 3))}px`,
                height: `${Math.min(130, Math.max(65, (heightCm || 16) * 2.8))}px`,
              }}
            >
              {/* Soil layer */}
              <div className="w-full h-3/4 bg-stone-800/20 dark:bg-stone-900/40 rounded-b-xl border-t border-stone-700/30 flex items-center justify-center">
                <span className="text-2xl select-none">🪴</span>
              </div>
              {/* Drainage hole */}
              {drainage && (
                <div className="absolute -bottom-1 w-3 h-1 bg-stone-800 dark:bg-stone-200 rounded-full" />
              )}
            </div>

            {/* Side height callout */}
            <div className="flex flex-col items-center text-[11px] font-mono text-stone-500 leading-tight">
              <span className="text-stone-400">↑</span>
              <span className="font-bold text-stone-700 dark:text-stone-300">{heightCm} cm</span>
              <span className="text-stone-400">↓</span>
            </div>
          </div>

          <div className="mt-2">
            <span className="text-2xl font-black text-stone-900 dark:text-stone-100 font-mono">
              {volumeL} L
            </span>
            <span className="text-xs text-stone-500 dark:text-stone-400 block -mt-0.5">
              Calculated Pot Volume
            </span>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5 text-[11px]">
            <span className="px-2 py-0.5 rounded-full border border-stone-200 dark:border-stone-700 font-semibold bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
              {materialModifiers[material].label}
            </span>
            {!drainage && (
              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-bold">
                No drainage (-20%)
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
