import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client.js';
import confetti from 'canvas-confetti';
import {
  CheckCircle,
  XCircle,
  Clock,
  Droplet,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Calendar,
  AlertTriangle,
  MapPin,
  Award,
} from 'lucide-react';

interface ConfirmationPageProps {
  scheduleId?: string;
  token?: string;
  onDone: () => void;
}

export const ConfirmationPage: React.FC<ConfirmationPageProps> = ({
  scheduleId,
  token,
  onDone,
}) => {
  // If scheduleId not passed via props, look at URL query params
  const searchParams = new URLSearchParams(window.location.search);
  const activeScheduleId = scheduleId || searchParams.get('scheduleId') || '';
  const activeToken = token || searchParams.get('token') || '';

  const [details, setDetails] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [choice, setChoice] = useState<'yes' | 'no' | 'snooze'>('yes');

  // Form inputs
  const [personName, setPersonName] = useState('');
  const [amountPoured, setAmountPoured] = useState<number>(300);
  const [notes, setNotes] = useState('');
  const [snoozeMinutes, setSnoozeMinutes] = useState<number>(30);
  const [customSnooze, setCustomSnooze] = useState('');

  // Result state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedStatus, setSubmittedStatus] = useState<string | null>(null);
  const [badgesEarned, setBadgesEarned] = useState<any[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!activeScheduleId) {
      setIsLoading(false);
      setErrorMessage('No watering schedule ID provided.');
      return;
    }

    const fetchDetails = async () => {
      try {
        setIsLoading(true);
        const res = await apiRequest(`/confirm/schedule/${activeScheduleId}?token=${activeToken}`);
        setDetails(res);
        setPersonName(res.schedule.assignedTo?.name || '');
        setAmountPoured(res.schedule.suggestedMl || 300);

        if (res.isCompleted) {
          setSubmittedStatus('already-completed');
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'Error loading watering details');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetails();
  }, [activeScheduleId, activeToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personName.trim()) {
      alert('Please confirm your name');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const finalSnoozeMins =
        choice === 'snooze' && customSnooze ? parseInt(customSnooze, 10) : snoozeMinutes;

      const payload = {
        scheduleId: activeScheduleId,
        token: activeToken,
        choice,
        personName: personName.trim(),
        amountPouredMl: choice === 'yes' ? amountPoured : 0,
        reason: notes.trim(),
        snoozeMinutes: choice === 'snooze' ? finalSnoozeMins : undefined,
      };

      const res = await apiRequest('/confirm/submit', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setSubmittedStatus(res.status);

      if (choice === 'yes') {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#10b981', '#34d399', '#059669', '#f59e0b'],
        });
        if (res.badgesAwarded && res.badgesAwarded.length > 0) {
          setBadgesEarned(res.badgesAwarded);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit response');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-xs text-stone-500">Loading watering confirmation details...</p>
      </div>
    );
  }

  if (errorMessage && !details) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-red-100 dark:bg-red-950 flex items-center justify-center text-red-600 mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">Schedule Not Found</h2>
        <p className="text-xs text-stone-500 mt-2">{errorMessage}</p>
        <button
          onClick={onDone}
          className="mt-6 px-6 py-2.5 rounded-xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 text-xs font-bold"
        >
          Go to Home
        </button>
      </div>
    );
  }

  const { schedule, plant } = details;

  return (
    <div className="max-w-xl mx-auto px-4 py-10 space-y-6 animate-in fade-in duration-300">
      {/* Plant Header Card */}
      <div className="glass-card p-6 rounded-3xl text-center space-y-3 relative overflow-hidden">
        <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-emerald-100 to-teal-50 dark:from-emerald-950 dark:to-teal-950 flex items-center justify-center text-4xl shadow-md">
          {plant.emoji || '🌿'}
        </div>
        <div>
          <h1 className="text-2xl font-black text-stone-900 dark:text-stone-100">{plant.name}</h1>
          <p className="text-xs text-stone-500 flex items-center justify-center gap-1.5 mt-0.5">
            <MapPin className="w-3.5 h-3.5" />
            <span>{plant.location.city}</span> &bull;
            <span>Pot: {plant.pot.volumeL} L ({plant.pot.material}{plant.pot.diameterCm && plant.pot.heightCm ? ` • Ø ${plant.pot.diameterCm} cm × ${plant.pot.heightCm} cm` : ''})</span>
          </p>
        </div>

        {/* Suggestion Summary Banner */}
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 text-left">
          <div className="flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300 font-semibold mb-1">
            <span>Weather-Smart Suggestion:</span>
            <span>{schedule.fuzzyFactor}× adjustment</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-800 dark:text-emerald-200">
              {schedule.suggestedMl} ml
            </span>
            <span className="text-xs font-bold text-emerald-700/80 dark:text-emerald-400">
              (base: {schedule.baseMl} ml)
            </span>
          </div>
          <p className="mt-1 text-xs text-emerald-900/90 dark:text-emerald-200/90 italic">
            "{schedule.fuzzyTrace?.reason || 'Live weather suggestion'}"
          </p>
        </div>
      </div>

      {/* Confirmation State Result */}
      {submittedStatus ? (
        <div className="glass-card p-8 rounded-3xl text-center space-y-5 animate-in zoom-in-95 duration-300">
          {submittedStatus === 'completed' || submittedStatus === 'already-completed' ? (
            <>
              <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600">
                <CheckCircle className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-black text-stone-900 dark:text-stone-100">
                Thank You, Plant Hero! 🎉
              </h2>
              <p className="text-xs text-stone-600 dark:text-stone-300 max-w-sm mx-auto">
                Your pour of <strong>{amountPoured} ml</strong> for {plant.name} has been logged.
                The health score and team dashboard have been updated!
              </p>

              {/* Awarded Badges */}
              {badgesEarned.length > 0 && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 rounded-2xl space-y-2">
                  <div className="text-xs font-extrabold uppercase text-amber-800 dark:text-amber-300 flex items-center justify-center gap-1.5">
                    <Award className="w-4 h-4" />
                    New Achievement Unlocked!
                  </div>
                  {badgesEarned.map((b, idx) => (
                    <div key={idx} className="flex items-center justify-center gap-2 text-xs font-bold text-stone-900 dark:text-stone-100">
                      <span className="text-xl">{b.icon || '🏆'}</span>
                      <span>{b.badge}: {b.description}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : submittedStatus === 'missed' ? (
            <>
              <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-100 dark:bg-rose-950 flex items-center justify-center text-rose-600">
                <XCircle className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-black text-stone-900 dark:text-stone-100">
                Logged as Missed
              </h2>
              <p className="text-xs text-stone-600 dark:text-stone-300">
                Notice has been sent to the care team.
              </p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-amber-600">
                <Clock className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-black text-stone-900 dark:text-stone-100">
                Reminder Snoozed!
              </h2>
              <p className="text-xs text-stone-600 dark:text-stone-300">
                We will ping you again in {snoozeMinutes} minutes.
              </p>
            </>
          )}

          <button
            onClick={onDone}
            className="px-6 py-2.5 rounded-xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 text-xs font-bold"
          >
            Return to Dashboard
          </button>
        </div>
      ) : (
        /* Action Form */
        <form onSubmit={handleSubmit} className="glass-card p-6 sm:p-8 rounded-3xl space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-xl font-black text-stone-900 dark:text-stone-100">
              Did you pour water?
            </h2>
            <p className="text-xs text-stone-500">
              Confirm or snooze today's scheduled watering session.
            </p>
          </div>

          {/* 3 Choice Buttons: Yes / No / Snooze */}
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setChoice('yes')}
              className={`p-4 rounded-2xl border text-center transition-all ${
                choice === 'yes'
                  ? 'bg-emerald-600 text-white font-black border-emerald-600 shadow-md shadow-emerald-600/25 scale-[1.02]'
                  : 'border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800'
              }`}
            >
              <CheckCircle className="w-6 h-6 mx-auto mb-1" />
              <span className="text-sm font-bold block">Yes</span>
              <span className="text-[10px] opacity-80">Poured water</span>
            </button>

            <button
              type="button"
              onClick={() => setChoice('no')}
              className={`p-4 rounded-2xl border text-center transition-all ${
                choice === 'no'
                  ? 'bg-rose-600 text-white font-black border-rose-600 shadow-md shadow-rose-600/25 scale-[1.02]'
                  : 'border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800'
              }`}
            >
              <XCircle className="w-6 h-6 mx-auto mb-1" />
              <span className="text-sm font-bold block">No</span>
              <span className="text-[10px] opacity-80">Mark missed</span>
            </button>

            <button
              type="button"
              onClick={() => setChoice('snooze')}
              className={`p-4 rounded-2xl border text-center transition-all ${
                choice === 'snooze'
                  ? 'bg-amber-600 text-white font-black border-amber-600 shadow-md shadow-amber-600/25 scale-[1.02]'
                  : 'border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800'
              }`}
            >
              <Clock className="w-6 h-6 mx-auto mb-1" />
              <span className="text-sm font-bold block">Snooze</span>
              <span className="text-[10px] opacity-80">Remind later</span>
            </button>
          </div>

          {/* Person Name Input */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
              Your Name:
            </label>
            <input
              type="text"
              required
              value={personName}
              onChange={(e) => setPersonName(e.target.value)}
              placeholder="e.g. Alex Green"
              className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-bold"
            />
          </div>

          {/* Conditional Fields based on Choice */}
          {choice === 'yes' && (
            <div className="space-y-4 pt-1 animate-in fade-in">
              <div>
                <div className="flex justify-between text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                  <span>Actual Amount Poured:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">
                    {amountPoured} ml
                  </span>
                </div>
                <input
                  type="range"
                  min="20"
                  max={Math.max(800, schedule.suggestedMl * 2)}
                  step="10"
                  value={amountPoured}
                  onChange={(e) => setAmountPoured(parseInt(e.target.value, 10))}
                  className="w-full accent-emerald-600 h-2 bg-stone-200 dark:bg-stone-800 rounded-lg cursor-pointer"
                />
                <span className="text-[10px] text-stone-400 block mt-1">
                  Default is today's suggested {schedule.suggestedMl} ml
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Notes (Optional):
                </label>
                <input
                  type="text"
                  placeholder="e.g. Added diluted liquid fertilizer"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs"
                />
              </div>
            </div>
          )}

          {choice === 'no' && (
            <div className="space-y-3 pt-1 animate-in fade-in">
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
                Reason for Missing (Optional):
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Soil still felt thoroughly damp from rain"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3.5 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs"
              />
            </div>
          )}

          {choice === 'snooze' && (
            <div className="space-y-3 pt-1 animate-in fade-in">
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
                Remind me in how long?
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: '15m', mins: 15 },
                  { label: '30m', mins: 30 },
                  { label: '1h', mins: 60 },
                  { label: '3h', mins: 180 },
                ].map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => {
                      setSnoozeMinutes(s.mins);
                      setCustomSnooze('');
                    }}
                    className={`py-2 rounded-xl border text-xs font-bold transition-all ${
                      snoozeMinutes === s.mins && !customSnooze
                        ? 'bg-amber-600 text-white border-amber-600 font-extrabold'
                        : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <div className="pt-1">
                <input
                  type="number"
                  placeholder="Or custom minutes (e.g. 45)"
                  value={customSnooze}
                  onChange={(e) => setCustomSnooze(e.target.value)}
                  className="w-full px-3 py-1.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs"
                />
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-3.5 px-6 rounded-2xl text-white font-extrabold text-sm shadow-md transition-all hover:scale-[1.02] flex items-center justify-center gap-2 ${
                choice === 'yes'
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25'
                  : choice === 'no'
                  ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/25'
                  : 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/25'
              }`}
            >
              <span>
                {isSubmitting
                  ? 'Submitting...'
                  : choice === 'yes'
                  ? 'Confirm Watering Pour ✅'
                  : choice === 'no'
                  ? 'Mark Day as Missed ❌'
                  : 'Snooze Reminder ⏰'}
              </span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
