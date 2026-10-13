import React, { useState, useEffect } from 'react';
import { PlantDetail, Caretaker, ScheduleItem, WaterLogItem, HealthScore, PlantSummary } from '../types/index.js';
import { HealthGauge } from '../components/HealthGauge.js';
import { WeatherBadge } from '../components/WeatherBadge.js';
import { FuzzyExplainerModal } from '../components/FuzzyExplainerModal.js';
import { WaterNowModal } from '../components/WaterNowModal.js';
import { apiRequest } from '../api/client.js';
import { PlantMoodBadge } from '../components/PlantMoodBadge.js';
import {
  ArrowLeft,
  Calendar,
  Droplet,
  Thermometer,
  Sun,
  Wind,
  ShieldAlert,
  BarChart3,
  Clock,
  Trash2,
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  MapPin,
  Sparkles,
  Check,
  Mail,
  Users,
  Bell,
} from 'lucide-react';

interface PlantDetailPageProps {
  plantId: string;
  onBack: () => void;
  onNavigateToAnalytics: (plantId: string) => void;
  onNavigateToConfirm: (scheduleId: string) => void;
}

export const PlantDetailPage: React.FC<PlantDetailPageProps> = ({
  plantId,
  onBack,
  onNavigateToAnalytics,
  onNavigateToConfirm,
}) => {
  const [plant, setPlant] = useState<PlantDetail | null>(null);
  const [caretakers, setCaretakers] = useState<Caretaker[]>([]);
  const [upcomingSchedules, setUpcomingSchedules] = useState<ScheduleItem[]>([]);
  const [completedSchedules, setCompletedSchedules] = useState<ScheduleItem[]>([]);
  const [logs, setLogs] = useState<WaterLogItem[]>([]);
  const [health, setHealth] = useState<HealthScore | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showFuzzyModal, setShowFuzzyModal] = useState(false);
  const [showWaterModal, setShowWaterModal] = useState(false);
  const [wateredJustNow, setWateredJustNow] = useState(false);
  const [isWateredToday, setIsWateredToday] = useState(false);
  const [canWaterNow, setCanWaterNow] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isSendingSchedule, setIsSendingSchedule] = useState(false);
  const [isSendingReminderTest, setIsSendingReminderTest] = useState(false);

  const handleSendSchedule = async () => {
    try {
      setIsSendingSchedule(true);
      const res = await apiRequest<{ message: string; recipients: string[]; previewUrl?: string }>(
        `/plants/${plantId}/send-schedule`,
        { method: 'POST' }
      );
      setActionMessage(res.message || 'Whole watering schedule dispatched to your care team!');
      setTimeout(() => setActionMessage(null), 6000);
    } catch (err: any) {
      alert(err.message || 'Failed to dispatch schedule email');
    } finally {
      setIsSendingSchedule(false);
    }
  };

  const handleTestReminderAlert = async () => {
    try {
      setIsSendingReminderTest(true);
      const res = await apiRequest<{ message: string; sentCount?: number }>(
        '/schedules/trigger-reminders',
        { method: 'POST' }
      );
      setActionMessage(res.message || 'Time-to-water notification sent to team!');
      setTimeout(() => setActionMessage(null), 6000);
    } catch (err: any) {
      alert(err.message || 'Failed to trigger reminder alert');
    } finally {
      setIsSendingReminderTest(false);
    }
  };

  const fetchDetails = async () => {
    try {
      setIsLoading(true);
      const res = await apiRequest<{
        plant: PlantDetail;
        caretakers: Caretaker[];
        upcomingSchedules: ScheduleItem[];
        completedSchedules?: ScheduleItem[];
        recentLogs: WaterLogItem[];
        health: HealthScore;
        isWateredToday?: boolean;
        canWaterNow?: boolean;
      }>(`/plants/${plantId}`);

      setPlant(res.plant);
      setCaretakers(res.caretakers);
      setUpcomingSchedules(res.upcomingSchedules || []);
      setCompletedSchedules(res.completedSchedules || []);
      setLogs(res.recentLogs);
      setHealth(res.health);
      setIsWateredToday(Boolean(res.isWateredToday));
      setCanWaterNow(Boolean(res.canWaterNow));
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [plantId]);

  const handleDeletePlant = async () => {
    try {
      setIsDeleting(true);
      await apiRequest(`/plants/${plantId}`, { method: 'DELETE' });
      setShowDeleteModal(false);
      onBack();
    } catch (err: any) {
      alert(err.message || 'Error deleting plant profile');
      setIsDeleting(false);
    }
  };

  if (isLoading || !plant) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 text-center">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-xs text-stone-500">Loading plant profile & live weather data...</p>
      </div>
    );
  }

  // Find next pending schedule
  const nextSchedule = upcomingSchedules.find((s) => s.status === 'pending' || s.status === 'snoozed') || upcomingSchedules[0];

  // Schedule reminder date and time check: strictly enabled ONLY when schedule date and time has occurred (<= now)
  const isScheduleDue = Boolean(
    nextSchedule && new Date(nextSchedule.date).getTime() <= Date.now()
  );

  const isWatered = Boolean(isWateredToday || wateredJustNow);
  const canWater = Boolean(!isWatered && isScheduleDue && (canWaterNow !== false));

  const nextDiffMl = nextSchedule ? nextSchedule.suggestedMl - nextSchedule.baseMl : 0;
  let verbalWord = '';
  if (nextDiffMl < -75) verbalWord = 'Drastically reduce water (minimal pour)';
  else if (nextDiffMl < -25) verbalWord = 'Reduce it moderately';
  else if (nextDiffMl < -5) verbalWord = 'Reduce it slightly';
  else if (nextDiffMl <= 5) verbalWord = 'Maintain standard hydration';
  else if (nextDiffMl <= 25) verbalWord = 'Increase it slightly';
  else if (nextDiffMl <= 75) verbalWord = 'Increase it moderately';
  else verbalWord = 'Substantially increase water';

  const crispBracket =
    nextDiffMl < 0
      ? `[Reduce by ${Math.abs(nextDiffMl)} ml, Crisp target: ${nextSchedule?.suggestedMl || plant.baseWaterMl} ml]`
      : nextDiffMl > 0
      ? `[Increase by ${nextDiffMl} ml, Crisp target: ${nextSchedule?.suggestedMl || plant.baseWaterMl} ml]`
      : `[Standard pour, Crisp target: ${nextSchedule?.suggestedMl || plant.baseWaterMl} ml]`;

  const plantSummaryForModal: PlantSummary | null = plant
    ? {
        id: plant._id,
        name: plant.name,
        emoji: plant.emoji || '🌿',
        pot: plant.pot,
        location: plant.location,
        environment: plant.environment,
        baseWaterMl: plant.baseWaterMl,
        nextWateringDate: nextSchedule ? nextSchedule.date : null,
        todaySuggestion: {
          suggestedMl: nextSchedule ? nextSchedule.suggestedMl : plant.baseWaterMl,
          baseMl: nextSchedule ? nextSchedule.baseMl : plant.baseWaterMl,
          reason: nextSchedule?.fuzzyTrace?.reason || 'Live weather suggestion',
          fuzzyFactor: nextSchedule?.fuzzyFactor || 1.0,
          verbalSuggestion: verbalWord,
          crispBracketText: crispBracket,
          crispDeltaMl: nextDiffMl,
          badge: {
            temp: nextSchedule?.weatherSnapshot ? `${nextSchedule.weatherSnapshot.temp}°C` : '20°C',
            humidity: nextSchedule?.weatherSnapshot ? `${nextSchedule.weatherSnapshot.humidity}%` : '50%',
            rain: nextSchedule?.weatherSnapshot ? `${nextSchedule.weatherSnapshot.rainMm} mm` : '0 mm',
            emoji: '🌿',
          },
          shouldSkipOrMinimal: (nextSchedule?.fuzzyFactor || 1.0) < 0.4,
        },
        health: health || {
          score: 90,
          label: 'Thriving',
          emoji: '🌿',
          color: 'emerald',
          breakdown: { consistencyPoints: 30, punctualityPoints: 30, adherencePoints: 30 },
        },
        pourDaysOfWeek: plant.pourDaysOfWeek || [1],
        isWateredToday: isWatered,
        canWaterNow: canWater,
      }
    : null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-300">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Plants</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSendSchedule}
            disabled={isSendingSchedule}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold transition-colors cursor-pointer"
            title="Email whole schedule to user and added caretakers"
          >
            <Mail className="w-4 h-4" />
            <span>{isSendingSchedule ? 'Sending...' : 'Email Whole Schedule'}</span>
          </button>
          <button
            onClick={() => onNavigateToAnalytics(plantId)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-xs font-bold transition-colors cursor-pointer"
          >
            <BarChart3 className="w-4 h-4 text-emerald-600" />
            <span>Full Analytics</span>
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="p-2 rounded-xl text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
            title="Delete Plant Profile"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Hero Plant Banner */}
      <div className="glass-card p-6 sm:p-8 rounded-3xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-100 to-teal-50 dark:from-emerald-950/60 dark:to-teal-950/40 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center justify-center text-4xl shadow-md select-none shrink-0">
              {plant.emoji || '🌿'}
            </div>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black text-stone-900 dark:text-stone-100">
                  {plant.name}
                </h1>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border capitalize bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200">
                  {plant.environment}
                </span>
                <PlantMoodBadge
                  plantName={plant.name}
                  healthScore={health ? health.score : 85}
                  isDueToday={Boolean(nextSchedule && new Date(nextSchedule.date).toDateString() === new Date().toDateString())}
                  suggestedMl={nextSchedule ? nextSchedule.suggestedMl : plant.baseWaterMl}
                  baseMl={plant.baseWaterMl}
                />
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500 dark:text-stone-400">
                <span className="flex items-center gap-1 font-medium">
                  <MapPin className="w-3.5 h-3.5 text-stone-400" />
                  {plant.location.city}
                </span>
                <span>&bull;</span>
                <span className="font-semibold text-stone-700 dark:text-stone-300">
                  Pot: {plant.pot.volumeL} L ({plant.pot.material}{plant.pot.diameterCm && plant.pot.heightCm ? ` • Ø ${plant.pot.diameterCm} cm × ${plant.pot.heightCm} cm` : ''})
                </span>
                <span>&bull;</span>
                <span>{plant.pot.drainage ? 'Drainage Hole' : 'No Drainage'}</span>
                <span>&bull;</span>
                <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-emerald-700" />
                  Preferred Time: {plant.wateringTime || '08:00'}
                </span>
              </div>
              <p className="text-xs text-stone-600 dark:text-stone-300 max-w-xl pt-1">
                {plant.careInfo.shortDescription}
              </p>
            </div>
          </div>

          {/* Health Gauge */}
          {health && (
            <div className="shrink-0 bg-white/70 dark:bg-stone-800/70 p-4 rounded-2xl border border-stone-200/60 dark:border-stone-700 flex flex-col items-center">
              <HealthGauge health={health} size="md" showDetails={true} />
            </div>
          )}
        </div>
      </div>

      {/* Quick Action Card: Next Watering & Live Fuzzy Suggestion */}
      {nextSchedule && (
        <div className="p-6 rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20 border border-emerald-200 dark:border-emerald-800 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {isWatered ? 'Next Scheduled Pour:' : isScheduleDue ? 'Watering Due Now:' : 'Next Scheduled Pour:'}
              </span>
              <span className="text-xs font-black text-stone-900 dark:text-stone-100">
                {new Date(nextSchedule.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} at {new Date(nextSchedule.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="text-xs text-stone-500">
                (Assigned to: {nextSchedule.assignedTo.name})
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-emerald-800 dark:text-emerald-200">
                {nextSchedule.suggestedMl} ml
              </span>
              <span className="text-sm font-semibold text-emerald-700/80 dark:text-emerald-400">
                (base: {nextSchedule.baseMl} ml)
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-emerald-900 dark:text-emerald-200 italic">
                "{nextSchedule.fuzzyTrace?.reason || 'Live weather evaluated'}"
              </span>
              <button
                type="button"
                onClick={() => setShowFuzzyModal(true)}
                className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>How?</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {isWatered ? (
              <button
                disabled
                className="px-6 py-3 rounded-2xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-extrabold text-xs shadow-xs cursor-not-allowed opacity-90 flex items-center gap-2"
                title="This plant was already watered today! Next schedule is active."
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Today Watered ✓</span>
              </button>
            ) : !canWater ? (
              <button
                disabled
                className="px-6 py-3 rounded-2xl bg-stone-100 dark:bg-emerald-950/20 text-stone-400 dark:text-emerald-700/60 border border-stone-200/60 dark:border-emerald-900/40 font-extrabold text-xs shadow-xs cursor-not-allowed flex items-center gap-2"
                title={
                  nextSchedule
                    ? `Watering reminder date & time has not occurred yet (${new Date(nextSchedule.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} at ${new Date(nextSchedule.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}). Button unlocks automatically at scheduled reminder time.`
                    : 'No watering schedule is due.'
                }
              >
                <Clock className="w-4 h-4 text-stone-400 dark:text-emerald-700/60" />
                <span>Scheduled</span>
              </button>
            ) : (
              <button
                onClick={() => setShowWaterModal(true)}
                className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all cursor-pointer"
                title="Water schedule reminder date & time occurred! Click to log pour with fuzzy suggestion"
              >
                <Droplet className="w-4 h-4 fill-white animate-bounce" />
                <span>Log Water Pour Now</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Grid: Care Guidelines & Upcoming Schedule */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Care Guidelines */}
        <div className="glass-card p-6 rounded-3xl space-y-4">
          <h2 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2 border-b border-stone-200/80 dark:border-stone-800 pb-3">
            <Droplet className="w-4 h-4 text-emerald-600" />
            <span>Care Blueprint</span>
          </h2>

          <div className="space-y-3 text-xs">
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-stone-50 dark:bg-stone-800/40">
              <Thermometer className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block text-stone-800 dark:text-stone-200">
                  Ideal Temp: {plant.careInfo.idealTempMin}°C - {plant.careInfo.idealTempMax}°C
                </span>
                <span className="text-stone-500">
                  Critical limits: {plant.careInfo.criticalMinTemp}°C min &bull; {plant.careInfo.criticalMaxTemp}°C max
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-stone-50 dark:bg-stone-800/40">
              <Sun className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block text-stone-800 dark:text-stone-200">
                  Light Requirements
                </span>
                <span className="text-stone-500">{plant.careInfo.light}</span>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-stone-50 dark:bg-stone-800/40">
              <Wind className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block text-stone-800 dark:text-stone-200">
                  Humidity & Soil
                </span>
                <span className="text-stone-500">
                  {plant.careInfo.humidity} &bull; {plant.careInfo.soilType}
                </span>
              </div>
            </div>

            {plant.careInfo.tips && plant.careInfo.tips.length > 0 && (
              <div className="pt-2">
                <span className="font-bold text-stone-700 dark:text-stone-300 block mb-1.5">
                  Pro Tips:
                </span>
                <ul className="space-y-1 list-disc list-inside text-stone-600 dark:text-stone-400">
                  {plant.careInfo.tips.map((tip, i) => (
                    <li key={i}>{tip}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Caretaker Circle & Collaborative Email Notifications */}
          <div className="glass-card p-6 rounded-3xl space-y-4 border border-stone-200/80 dark:border-stone-800">
            <div className="flex items-center justify-between border-b border-stone-200/80 dark:border-stone-800 pb-3">
              <h2 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-700" />
                <span>Care Team & Notification Circle</span>
              </h2>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                {caretakers.length + 1} Members
              </span>
            </div>

            {/* Email automation rules overview */}
            <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200/60 dark:border-stone-800/80 text-xs text-stone-600 dark:text-stone-300 space-y-2">
              <div className="font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-emerald-700" />
                <span>Automated Email Dispatch Rules:</span>
              </div>
              <ul className="space-y-1.5 text-[11px] list-disc list-inside text-stone-500 dark:text-stone-400">
                <li>
                  <strong className="text-stone-700 dark:text-stone-300">Whole Schedule:</strong> Sent to owner and all caretakers with pot volume, dimensions, and watering dates.
                </li>
                <li>
                  <strong className="text-stone-700 dark:text-stone-300">Time-to-Water Reminder:</strong> Dispatched at selected time (<strong>{plant.wateringTime || '08:00'}</strong>) stating <em>"It's time to water"</em> with a link stating <em>"Please update it in website"</em>.
                </li>
                <li>
                  <strong className="text-stone-700 dark:text-stone-300">Watering Confirmation:</strong> Automatically emailed to provided mails whenever the plant is watered.
                </li>
              </ul>
            </div>

            {/* Caretakers list */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-stone-700 dark:text-stone-300">Active Recipients:</div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200/60 dark:border-stone-800 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="font-bold text-stone-900 dark:text-stone-100">Plant Owner</span>
                    <span className="text-stone-400 text-[11px]">(Account Email)</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">Primary</span>
                </div>

                {caretakers.map((ct) => (
                  <div
                    key={ct._id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200/60 dark:border-stone-800 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-teal-500" />
                      <span className="font-bold text-stone-900 dark:text-stone-100">{ct.name}</span>
                      <span className="text-stone-400 text-[11px]">({ct.email})</span>
                    </div>
                    <span className="text-[10px] font-semibold text-stone-500">Caretaker</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={handleSendSchedule}
                disabled={isSendingSchedule}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>{isSendingSchedule ? 'Sending...' : 'Email Schedule to Team'}</span>
              </button>
              <button
                type="button"
                onClick={handleTestReminderAlert}
                disabled={isSendingReminderTest}
                className="flex items-center justify-center gap-1.5 px-3 py-2 border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                title="Send test time-to-water notification"
              >
                <Bell className="w-3.5 h-3.5 text-amber-600" />
                <span>{isSendingReminderTest ? 'Dispatching...' : 'Test Reminder Alert'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Upcoming & Completed Schedules */}
        <div className="space-y-6">
          {/* Upcoming Schedule List (ONLY pending & snoozed) */}
          <div className="glass-card p-6 rounded-3xl space-y-4 border border-emerald-500/20">
            <div className="flex items-center justify-between border-b border-stone-200/80 dark:border-stone-800 pb-3">
              <h2 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span>Upcoming Watering Schedule</span>
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                {upcomingSchedules.length} upcoming
              </span>
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {upcomingSchedules.length === 0 ? (
                <div className="text-center py-6 space-y-1">
                  <p className="text-xs font-semibold text-stone-500">All caught up! No upcoming pending schedules.</p>
                  <p className="text-[11px] text-stone-400">Next watering will be automatically queued per care blueprint.</p>
                </div>
              ) : (
                upcomingSchedules.map((sch) => (
                  <div
                    key={sch._id}
                    className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200/60 dark:border-stone-800/80 flex items-center justify-between text-xs hover:border-emerald-500/30 transition-colors"
                  >
                    <div className="space-y-0.5">
                      <div className="font-black text-stone-900 dark:text-stone-100">
                        {new Date(sch.date).toLocaleDateString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}{' '}
                        <span className="text-[11px] font-normal text-stone-500">
                          at {new Date(sch.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="text-[11px] text-stone-500">
                        Assigned: {sch.assignedTo?.name || 'Owner'} ({sch.assignedTo?.role || 'caretaker'})
                      </div>
                    </div>

                    <div className="text-right space-y-1">
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 block">
                        {sch.suggestedMl} ml{' '}
                        <span className="text-stone-400 text-[10px]">({sch.baseMl} ml)</span>
                      </span>
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] uppercase font-black bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                        {sch.status === 'snoozed' ? 'Snoozed ⏰' : 'Pending ⏳'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Completed Schedules Section (ONLY finished/poured schedules) */}
          <div className="glass-card p-6 rounded-3xl space-y-4 border border-stone-200/80 dark:border-stone-800">
            <div className="flex items-center justify-between border-b border-stone-200/80 dark:border-stone-800 pb-3">
              <h2 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span>Completed Schedules & History</span>
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                {completedSchedules.length} completed
              </span>
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {completedSchedules.length === 0 ? (
                <p className="text-xs text-stone-500 text-center py-6">
                  No completed schedules recorded yet. Water your plant to log the first completion!
                </p>
              ) : (
                completedSchedules.map((sch) => {
                  const compDate = sch.completedAt ? new Date(sch.completedAt) : new Date(sch.date);
                  return (
                    <div
                      key={sch._id}
                      className="p-3.5 rounded-2xl bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/20 flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>
                            {compDate.toLocaleDateString(undefined, {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                          <span className="text-[11px] text-stone-400">
                            ({compDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                          </span>
                        </div>
                        <div className="text-[11px] text-stone-500 dark:text-emerald-400/70">
                          Watered by: <strong className="text-stone-700 dark:text-emerald-300">{sch.completedBy || sch.assignedTo?.name || 'Owner'}</strong>
                        </div>
                      </div>

                      <div className="text-right space-y-1">
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 block">
                          {sch.actualMl || sch.suggestedMl} ml{' '}
                          <span className="text-stone-400 text-[10px]">({sch.baseMl} ml base)</span>
                        </span>
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] uppercase font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                          Completed ✓
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Plant Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="glass-card max-w-md w-full p-6 rounded-3xl border border-red-500/30 space-y-4 shadow-2xl animate-in zoom-in-95 bg-white dark:bg-[#07241a]">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-500 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-stone-900 dark:text-white">Delete Plant Profile?</h3>
                <p className="text-xs text-stone-500 dark:text-emerald-400/80">Permanent removal</p>
              </div>
            </div>

            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
              Are you sure you want to delete <strong className="text-stone-900 dark:text-white font-bold">{plant.name}</strong>? This action will permanently remove this plant profile, its care schedule, and all historical watering records.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeletePlant}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md shadow-red-500/20 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Profile</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Water Now Modal */}
      {plantSummaryForModal && (
        <WaterNowModal
          isOpen={showWaterModal}
          onClose={() => setShowWaterModal(false)}
          plant={plantSummaryForModal}
          onSuccess={() => {
            setWateredJustNow(true);
            fetchDetails();
          }}
        />
      )}

      {/* Fuzzy Modal */}
      {nextSchedule && (
        <FuzzyExplainerModal
          isOpen={showFuzzyModal}
          onClose={() => setShowFuzzyModal(false)}
          plantName={plant.name}
          plantEmoji={plant.emoji}
          todaySuggestion={{
            suggestedMl: nextSchedule.suggestedMl,
            baseMl: nextSchedule.baseMl,
            reason: nextSchedule.fuzzyTrace?.reason || 'Live weather suggestion',
            fuzzyFactor: nextSchedule.fuzzyFactor,
            badge: {
              temp: nextSchedule.weatherSnapshot ? `${nextSchedule.weatherSnapshot.temp}°C` : '20°C',
              humidity: nextSchedule.weatherSnapshot ? `${nextSchedule.weatherSnapshot.humidity}%` : '50%',
              rain: nextSchedule.weatherSnapshot ? `${nextSchedule.weatherSnapshot.rainMm} mm` : '0 mm',
              emoji: '🌿',
            },
            shouldSkipOrMinimal: nextSchedule.fuzzyFactor < 0.4,
          }}
          fuzzyTrace={nextSchedule.fuzzyTrace}
        />
      )}
    </div>
  );
};
