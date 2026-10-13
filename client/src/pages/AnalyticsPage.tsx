import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client.js';
import { HealthGauge } from '../components/HealthGauge.js';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import {
  Trophy,
  Award,
  Zap,
  TrendingUp,
  Sparkles,
  ShieldCheck,
  Droplet,
  Thermometer,
  Calendar,
  Flame,
  CheckCircle,
  Clock,
  MapPin,
  ArrowRight,
} from 'lucide-react';

interface AnalyticsPageProps {
  initialPlantId?: string;
  onNavigateToPlant?: (plantId: string) => void;
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({
  initialPlantId,
  onNavigateToPlant,
}) => {
  const [activeTab, setActiveTab] = useState<'overall' | 'single'>(initialPlantId ? 'single' : 'overall');
  const [selectedPlantId, setSelectedPlantId] = useState<string>(initialPlantId || '');
  const [plantList, setPlantList] = useState<any[]>([]);

  // Analytics data states
  const [overallData, setOverallData] = useState<any>(null);
  const [singlePlantData, setSinglePlantData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch plants list for dropdown
  useEffect(() => {
    apiRequest('/plants').then((res) => {
      setPlantList(res.plants || []);
      if (!selectedPlantId && res.plants && res.plants.length > 0) {
        setSelectedPlantId(res.plants[0].id);
      }
    });
  }, []);

  // Fetch Overall Analytics
  const fetchOverall = async () => {
    try {
      setIsLoading(true);
      const res = await apiRequest('/analytics/overall');
      setOverallData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch Single Plant Analytics
  const fetchSinglePlant = async (id: string) => {
    if (!id) return;
    try {
      setIsLoading(true);
      const res = await apiRequest(`/analytics/plant/${id}`);
      setSinglePlantData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'overall') {
      fetchOverall();
    } else if (selectedPlantId) {
      fetchSinglePlant(selectedPlantId);
    }
  }, [activeTab, selectedPlantId]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      {/* Page Title & Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 dark:border-stone-800 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900 dark:text-stone-100 flex items-center gap-2.5">
            <span>Watering Analytics & Performance</span>
            <span className="text-2xl select-none">📊</span>
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 font-medium">
            Tracking fuzzy weather adherence, consistency streaks, and botanical health metrics.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 bg-stone-100 dark:bg-stone-800/80 p-1 rounded-xl border border-stone-200 dark:border-stone-700">
          <button
            onClick={() => setActiveTab('overall')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'overall'
                ? 'bg-white dark:bg-stone-700 text-emerald-800 dark:text-emerald-300 shadow-2xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            All Plants View
          </button>
          <button
            onClick={() => setActiveTab('single')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'single'
                ? 'bg-white dark:bg-stone-700 text-emerald-800 dark:text-emerald-300 shadow-2xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            Single Plant Deep Dive
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 text-center">
          <div className="w-10 h-10 border-3 border-emerald-800 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-stone-500">Calculating analytical metrics...</p>
        </div>
      ) : activeTab === 'overall' && overallData ? (
        /* ================= OVERALL VIEW ================= */
        <div className="space-y-8">
          {/* Top Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* MVP */}
            <div className="p-5 rounded-2xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 glass-card flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 flex items-center justify-center text-xl shrink-0 border border-stone-200 dark:border-stone-700">
                🏆
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 block">
                  Caretaker of the Month
                </span>
                <span className="text-lg font-black text-stone-900 dark:text-stone-100 block">
                  {overallData.mvp?.name || 'Sophia Botanica'}
                </span>
                <span className="text-xs text-stone-500 dark:text-stone-400">
                  {overallData.mvp?.totalPours || 0} successful watering pours logged
                </span>
              </div>
            </div>

            {/* Consistency */}
            <div className="p-5 rounded-2xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 glass-card flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 flex items-center justify-center text-xl shrink-0 border border-emerald-200 dark:border-emerald-800">
                🌿
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 block">
                  Weekly Care Adherence
                </span>
                <span className="text-lg font-black text-stone-900 dark:text-stone-100 block">
                  {overallData.plantParentOfWeek?.name || 'Sophia Botanica'}
                </span>
                <span className="text-xs text-stone-500 dark:text-stone-400">
                  {overallData.plantParentOfWeek?.adherencePercent || 95}% schedule adherence rate
                </span>
              </div>
            </div>

            {/* Overall Health Average */}
            <div className="p-5 rounded-2xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 glass-card flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 flex items-center justify-center text-xl shrink-0 border border-stone-200 dark:border-stone-700">
                ✨
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 block">
                  Garden Health Average
                </span>
                <span className="text-lg font-black text-stone-900 dark:text-stone-100 block">
                  {overallData.stats?.averageHealth || 100}%
                </span>
                <span className="text-xs text-stone-500 dark:text-stone-400">
                  Across {overallData.stats?.totalPlants || 0} active plant profiles
                </span>
              </div>
            </div>
          </div>

          {/* Cross-Plant Comparison Table */}
          <div className="glass-card rounded-3xl p-6 space-y-4">
            <h2 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <Droplet className="w-4 h-4 text-emerald-600" />
              <span>Plant Portfolio Side-by-Side Comparison</span>
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-stone-200/80 dark:border-stone-800 text-stone-400 font-bold uppercase text-[10px]">
                    <th className="pb-3">Plant</th>
                    <th className="pb-3">Location & Env</th>
                    <th className="pb-3">Pot Volume</th>
                    <th className="pb-3">Base Water</th>
                    <th className="pb-3">Health Score</th>
                    <th className="pb-3">Current Streak</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60 font-medium text-stone-700 dark:text-stone-300">
                  {overallData.plantSummaries?.map((p: any) => (
                    <tr key={p.id} className="hover:bg-stone-50/50 dark:hover:bg-stone-800/30">
                      <td className="py-3.5 flex items-center gap-2.5 font-bold text-stone-900 dark:text-stone-100">
                        <span className="text-xl">{p.emoji}</span>
                        <span>{p.name}</span>
                      </td>
                      <td className="py-3.5">
                        <span className="capitalize">{p.location} ({p.environment})</span>
                      </td>
                      <td className="py-3.5">{p.potVolumeL} L</td>
                      <td className="py-3.5 font-bold text-emerald-600 dark:text-emerald-400">
                        {p.baseWaterMl} ml
                      </td>
                      <td className="py-3.5">
                        <span className="inline-flex items-center gap-1 font-bold">
                          <span>{p.healthEmoji}</span>
                          <span>{p.healthScore}%</span>
                          <span className="text-[10px] text-stone-400 font-normal">({p.healthLabel})</span>
                        </span>
                      </td>
                      <td className="py-3.5">
                        <span className="inline-flex items-center gap-1 text-amber-600 font-bold">
                          <Flame className="w-3.5 h-3.5" />
                          <span>{p.currentStreak} pours</span>
                        </span>
                      </td>
                      <td className="py-3.5 text-right">
                        <button
                          onClick={() => {
                            setSelectedPlantId(p.id);
                            setActiveTab('single');
                          }}
                          className="px-3 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-emerald-50 dark:hover:bg-emerald-950 hover:text-emerald-600 font-bold text-[11px] transition-colors"
                        >
                          Deep Dive &rarr;
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Social Gamification: Leaderboard & Badges */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Team Leaderboard */}
            <div className="glass-card p-6 rounded-3xl space-y-4">
              <h2 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                <span>Care Team Leaderboard</span>
              </h2>

              <div className="space-y-2.5">
                {overallData.leaderboard?.map((person: any, index: number) => (
                  <div
                    key={person.name}
                    className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200/60 dark:border-stone-800 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300 flex items-center justify-center font-bold text-xs">
                        #{index + 1}
                      </span>
                      <div>
                        <span className="font-bold text-stone-900 dark:text-stone-100 block">
                          {person.name}
                        </span>
                        <span className="text-[11px] text-stone-400">
                          {person.adherencePercent}% fuzzy adherence
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                        {person.totalPours}
                      </span>
                      <span className="text-[11px] text-stone-400 block -mt-1 font-medium">pours</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Badges Collection */}
            <div className="glass-card p-6 rounded-3xl space-y-4 border border-emerald-500/20">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-black text-stone-900 dark:text-emerald-100 flex items-center gap-2">
                  <Award className="w-5 h-5 text-emerald-500 animate-bounce" />
                  <span>Botanical Badges & Achievements</span>
                </h2>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  Unlocked ({overallData.badges?.length || 0})
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                {overallData.badges?.slice(0, 8).map((badge: any, i: number) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-transparent to-teal-500/5 dark:from-emerald-950/40 dark:to-[#042016]/40 border border-emerald-500/20 hover:border-emerald-400/50 hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-300 space-y-1.5 text-xs group relative overflow-hidden"
                  >
                    <div className="text-3xl select-none group-hover:scale-125 group-hover:rotate-6 transition-transform duration-300 inline-block">
                      {badge.icon || '🏆'}
                    </div>
                    <span className="font-black text-stone-900 dark:text-emerald-100 block text-xs tracking-tight">
                      {badge.badge}
                    </span>
                    <span className="text-[11px] text-stone-600 dark:text-emerald-300/80 block leading-tight font-medium">
                      {badge.description}
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block pt-1 font-bold">
                      ✨ {badge.personName}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : singlePlantData ? (
        /* ================= SINGLE PLANT VIEW ================= */
        <div className="space-y-8">
          {/* Plant Selector Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 glass-card p-4 rounded-2xl">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{singlePlantData.plant?.emoji}</span>
              <div>
                <h2 className="text-xl font-black text-stone-900 dark:text-stone-100">
                  {singlePlantData.plant?.name} Analytics
                </h2>
                <span className="text-xs text-stone-500">
                  Pot: {singlePlantData.plant?.pot.volumeL} L &bull; Base: {singlePlantData.plant?.baseWaterMl} ml
                </span>
              </div>
            </div>

            {/* Dropdown to switch plant */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-stone-500">Select Plant:</label>
              <select
                value={selectedPlantId}
                onChange={(e) => setSelectedPlantId(e.target.value)}
                className="px-3 py-1.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-bold"
              >
                {plantList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.emoji} {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Top Score & Streaks Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Health Score Gauge */}
            <div className="glass-card p-6 rounded-3xl flex flex-col items-center justify-center text-center">
              <HealthGauge health={singlePlantData.health} size="lg" showDetails={true} />
            </div>

            {/* Streaks Card */}
            <div className="glass-card p-6 rounded-3xl flex flex-col justify-between space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-stone-700 dark:text-stone-300">
                <Flame className="w-4 h-4 text-orange-500" />
                <span>Watering Consistency Streaks</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-800">
                  <span className="text-3xl font-black text-amber-600 block">
                    {singlePlantData.streaks?.currentStreak || 0}
                  </span>
                  <span className="text-[11px] text-amber-800 dark:text-amber-300 font-bold">
                    Current Streak
                  </span>
                </div>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                  <span className="text-3xl font-black text-emerald-600 block">
                    {singlePlantData.streaks?.bestStreak || 0}
                  </span>
                  <span className="text-[11px] text-emerald-800 dark:text-emerald-300 font-bold">
                    Best Streak
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-stone-500 text-center">
                Consecutive watering sessions completed on time without skips or misses.
              </p>
            </div>

            {/* Automated Smart Insights */}
            <div className="glass-card p-6 rounded-3xl space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-stone-700 dark:text-stone-300">
                <Sparkles className="w-4 h-4 text-emerald-500" />
                <span>Automated Botanical Insights</span>
              </div>
              <div className="space-y-2 text-xs">
                {singlePlantData.insights?.map((insight: string, idx: number) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200/60 dark:border-stone-800 text-stone-700 dark:text-stone-300 leading-relaxed text-[11px]"
                  >
                    {insight}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CHART 1: Base vs Suggested vs Actual Water per Watering */}
          <div className="glass-card p-6 rounded-3xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <Droplet className="w-4 h-4 text-emerald-600" />
                  <span>Base vs. Suggested vs. Actual Water Volume (ml)</span>
                </h3>
                <p className="text-xs text-stone-500">
                  Tracks how actual poured amounts align with fuzzy weather suggestions and base requirements.
                </p>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={singlePlantData.charts?.waterComparison || []}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="date" stroke="#888888" fontSize={11} />
                  <YAxis stroke="#888888" fontSize={11} unit=" ml" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(28, 25, 23, 0.9)',
                      borderRadius: '12px',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="baseMl" name="Base Amount" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="suggestedMl" name="Fuzzy Suggested" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="actualMl" name="Actual Poured" fill="#0284c7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* CHART 2: Temperature vs Water Adjustment Chart */}
          <div className="glass-card p-6 rounded-3xl space-y-4">
            <div>
              <h3 className="font-bold text-base text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <Thermometer className="w-4 h-4 text-rose-500" />
                <span>Ambient Temperature (°C) vs. Fuzzy Adjustment Factor (×)</span>
              </h3>
              <p className="text-xs text-stone-500">
                Visualizes the deterministic correlation between temperature swings and water adjustment.
              </p>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={singlePlantData.charts?.tempVsAdjustment || []}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="date" stroke="#888888" fontSize={11} />
                  <YAxis yAxisId="left" stroke="#ef4444" fontSize={11} unit="°C" />
                  <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={11} unit="×" domain={[0, 1.6]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(28, 25, 23, 0.9)',
                      borderRadius: '12px',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Line yAxisId="left" type="monotone" dataKey="temperature" name="Temp (°C)" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
                  <Line yAxisId="right" type="monotone" dataKey="fuzzyFactor" name="Fuzzy Factor (×)" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
