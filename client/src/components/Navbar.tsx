import React from 'react';
import { useAuth } from '../context/AuthContext.js';
import { Sprout, BarChart3, Sun, Moon, LogOut, User as UserIcon, Plus } from 'lucide-react';

interface NavbarProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, onNavigate }) => {
  const { user, logout, theme, toggleTheme } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full glass border-b border-stone-200 dark:border-stone-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo & Name */}
        <button
          onClick={() => onNavigate('home')}
          className="flex items-center gap-3 text-left group focus:outline-none cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-800 text-white flex items-center justify-center shadow-sm shrink-0">
            <Sprout className="w-5 h-5 text-emerald-100 stroke-[2.4]" />
          </div>
          <div>
            <div className="font-extrabold text-base sm:text-lg tracking-tight text-stone-900 dark:text-stone-100 leading-tight">
              Hydrate your plant <span className="text-emerald-800 dark:text-emerald-400 font-semibold text-xs sm:text-sm">using fuzzy logic</span>
            </div>
            <span className="text-[11px] block text-stone-500 dark:text-stone-400 font-medium -mt-0.5">
              Intelligent Plant Care Scheduler
            </span>
          </div>
        </button>

        {/* Navigation links */}
        {user ? (
          <div className="flex items-center gap-2 sm:gap-3">
            <nav className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800/80 p-1 rounded-xl border border-stone-200 dark:border-stone-700/80">
              <button
                onClick={() => onNavigate('home')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  currentView === 'home'
                    ? 'bg-white dark:bg-stone-700 text-emerald-800 dark:text-emerald-300 shadow-2xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                }`}
              >
                Plants
              </button>
              <button
                onClick={() => onNavigate('analytics')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  currentView === 'analytics'
                    ? 'bg-white dark:bg-stone-700 text-emerald-800 dark:text-emerald-300 shadow-2xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Analytics</span>
              </button>
              <button
                onClick={() => onNavigate('create')}
                className={`hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  currentView === 'create'
                    ? 'bg-emerald-800 text-white shadow-2xs'
                    : 'text-emerald-800 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                }`}
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Add Plant</span>
              </button>
            </nav>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              aria-label="Toggle Theme"
              className="p-2 rounded-xl text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors border border-transparent cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-stone-300" /> : <Moon className="w-4 h-4 text-stone-600" />}
            </button>

            {/* Profile Dropdown / Action */}
            <button
              onClick={() => onNavigate('profile')}
              className={`p-2 rounded-xl text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer border ${
                currentView === 'profile'
                  ? 'bg-stone-100 dark:bg-stone-800 text-emerald-800 dark:text-emerald-400 border-stone-300 dark:border-stone-700'
                  : 'border-transparent'
              }`}
              title="Profile & Settings"
            >
              <UserIcon className="w-4 h-4" />
            </button>

            {/* Logout */}
            <button
              onClick={logout}
              className="p-2 rounded-xl text-stone-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              aria-label="Toggle Theme"
              className="p-2 rounded-xl text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-stone-300" /> : <Moon className="w-4 h-4 text-stone-600" />}
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
