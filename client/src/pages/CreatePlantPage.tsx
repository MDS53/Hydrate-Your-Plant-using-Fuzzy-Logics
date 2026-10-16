import React, { useState } from 'react';
import { Pot, Location, CareInfo } from '../types/index.js';
import { PotVolumePreview } from '../components/PotVolumePreview.js';
import { apiRequest } from '../api/client.js';
import {
  Sparkles,
  MapPin,
  Calendar,
  Users,
  Droplet,
  Info,
  Check,
  AlertCircle,
  ArrowLeft,
  Loader2,
  Trash2,
  Plus,
  Lock,
  Clock,
  CloudSun,
  Mail,
  Search,
} from 'lucide-react';

interface CreatePlantPageProps {
  onBack: () => void;
  onSuccess: (newPlantId: string) => void;
}

const EMOJI_OPTIONS = ['🌿', '🪴', '🌱', '🌵', '🌴', '🌸', '🌳', '🌾', '🌺', '🍀', '🍃', '🌻'];
const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const CreatePlantPage: React.FC<CreatePlantPageProps> = ({ onBack, onSuccess }) => {
  // Form state
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🌿');
  const [environment, setEnvironment] = useState<'indoor' | 'balcony' | 'outdoor'>('indoor');

  // Location
  const [cityInput, setCityInput] = useState('Zurich');
  const [location, setLocation] = useState<Location>({
    city: 'Zurich',
    lat: 47.3769,
    lon: 8.5417,
    country: 'Switzerland',
  });
  const [citySearchResults, setCitySearchResults] = useState<any[]>([]);
  const [isSearchingCity, setIsSearchingCity] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // Pot state
  const [potMode, setPotMode] = useState<'volume' | 'dimensions'>('volume');
  const [pot, setPot] = useState<Pot>({
    volumeL: 4.0,
    diameterCm: 20,
    heightCm: 18,
    material: 'plastic',
    drainage: true,
  });

  // AI Care info state
  const [careInfo, setCareInfo] = useState<CareInfo>({
    shortDescription: 'Thriving houseplant with balanced watering requirements.',
    idealTempMin: 18,
    idealTempMax: 26,
    criticalMinTemp: 10,
    criticalMaxTemp: 35,
    light: 'Bright indirect light',
    humidity: 'Moderate (45-60%)',
    soilType: 'Aerated organic potting mix',
    wateringNeeds: 'Water when top 2-3 cm dry out.',
    waterMlPerPotLitre: 80,
    waterTypicalRange: '60 - 100 ml/L',
    recommendedFrequencyPerWeek: 1,
    droughtTolerance: 'medium',
    overwateringSensitivity: 'medium',
    commonProblems: ['Overwatering yellow leaves', 'Dry air crispy tips'],
    tips: ['Keep away from cold drafts', 'Check soil moisture before watering'],
  });
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiSuccessMessage, setAiSuccessMessage] = useState<string | null>(null);

  // Schedule Days, Date & Preferred Time
  const [pourDays, setPourDays] = useState<number[]>([1]); // default Monday
  const [wateringTime, setWateringTime] = useState('08:00');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Caretakers (friends)
  const [caretakers, setCaretakers] = useState<{ name: string; email: string }[]>([]);
  const [newCaretakerName, setNewCaretakerName] = useState('');
  const [newCaretakerEmail, setNewCaretakerEmail] = useState('');

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Material & drainage factor calculation
  let materialFactor = 1.0;
  if (pot.material === 'terracotta') materialFactor = 1.15;
  else if (pot.material === 'ceramic') materialFactor = 0.95;
  const drainageFactor = pot.drainage ? 1.0 : 0.8;

  // Base water per watering = (ml per litre from AI) × pot volume (litres) × material/drainage factor
  const baseWaterPerPour = Math.max(
    10,
    Math.round((careInfo.waterMlPerPotLitre * pot.volumeL * materialFactor * drainageFactor) / 10) * 10
  );
  const poursPerWeek = pourDays.length;
  const totalWeeklyWater = baseWaterPerPour * poursPerWeek;

  // Live Fuzzy preview calculation for selected date & time
  const computeFuzzyPreview = () => {
    const temp = 14.5;
    const humidity = 65;
    const rainMm = 0.0;

    let factor = 1.0;
    if (temp <= 2.0) factor = 0.25;
    else if (temp <= 14.0) factor = 0.92;
    else if (temp >= 28.0 && humidity <= 40) factor = 1.35;
    else if (temp >= 26.0) factor = 1.20;

    if (environment === 'indoor') {
      factor = 1.0 + (factor - 1.0) * 0.45;
    } else if (environment === 'balcony') {
      factor = 1.0 + (factor - 1.0) * 0.80;
    }

    if (careInfo.droughtTolerance === 'high') {
      if (factor > 1.0) factor = 1.0 + (factor - 1.0) * 0.4;
      else factor = 1.0 - (1.0 - factor) * 1.35;
    }

    factor = Math.max(0.1, Math.min(1.6, Math.round(factor * 100) / 100));
    const suggestedMl = Math.max(10, Math.round((baseWaterPerPour * factor) / 10) * 10);
    const diffMl = suggestedMl - baseWaterPerPour;

    let verbal = 'Maintain standard hydration';
    if (diffMl < -75) verbal = 'Drastically reduce water (minimal pour)';
    else if (diffMl < -25) verbal = 'Reduce it moderately';
    else if (diffMl < -5) verbal = 'Reduce it slightly';
    else if (diffMl <= 5) verbal = 'Maintain standard hydration';
    else if (diffMl <= 25) verbal = 'Increase it slightly';
    else if (diffMl <= 75) verbal = 'Increase it moderately';
    else verbal = 'Substantially increase water';

    const crispText = diffMl < 0
      ? `[Reduce by ${Math.abs(diffMl)} ml, Crisp target: ${suggestedMl} ml]`
      : diffMl > 0
      ? `[Increase by ${diffMl} ml, Crisp target: ${suggestedMl} ml]`
      : `[Standard pour, Crisp target: ${suggestedMl} ml]`;

    return { verbal, crispText, suggestedMl, diffMl, factor, temp, humidity, rainMm };
  };

  const fuzzyPreview = computeFuzzyPreview();

  // City Search handler
  const handleCitySearch = async (query: string) => {
    setCityInput(query);
    if (query.trim().length < 2) {
      setCitySearchResults([]);
      return;
    }
    try {
      setIsSearchingCity(true);
      const res = await apiRequest<{ results: any[] }>(`/weather/search?q=${encodeURIComponent(query)}`);
      setCitySearchResults(res.results || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearchingCity(false);
    }
  };

  const handleSelectCity = (result: any) => {
    setLocation({
      city: result.city,
      lat: result.lat,
      lon: result.lon,
      country: result.country,
    });
    setCityInput(`${result.city}, ${result.country}`);
    setCitySearchResults([]);
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          city: 'Current Location',
          lat: Number(pos.coords.latitude.toFixed(4)),
          lon: Number(pos.coords.longitude.toFixed(4)),
        });
        setCityInput('GPS Coordinates Detected');
        setIsLocating(false);
      },
      () => {
        alert('Could not retrieve GPS coordinates');
        setIsLocating(false);
      }
    );
  };

  // AI Botanical Lookup Handler
  const handleFetchAiInfo = async () => {
    if (!name.trim()) {
      alert('Please enter a plant name first (e.g. Monstera, Snake Plant)');
      return;
    }
    try {
      setIsGeneratingAi(true);
      setAiSuccessMessage(null);
      const res = await apiRequest<{ careInfo: CareInfo }>('/plants/ai-preview', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() }),
      });
      if (res.careInfo) {
        setCareInfo(res.careInfo);
        // Adjust pour days to match recommended frequency
        const count = Math.max(1, Math.round(res.careInfo.recommendedFrequencyPerWeek));
        if (count === 1) setPourDays([1]);
        else if (count === 2) setPourDays([1, 4]);
        else if (count >= 3) setPourDays([1, 3, 5]);

        setAiSuccessMessage(`✨ Care guidelines generated for "${name}"!`);
        setTimeout(() => setAiSuccessMessage(null), 4000);
      }
    } catch (err: any) {
      alert(err.message || 'AI request failed');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Toggle Day
  const toggleDay = (dayIndex: number) => {
    if (pourDays.includes(dayIndex)) {
      if (pourDays.length === 1) {
        alert('You must select at least one watering day per week');
        return;
      }
      setPourDays(pourDays.filter((d) => d !== dayIndex));
    } else {
      setPourDays([...pourDays, dayIndex].sort());
    }
  };

  // Add Caretaker
  const handleAddCaretaker = () => {
    if (!newCaretakerName.trim() || !newCaretakerEmail.trim()) {
      alert('Please enter caretaker name and a valid email');
      return;
    }
    setCaretakers([
      ...caretakers,
      { name: newCaretakerName.trim(), email: newCaretakerEmail.toLowerCase().trim() },
    ]);
    setNewCaretakerName('');
    setNewCaretakerEmail('');
  };

  const handleRemoveCaretaker = (idx: number) => {
    setCaretakers(caretakers.filter((_, i) => i !== idx));
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Plant name is required');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const payload = {
        name: name.trim(),
        emoji,
        location,
        environment,
        pot,
        careInfo,
        pourDaysOfWeek: pourDays,
        wateringTime,
        firstWateringDate: selectedDate,
        caretakers,
      };

      const res = await apiRequest<{ plant: any }>('/plants', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      onSuccess(res.plant._id);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create plant profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  const recommendedDaysCount = Math.round(careInfo.recommendedFrequencyPerWeek);
  const dayDifference = pourDays.length - recommendedDaysCount;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-300">
      {/* Back button and title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-stone-900 dark:text-stone-100">
            Create Plant Profile
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Configure pot dimensions, botanical care requirements, weather location, and caretaker circle.
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-2xl text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {aiSuccessMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{aiSuccessMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* SECTION A: Plant Name, Emoji & Location */}
        <div className="glass-card p-6 rounded-3xl space-y-5">
          <h2 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2 border-b border-stone-200/80 dark:border-stone-800 pb-3">
            <span className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-xs font-black">
              A
            </span>
            <span>Plant Identity & Location</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Plant Name */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                Plant Name or Variety *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Monstera Deliciosa, Snake Plant, Aloe Vera, Ficus"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            {/* Emoji selector */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                Avatar Emoji
              </label>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {EMOJI_OPTIONS.slice(0, 5).map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEmoji(e)}
                    className={`w-9 h-9 rounded-xl text-xl flex items-center justify-center border transition-all ${
                      emoji === e
                        ? 'bg-emerald-100 border-emerald-500 dark:bg-emerald-950 scale-110'
                        : 'border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800'
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Location & Environment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {/* City search */}
            <div className="relative">
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                Plant Location (for Live Weather Forecast)
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={cityInput}
                    onChange={(e) => handleCitySearch(e.target.value)}
                    placeholder="Search city..."
                    className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  {isSearchingCity && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin absolute right-3 top-3 text-stone-400" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={isLocating}
                  className="px-3 py-2 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-semibold hover:bg-stone-200 dark:hover:bg-stone-700 flex items-center gap-1 shrink-0"
                  title="Use current GPS"
                >
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  <span>GPS</span>
                </button>
              </div>

              {/* Autocomplete Dropdown */}
              {citySearchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl shadow-lg z-20 overflow-hidden">
                  {citySearchResults.map((res, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSelectCity(res)}
                      className="w-full px-4 py-2 text-left text-xs hover:bg-emerald-50 dark:hover:bg-stone-700 flex items-center justify-between"
                    >
                      <span className="font-semibold text-stone-900 dark:text-stone-100">
                        {res.city}
                      </span>
                      <span className="text-stone-500 text-[11px]">{res.country}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Environment */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                Micro-climate Environment
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'indoor', label: 'Indoor', desc: 'Protected' },
                  { id: 'balcony', label: 'Balcony', desc: 'Covered' },
                  { id: 'outdoor', label: 'Outdoor', desc: 'Full Exposure' },
                ].map((env) => (
                  <button
                    key={env.id}
                    type="button"
                    onClick={() => setEnvironment(env.id as any)}
                    className={`py-2 px-1 text-center rounded-xl border text-xs transition-all ${
                      environment === env.id
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-900 dark:text-emerald-200 font-bold'
                        : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800'
                    }`}
                  >
                    <div>{env.label}</div>
                    <div className="text-[10px] text-stone-500 font-normal">{env.desc}</div>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-2">
                Adapts evaporation rates and natural rainfall shielding for your plant location.
              </p>
            </div>
          </div>
        </div>

        {/* SECTION B: Pot Details & Live Calculation */}
        <div className="glass-card p-6 rounded-3xl space-y-4">
          <h2 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2 border-b border-stone-200/80 dark:border-stone-800 pb-3">
            <span className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-xs font-black">
              B
            </span>
            <span>Pot Geometry & Material Modifiers</span>
          </h2>

          <PotVolumePreview
            pot={pot}
            onChange={setPot}
            mode={potMode}
            onModeChange={setPotMode}
          />
        </div>

        {/* Search Botanical Care Profile Button (Placed Below Pot Size Section) */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/50 rounded-2xl">
          <div className="text-left">
            <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 block">
              Botanical Care & Hydration Lookup
            </span>
            <span className="text-[11px] text-stone-500 dark:text-emerald-400/80">
              Search botanical requirements and weather-adjusted watering recommendations for {name ? `"${name}"` : 'your plant'}.
            </span>
          </div>
          <button
            type="button"
            onClick={handleFetchAiInfo}
            disabled={isGeneratingAi || !name.trim()}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-sm cursor-pointer shrink-0"
            title="Search botanical specifications and care guidelines"
          >
            {isGeneratingAi ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            <span>{isGeneratingAi ? 'Searching...' : 'Search'}</span>
          </button>
        </div>

        {/* SECTION C: Botanical Care Profile & Weather Recommendations */}
        <div className="glass-card p-6 rounded-3xl space-y-5 border border-emerald-500/20">
          <div className="flex items-center justify-between border-b border-stone-200/80 dark:border-emerald-900/40 pb-3">
            <h2 className="text-base font-black text-stone-900 dark:text-emerald-100 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-black border border-emerald-500/30">
                C
              </span>
              <span>Botanical Care Profile & Weather Recommendations</span>
            </h2>
            <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 shadow-xs">
              <Lock className="w-3 h-3" />
              <span>Botanical Specifications &bull; Read-Only</span>
            </span>
          </div>

          {/* HIGHLIGHTED "Watering per week" Banner */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-lg shadow-emerald-700/15">
            <div className="flex items-center justify-between mb-3 border-b border-white/20 pb-2">
              <span className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                <Droplet className="w-4 h-4 fill-white" />
                Watering Per Week Formula Summary
              </span>
              <span className="text-[11px] bg-white/20 px-2.5 py-0.5 rounded-full font-bold">
                Standard Baseline Volume
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white/10 rounded-xl p-2.5">
                <span className="text-2xl font-black block font-mono">{baseWaterPerPour} ml</span>
                <span className="text-[11px] text-emerald-100 font-semibold">Base per pour</span>
              </div>
              <div className="bg-white/10 rounded-xl p-2.5">
                <span className="text-2xl font-black block font-mono">{poursPerWeek}×</span>
                <span className="text-[11px] text-emerald-100 font-semibold">Pours / week</span>
              </div>
              <div className="bg-white/15 rounded-xl p-2.5 border border-white/20">
                <span className="text-2xl font-black block font-mono">{totalWeeklyWater} ml</span>
                <span className="text-[11px] text-emerald-100 font-semibold">Total weekly water</span>
              </div>
            </div>

            <p className="mt-2.5 text-[11px] text-emerald-100/90 text-center font-medium">
              Formula: ({careInfo.waterMlPerPotLitre} ml/L requirement) × ({pot.volumeL} L pot) × ({materialFactor}× material) × ({drainageFactor}× drainage) = {baseWaterPerPour} ml
            </p>
          </div>

          {/* Non-Editable Care Parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
            <div className="p-3.5 rounded-2xl bg-stone-100/80 dark:bg-emerald-950/40 border border-stone-200/80 dark:border-emerald-900/40">
              <span className="text-[11px] text-stone-500 dark:text-emerald-400/80 block font-bold mb-1">
                ml Water / Litre of Pot:
              </span>
              <div className="text-lg font-black text-stone-900 dark:text-emerald-100 font-mono">
                {careInfo.waterMlPerPotLitre} ml/L
              </div>
              <span className="text-[10px] text-stone-400 dark:text-emerald-500/70 block mt-0.5">
                Typical range: {careInfo.waterTypicalRange || '60 - 90 ml/L'}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-stone-100/80 dark:bg-emerald-950/40 border border-stone-200/80 dark:border-emerald-900/40">
              <span className="text-[11px] text-stone-500 dark:text-emerald-400/80 block font-bold mb-1">
                Drought Tolerance:
              </span>
              <div className="text-sm font-black text-emerald-700 dark:text-emerald-300 capitalize flex items-center gap-1.5 mt-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>{careInfo.droughtTolerance} (Botanical spec)</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-stone-100/80 dark:bg-emerald-950/40 border border-stone-200/80 dark:border-emerald-900/40">
              <span className="text-[11px] text-stone-500 dark:text-emerald-400/80 block font-bold mb-1">
                Overwatering Sensitivity:
              </span>
              <div className="text-sm font-black text-amber-700 dark:text-amber-300 capitalize flex items-center gap-1.5 mt-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>{careInfo.overwateringSensitivity} (Root sensitivity)</span>
              </div>
            </div>
          </div>

          {/* Plant Botanical Description (When searched) */}
          {careInfo.shortDescription && careInfo.shortDescription !== 'Thriving houseplant with balanced watering requirements.' && (
            <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/30 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <p className="text-xs text-stone-700 dark:text-emerald-200/90 leading-relaxed font-medium">
                {careInfo.shortDescription}
              </p>
            </div>
          )}

          {/* Weather Report Description, Water Quantity & Placement Guidance */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-stone-50 to-emerald-50/50 dark:from-stone-900/60 dark:to-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 space-y-3.5">
            <div className="flex items-center justify-between border-b border-emerald-200/60 dark:border-emerald-900/40 pb-2.5">
              <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                <CloudSun className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Weather Report & Hydration Advisory</span>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">
                {cityInput} • {fuzzyPreview.temp}°C
              </span>
            </div>

            {/* Weather & Watering Volume Impact */}
            <div className="text-xs text-stone-700 dark:text-stone-300 space-y-1.5 leading-relaxed">
              <p>
                <strong>Watering Quantity Recommendation:</strong> Based on current weather conditions in <strong>{cityInput}</strong> ({fuzzyPreview.temp}°C, {fuzzyPreview.humidity}% humidity, {fuzzyPreview.rainMm} mm rain), moisture evaporation in a {pot.volumeL} L pot is {fuzzyPreview.diffMl < 0 ? 'slower than standard baseline' : fuzzyPreview.diffMl > 0 ? 'accelerated by ambient warmth' : 'normal'}. Recommended pour: <strong className="text-emerald-700 dark:text-emerald-400 font-mono">{fuzzyPreview.suggestedMl} ml</strong> ({fuzzyPreview.diffMl < 0 ? `reduced by ${Math.abs(fuzzyPreview.diffMl)} ml` : fuzzyPreview.diffMl > 0 ? `increased by ${fuzzyPreview.diffMl} ml` : 'standard pour'}) to protect roots from waterlogging.
              </p>
            </div>

            {/* Placement Suggestions (Indoor vs Outdoor / Balcony) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-white dark:bg-stone-800/80 border border-stone-200/80 dark:border-stone-700">
                <span className="text-[11px] font-bold text-stone-900 dark:text-stone-100 block mb-1">
                  🏡 Indoor Placement Suggestions
                </span>
                <p className="text-[11px] text-stone-600 dark:text-stone-400 leading-normal">
                  Best kept in bright indirect sunlight. Keep away from cold drafts, air conditioning vents, and direct heat sources. Room temperatures between {careInfo.idealTempMin || 18}°C–{careInfo.idealTempMax || 26}°C support steady foliage growth.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-stone-800/80 border border-stone-200/80 dark:border-stone-700">
                <span className="text-[11px] font-bold text-stone-900 dark:text-stone-100 block mb-1">
                  🪴 Outdoor / Balcony Suggestions
                </span>
                <p className="text-[11px] text-stone-600 dark:text-stone-400 leading-normal">
                  If kept outdoors or on a balcony, place in sheltered partial shade. Bring indoors if nighttime temperatures drop below {careInfo.criticalMinTemp || 10}°C, and ensure rapid pot drainage during heavy rainfall.
                </p>
              </div>
            </div>

            {/* Practical Care Suggestion */}
            <div className="text-[11px] text-stone-600 dark:text-stone-400 bg-emerald-50/50 dark:bg-emerald-950/20 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900/30 flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>
                Pour water evenly around the root perimeter. Empty standing runoff from the saucer after 15 minutes to avoid root rot.
              </span>
            </div>
          </div>
        </div>

        {/* SECTION D: Watering Schedule: Date & Time Flexibility */}
        <div className="glass-card p-6 rounded-3xl space-y-5 border border-emerald-500/20">
          <div className="flex items-center justify-between border-b border-stone-200/80 dark:border-emerald-900/40 pb-3">
            <h2 className="text-base font-black text-stone-900 dark:text-emerald-100 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-black border border-emerald-500/30">
                D
              </span>
              <span>Watering Schedule: Date & Time Flexibility</span>
            </h2>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              Recommended: {recommendedDaysCount} day{recommendedDaysCount > 1 ? 's' : ''}/week
            </span>
          </div>

          {/* Date & Time Selectors Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Preferred Watering Date */}
            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-emerald-200 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                <span>Select Target Watering Date:</span>
              </label>
              <input
                type="date"
                min={new Date().toISOString().split('T')[0]}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-emerald-950/50 border border-stone-200 dark:border-emerald-800/60 rounded-xl text-xs font-bold text-stone-900 dark:text-emerald-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            {/* Preferred Watering Time */}
            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-emerald-200 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-500" />
                <span>Select Preferred Watering Time:</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={wateringTime}
                  onChange={(e) => setWateringTime(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 bg-stone-50 dark:bg-emerald-950/50 border border-stone-200 dark:border-emerald-800/60 rounded-xl text-xs font-bold text-stone-900 dark:text-emerald-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setWateringTime('08:00')}
                  className={`px-2.5 py-2 rounded-xl text-[10px] font-black border transition-all cursor-pointer ${
                    wateringTime === '08:00'
                      ? 'bg-emerald-500 text-white border-emerald-500 shadow-xs'
                      : 'border-stone-200 dark:border-emerald-900/60 text-stone-600 dark:text-emerald-400 hover:bg-stone-100 dark:hover:bg-emerald-950'
                  }`}
                  title="Morning 08:00 AM (Recommended for optimal photosynthesis)"
                >
                  🌅 08:00 AM
                </button>
                <button
                  type="button"
                  onClick={() => setWateringTime('18:00')}
                  className={`px-2.5 py-2 rounded-xl text-[10px] font-black border transition-all cursor-pointer ${
                    wateringTime === '18:00'
                      ? 'bg-emerald-500 text-white border-emerald-500 shadow-xs'
                      : 'border-stone-200 dark:border-emerald-900/60 text-stone-600 dark:text-emerald-400 hover:bg-stone-100 dark:hover:bg-emerald-950'
                  }`}
                  title="Evening 06:00 PM"
                >
                  🌆 06:00 PM
                </button>
              </div>
            </div>
          </div>

          {/* Days of week selector */}
          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-emerald-200 mb-2">
              Weekly Recurring Days ({pourDays.length} selected):
            </label>
            <div className="grid grid-cols-7 gap-2">
              {DAYS_OF_WEEK.map((dayName, idx) => {
                const isSelected = pourDays.includes(idx);
                return (
                  <button
                    key={dayName}
                    type="button"
                    onClick={() => toggleDay(idx)}
                    className={`py-3 rounded-2xl border text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-tr from-emerald-600 to-teal-600 text-white font-black border-emerald-500 shadow-md shadow-emerald-600/20 scale-105'
                        : 'border-stone-200 dark:border-emerald-900/50 text-stone-600 dark:text-emerald-400 hover:bg-stone-100 dark:hover:bg-emerald-950/40'
                    }`}
                  >
                    <span className="text-xs block font-bold">{dayName}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Weather Fuzzy Suggestion for Selected Date & Time */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-cyan-500/10 dark:from-emerald-950/50 dark:via-teal-950/30 dark:to-[#042016]/40 border border-emerald-500/30 space-y-2">
            <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-500 animate-spin" />
                <span>Weather-Smart Fuzzy Suggestion (on {selectedDate} at {wateringTime}):</span>
              </span>
              <span className="text-[10px] font-mono text-stone-500 dark:text-emerald-400/80 font-bold">
                {location.city} ({fuzzyPreview.temp}°C &bull; {fuzzyPreview.humidity}% hum)
              </span>
            </div>

            <div className="text-base font-black text-stone-900 dark:text-emerald-100">
              👉 {fuzzyPreview.verbal}
            </div>

            <div className="text-xs font-mono font-black text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 p-2 rounded-xl border border-emerald-500/25">
              {fuzzyPreview.crispText}
            </div>

            <p className="text-[11px] text-stone-600 dark:text-stone-400 font-medium">
              Calculated using fuzzy inference rules & live atmospheric weather model.
            </p>
          </div>

          {/* AI Frequency Alert if mismatched */}
          {dayDifference !== 0 && (
            <div className="p-3 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs text-stone-800 dark:text-stone-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>
                {dayDifference > 0
                  ? `Notice: You selected ${pourDays.length} days/week, which is more frequent than the baseline recommendation (${recommendedDaysCount} days/week). Inspect substrate to ensure proper drainage.`
                  : `Notice: You selected ${pourDays.length} days/week, which is less than the recommended ${recommendedDaysCount} days/week.`}
              </span>
            </div>
          )}
        </div>

        {/* SECTION E: Caretakers (Friends Collaboration) */}
        <div className="glass-card p-6 rounded-3xl space-y-4">
          <div className="flex items-center justify-between border-b border-stone-200/80 dark:border-stone-800 pb-3">
            <h2 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 flex items-center justify-center text-xs font-black">
                E
              </span>
              <span>Caretaker Circle (Care assistance when you're away)</span>
            </h2>
            <span className="text-xs text-stone-500">Direct Links &bull; Quick access for caretakers</span>
          </div>

          {/* Add caretaker input */}
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="Friend's Name"
              value={newCaretakerName}
              onChange={(e) => setNewCaretakerName(e.target.value)}
              className="flex-1 px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-medium"
            />
            <input
              type="email"
              placeholder="Friend's Email Address"
              value={newCaretakerEmail}
              onChange={(e) => setNewCaretakerEmail(e.target.value)}
              className="flex-1 px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-medium"
            />
            <button
              type="button"
              onClick={handleAddCaretaker}
              className="px-4 py-2 bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 rounded-xl text-xs font-bold hover:bg-emerald-600 transition-colors shrink-0 flex items-center justify-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Friend</span>
            </button>
          </div>

          {/* Caretakers list */}
          {caretakers.length > 0 && (
            <div className="space-y-2 pt-2">
              {caretakers.map((ct, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200/60 dark:border-stone-800 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="font-bold text-stone-900 dark:text-stone-100">{ct.name}</span>
                    <span className="text-stone-400">({ct.email})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveCaretaker(idx)}
                    className="text-stone-400 hover:text-red-500 transition-colors p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="p-3 bg-stone-50 dark:bg-stone-800/40 rounded-xl border border-stone-200/60 dark:border-stone-800 text-xs text-stone-600 dark:text-stone-300 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-stone-800 dark:text-stone-200">
              <Mail className="w-3.5 h-3.5 text-emerald-700" />
              <span>Automated Schedule & Reminder Dispatch:</span>
            </div>
            <p className="text-[11px] text-stone-500 leading-relaxed">
              Upon profile creation, the whole watering schedule (pot volume, dimensions, and watering dates) will be automatically emailed to you and your added friends. At your preferred watering time ({wateringTime}), reminders stating <em>"Please update it in website"</em> will be sent, and watering logs will be shared with the team.
            </p>
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-4 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-3 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-7 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-lg shadow-emerald-600/25 flex items-center gap-2 transition-all hover:scale-105 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving & Delivering Schedule...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Save Plant & Deliver Schedule</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
