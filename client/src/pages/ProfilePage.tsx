import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { apiRequest } from '../api/client.js';
import {
  Check,
  Clock,
  Globe,
  ArrowLeft,
  Plus,
  Mail,
  Send,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  KeyRound,
  Server,
} from 'lucide-react';

interface ProfilePageProps {
  onBack: () => void;
  onNavigateToPlants?: () => void;
}

const COMMON_TIMEZONES = [
  'UTC',
  'Europe/Zurich',
  'Europe/Berlin',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
];

interface SmtpStatusResponse {
  configured: boolean;
  service?: string;
  host: string;
  port: number;
  user: string;
  from: string;
  isEthereal: boolean;
  lastTestMessageUrl: string | null;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onBack, onNavigateToPlants }) => {
  const { user, updateProfile } = useAuth();

  // Profile preferences
  const [name, setName] = useState(user?.name || '');
  const [email] = useState(user?.email || '');
  const [timezone, setTimezone] = useState(user?.timezone || 'Europe/Zurich');
  const [reminderTime, setReminderTime] = useState(user?.reminderTime || '08:00');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // SMTP Settings
  const [smtpStatus, setSmtpStatus] = useState<SmtpStatusResponse | null>(null);
  const [isLoadingSmtp, setIsLoadingSmtp] = useState(true);
  const [providerType, setProviderType] = useState<'gmail' | 'custom'>('gmail');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState(587);
  const [emailFrom, setEmailFrom] = useState('');
  const [isSavingSmtp, setIsSavingSmtp] = useState(false);
  const [smtpMessage, setSmtpMessage] = useState<{ type: 'success' | 'error'; text: string; previewUrl?: string } | null>(null);

  // Test email state
  const [testEmailTo, setTestEmailTo] = useState(user?.email || '');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ message: string; previewUrl?: string } | null>(null);

  const fetchSmtpStatus = async () => {
    try {
      setIsLoadingSmtp(true);
      const res = await apiRequest<SmtpStatusResponse>('/auth/smtp-status');
      setSmtpStatus(res);
      if (res.service === 'gmail') {
        setProviderType('gmail');
      } else if (res.configured) {
        setProviderType('custom');
      }
      setSmtpHost(res.host);
      setSmtpPort(res.port);
      setEmailFrom(res.from);
    } catch (err) {
      console.warn('Could not load SMTP status:', err);
    } finally {
      setIsLoadingSmtp(false);
    }
  };

  useEffect(() => {
    fetchSmtpStatus();
  }, []);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await updateProfile({ name, timezone, reminderTime });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Error updating profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSmtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSavingSmtp(true);
      setSmtpMessage(null);
      const payload = {
        service: providerType === 'gmail' ? 'gmail' : undefined,
        host: providerType === 'gmail' ? 'smtp.gmail.com' : smtpHost,
        port: providerType === 'gmail' ? 587 : smtpPort,
        user: smtpUser.trim(),
        pass: smtpPass.trim(),
        from: emailFrom.trim() || undefined,
      };

      const res = await apiRequest<{ message: string; verified: boolean; isEthereal: boolean; status: SmtpStatusResponse }>(
        '/auth/smtp-config',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );

      setSmtpStatus(res.status);
      setSmtpMessage({
        type: res.verified ? 'success' : 'error',
        text: res.message,
      });
      setSmtpPass(''); // clear password for security
    } catch (err: any) {
      setSmtpMessage({
        type: 'error',
        text: err.message || 'Failed to save SMTP settings.',
      });
    } finally {
      setIsSavingSmtp(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmailTo) {
      alert('Please enter a recipient email address.');
      return;
    }
    try {
      setIsSendingTest(true);
      setTestResult(null);
      const res = await apiRequest<{ success: boolean; message: string; previewUrl?: string }>(
        '/auth/test-email',
        {
          method: 'POST',
          body: JSON.stringify({ toEmail: testEmailTo.trim() }),
        }
      );
      setTestResult({
        message: res.message,
        previewUrl: res.previewUrl,
      });
    } catch (err: any) {
      alert(err.message || 'Failed to send test email');
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-300">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-stone-900 dark:text-stone-100">
              User Profile & Email Delivery
            </h1>
            <p className="text-xs text-stone-500">
              Manage personal details, watering time preferences, and live email notifications.
            </p>
          </div>
        </div>

        {onNavigateToPlants && (
          <button
            type="button"
            onClick={onNavigateToPlants}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-800 hover:bg-emerald-900 text-white shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add Plant</span>
          </button>
        )}
      </div>

      {savedSuccess && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300 rounded-xl text-xs flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-700" />
          <span>Profile preferences saved successfully!</span>
        </div>
      )}

      {/* Profile Form */}
      <form onSubmit={handleProfileSubmit} className="glass-card p-6 sm:p-8 rounded-2xl space-y-5 border border-stone-200 dark:border-stone-800">
        <h2 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2 border-b border-stone-200 dark:border-stone-800 pb-3">
          <span>Personal Preferences</span>
        </h2>

        <div>
          <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
            Full Name
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-bold text-stone-900 dark:text-stone-100"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
            Email Address
          </label>
          <input
            type="email"
            disabled
            value={email}
            className="w-full px-3.5 py-2.5 bg-stone-100 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 rounded-xl text-xs text-stone-500 cursor-not-allowed"
          />
          <span className="text-[10px] text-stone-400 block mt-1">
            Used as the primary destination for schedule updates and watering alerts.
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-stone-400" />
              <span>Timezone</span>
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-3 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-semibold text-stone-900 dark:text-stone-100"
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-stone-400" />
              <span>Default Reminder Time</span>
            </label>
            <input
              type="time"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
              className="w-full px-3 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-semibold text-stone-900 dark:text-stone-100"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between">
          {onNavigateToPlants ? (
            <button
              type="button"
              onClick={onNavigateToPlants}
              className="px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 text-xs font-semibold cursor-pointer"
            >
              Go to Add Plant
            </button>
          ) : <div />}

          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
          >
            {isSaving ? 'Saving...' : 'Save Profile Changes'}
          </button>
        </div>
      </form>

      {/* Email & SMTP Notification Settings Card */}
      <div className="glass-card p-6 sm:p-8 rounded-2xl space-y-6 border border-stone-200 dark:border-stone-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 dark:border-stone-800 pb-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <Mail className="w-4 h-4 text-emerald-700" />
              <span>Email Notification Delivery Setup</span>
            </h2>
            <p className="text-xs text-stone-500">
              Configure how scheduled watering plans, time-to-water alerts, and pour confirmations are sent.
            </p>
          </div>

          {/* Delivery Status Badge */}
          {smtpStatus && (
            <div className="shrink-0">
              {smtpStatus.configured && !smtpStatus.isEthereal ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Live SMTP Active</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Simulation Mode (Ethereal)</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Informational Guidance */}
        <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700/80 text-xs text-stone-600 dark:text-stone-300 space-y-2">
          <div className="font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
            <KeyRound className="w-4 h-4 text-emerald-700" />
            <span>Why configure real email credentials?</span>
          </div>
          <p className="leading-relaxed">
            Without real credentials, emails run in simulation mode (virtual test mailer with clickable preview links in server logs).
            To receive live emails directly in your Gmail/Outlook/Yahoo inbox, connect your Gmail account with a 16-character App Password or custom SMTP server below.
          </p>
          <div className="text-[11px] text-stone-500">
            For Gmail: Enable 2-step verification, then create an App Password at{' '}
            <a
              href="https://myaccount.google.com/apppasswords"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-700 dark:text-emerald-400 font-bold hover:underline inline-flex items-center gap-0.5"
            >
              <span>Google Account &rarr; App Passwords</span>
              <ExternalLink className="w-3 h-3" />
            </a>.
          </div>
        </div>

        {/* SMTP Configuration Form */}
        <form onSubmit={handleSmtpSubmit} className="space-y-4">
          <div className="flex items-center gap-4">
            <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
              Provider Mode:
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setProviderType('gmail')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  providerType === 'gmail'
                    ? 'bg-emerald-800 text-white border-emerald-800'
                    : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
              >
                Gmail (App Password)
              </button>
              <button
                type="button"
                onClick={() => setProviderType('custom')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  providerType === 'custom'
                    ? 'bg-emerald-800 text-white border-emerald-800'
                    : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
              >
                Custom SMTP Server
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                {providerType === 'gmail' ? 'Gmail Address (Username)' : 'SMTP Username / Email'}
              </label>
              <input
                type="email"
                required
                placeholder={providerType === 'gmail' ? 'your_email@gmail.com' : 'username@domain.com'}
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                {providerType === 'gmail' ? 'Google 16-Char App Password' : 'SMTP Password'}
              </label>
              <input
                type="password"
                required
                placeholder={providerType === 'gmail' ? 'xxxx xxxx xxxx xxxx' : '••••••••••••'}
                value={smtpPass}
                onChange={(e) => setSmtpPass(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-mono"
              />
            </div>
          </div>

          {providerType === 'custom' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  SMTP Host
                </label>
                <input
                  type="text"
                  required
                  placeholder="smtp.example.com"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  SMTP Port
                </label>
                <input
                  type="number"
                  required
                  placeholder="587"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-medium"
                />
              </div>
            </div>
          )}

          {smtpMessage && (
            <div
              className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                smtpMessage.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-emerald-900 dark:text-emerald-300'
                  : 'bg-red-50 dark:bg-red-950/40 border border-red-200 text-red-900 dark:text-red-300'
              }`}
            >
              {smtpMessage.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              )}
              <span>{smtpMessage.text}</span>
            </div>
          )}

          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={isSavingSmtp}
              className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              {isSavingSmtp ? 'Verifying & Saving...' : 'Save & Verify SMTP Credentials'}
            </button>
          </div>
        </form>

        {/* Test Email Section */}
        <div className="pt-5 border-t border-stone-200 dark:border-stone-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-emerald-700" />
              <span>Send Verification Test Email</span>
            </h3>
            <span className="text-[11px] text-stone-400">Verifies email reachability</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              placeholder="recipient@example.com"
              value={testEmailTo}
              onChange={(e) => setTestEmailTo(e.target.value)}
              className="flex-1 px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-medium"
            />
            <button
              type="button"
              onClick={handleSendTestEmail}
              disabled={isSendingTest}
              className="px-4 py-2 bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 rounded-xl text-xs font-bold hover:bg-emerald-800 transition-colors shrink-0 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isSendingTest ? (
                <span>Sending...</span>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Test Email</span>
                </>
              )}
            </button>
          </div>

          {testResult && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-emerald-900 dark:text-emerald-300 rounded-xl text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>{testResult.message}</span>
              </div>
              {testResult.previewUrl && (
                <div className="pt-1 text-[11px]">
                  <span>Virtual test preview link: </span>
                  <a
                    href={testResult.previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold underline text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-0.5"
                  >
                    <span>Click to view email output in browser</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
