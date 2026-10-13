import React, { useState, useEffect } from 'react';
import { PlantSummary } from '../types/index.js';
import { PlantCard } from '../components/PlantCard.js';
import { apiRequest } from '../api/client.js';
import { Plus, RefreshCw, Droplets, Heart, Sparkles, Sprout } from 'lucide-react';

interface HomePageProps {
  onNavigate: (view: string, plantId?: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const [plants, setPlants] = useState<PlantSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const fetchPlants = async () => {
    try {
      setIsLoading(true);
      const data = await apiRequest<{ plants: PlantSummary[] }>('/plants');
      setPlants(data.plants);
    } catch (err: any) {
      console.error('Error fetching plants:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlants();
  }, []);

  const handleRefreshWeather = async () => {
    try {
      setIsRefreshing(true);
      await apiRequest('/schedules/trigger-eval', { method: 'POST' });
      await fetchPlants();
      setMessage('Weather forecast updated! Optimal water amounts recalculated.');
      setTimeout(() => setMessage(null), 5000);
    } catch (err) {
      console.error('Failed to trigger weather re-eval:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Quick stats
  const totalPlants = plants.length;
  const dueTodayCount = plants.filter((p) => {
    if (!p.nextWateringDate) return false;
    const date = new Date(p.nextWateringDate);
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  }).length;

  const avgHealth =
    totalPlants > 0
      ? Math.round(plants.reduce((acc, p) => acc + p.health.score, 0) / totalPlants)
      : 100;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      {/* Top Banner / Summary Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-stone-200 dark:border-stone-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900 dark:text-stone-100 flex items-center gap-2.5">
            <span>Plant Collection</span>
            <span className="text-2xl select-none">🌿</span>
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-1 max-w-2xl font-medium">
            Intelligent hydration scheduling calibrated by pot volume, species characteristics, and live weather conditions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefreshWeather}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 transition-all border border-stone-200 dark:border-stone-700 disabled:opacity-50 cursor-pointer shadow-2xs"
            title="Fetch latest morning weather and recalculate water requirements"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-800 dark:text-emerald-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Updating...' : 'Refresh Weather'}</span>
          </button>

          <button
            onClick={() => onNavigate('create')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-800 hover:bg-emerald-900 text-white shadow-sm transition-all hover:translate-y-[-1px] cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Plant</span>
          </button>
        </div>
      </div>

      {message && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2 font-medium">
          <Sparkles className="w-4 h-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
          <span>{message}</span>
        </div>
      )}

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5 rounded-2xl flex items-center gap-4 border border-stone-200 dark:border-stone-800">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800 flex items-center justify-center text-emerald-800 dark:text-emerald-400 shrink-0">
            <Sprout className="w-6 h-6" />
          </div>
          <div>
            <span className="text-2xl font-black text-stone-900 dark:text-stone-100 font-mono">
              {totalPlants}
            </span>
            <span className="text-xs text-stone-500 dark:text-stone-400 block font-medium">
              Registered Plants
            </span>
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl flex items-center gap-4 border border-stone-200 dark:border-stone-800">
          <div className="w-12 h-12 rounded-xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex items-center justify-center text-stone-700 dark:text-stone-300 shrink-0">
            <Droplets className="w-6 h-6 text-emerald-700 dark:text-emerald-400" />
          </div>
          <div>
            <span className="text-2xl font-black text-stone-900 dark:text-stone-100 font-mono">
              {dueTodayCount}
            </span>
            <span className="text-xs text-stone-500 dark:text-stone-400 block font-medium">
              {dueTodayCount > 0 ? 'Watering Due Today' : 'All Watered'}
            </span>
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl flex items-center gap-4 border border-stone-200 dark:border-stone-800">
          <div className="w-12 h-12 rounded-xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex items-center justify-center text-stone-700 dark:text-stone-300 shrink-0">
            <Heart className="w-6 h-6 text-emerald-700 dark:text-emerald-400" />
          </div>
          <div>
            <span className="text-2xl font-black text-stone-900 dark:text-stone-100 font-mono">
              {avgHealth}%
            </span>
            <span className="text-xs text-stone-500 dark:text-stone-400 block font-medium">
              Average Plant Health
            </span>
          </div>
        </div>
      </div>

      {/* Plant Profile Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-80 rounded-2xl bg-stone-200/50 dark:bg-stone-800/40 animate-pulse border border-stone-200 dark:border-stone-800"
            />
          ))}
        </div>
      ) : plants.length === 0 ? (
        /* Empty State */
        <div className="glass-card rounded-2xl p-10 text-center max-w-xl mx-auto my-8 space-y-4 border border-stone-200 dark:border-stone-800">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-3xl border border-emerald-200 dark:border-emerald-800 text-emerald-800">
            🌱
          </div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">
            No Plants Added Yet
          </h2>
          <p className="text-xs text-stone-600 dark:text-stone-400 max-w-sm mx-auto font-medium">
            Add your first plant to get personalized watering schedules based on pot volume, species requirements, and weather data.
          </p>
          <div className="pt-2">
            <button
              onClick={() => onNavigate('create')}
              className="px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
            >
              + Add Your First Plant
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plants.map((plant) => (
            <PlantCard
              key={plant.id}
              plant={plant}
              onOpen={(id) => onNavigate('plant-detail', id)}
              onRefresh={fetchPlants}
            />
          ))}

          {/* "+ Add Another Plant" Card */}
          <button
            onClick={() => onNavigate('create')}
            className="rounded-2xl border-2 border-dashed border-stone-300 dark:border-stone-700 hover:border-emerald-700 dark:hover:border-emerald-500 bg-stone-50/60 dark:bg-stone-900/30 p-8 flex flex-col items-center justify-center text-center group transition-all duration-200 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 focus:outline-none min-h-[320px] cursor-pointer"
          >
            <div className="w-12 h-12 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 group-hover:bg-emerald-800 group-hover:text-white flex items-center justify-center text-xl transition-all duration-200 border border-stone-200 dark:border-stone-700">
              <Plus className="w-6 h-6 stroke-[2.5]" />
            </div>
            <h3 className="mt-3.5 font-bold text-base text-stone-900 dark:text-stone-100 group-hover:text-emerald-800 dark:group-hover:text-emerald-400 transition-colors">
              + Add Another Plant
            </h3>
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400 max-w-[220px] font-medium">
              Configure species, pot dimensions, and scheduled care.
            </p>
          </button>
        </div>
      )}
    </div>
  );
};
