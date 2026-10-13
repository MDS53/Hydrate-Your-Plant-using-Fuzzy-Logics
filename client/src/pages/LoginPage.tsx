import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { apiRequest } from '../api/client.js';
import { Sprout, Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';

interface LoginPageProps {
  onSwitchToRegister: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSwitchToRegister }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      setError(null);
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFillDemo = () => {
    setEmail('sophia@example.com');
    setPassword('password123');
  };

  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: forgotEmail }),
      });
      setForgotMessage(res.message || 'Reset instructions sent.');
    } catch (err: any) {
      alert(err.message || 'Error requesting password reset');
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 animate-in fade-in duration-300">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-800 text-white flex items-center justify-center shadow-sm">
            <Sprout className="w-7 h-7 stroke-[2.2]" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-stone-900 dark:text-stone-100">
            Hydrate your plant using fuzzy logic
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Sign in to access your plant collection and smart watering schedules.
          </p>
        </div>

        {/* Demo Account Quick-Fill Pill */}
        <div className="p-3 bg-stone-100 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 rounded-xl flex items-center justify-between text-xs">
          <div className="text-stone-700 dark:text-stone-300">
            <span className="font-bold block">Demo account:</span>
            <span className="text-[11px] text-stone-500">sophia@example.com &bull; password123</span>
          </div>
          <button
            type="button"
            onClick={handleFillDemo}
            className="px-2.5 py-1 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-[11px] transition-colors cursor-pointer"
          >
            Auto-fill
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Card */}
        <form onSubmit={handleSubmit} className="glass-card p-8 rounded-2xl space-y-4 border border-stone-200 dark:border-stone-800">
          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-700 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                className="text-[11px] text-emerald-800 dark:text-emerald-400 hover:underline font-semibold cursor-pointer"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-700 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 mt-2 cursor-pointer"
          >
            <span>{isLoading ? 'Signing in...' : 'Sign In to Dashboard'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Switch to Register */}
        <div className="text-center text-xs text-stone-500">
          <span>Don't have an account yet? </span>
          <button
            onClick={onSwitchToRegister}
            className="font-bold text-emerald-800 dark:text-emerald-400 hover:underline cursor-pointer"
          >
            Create an account
          </button>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl max-w-sm w-full p-6 space-y-4">
            <h3 className="font-bold text-base text-stone-900 dark:text-stone-100">Reset Password</h3>
            <p className="text-xs text-stone-500">
              Enter your registered email address and we'll generate password reset instructions.
            </p>

            {forgotMessage ? (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs rounded-xl">
                {forgotMessage}
              </div>
            ) : (
              <form onSubmit={handleSendReset} className="space-y-3">
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border rounded-xl text-xs"
                />
                <button
                  type="submit"
                  className="w-full py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-xl text-xs cursor-pointer"
                >
                  Send Reset Link
                </button>
              </form>
            )}

            <button
              onClick={() => {
                setShowForgotModal(false);
                setForgotMessage(null);
              }}
              className="w-full py-2 bg-stone-100 dark:bg-stone-800 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
