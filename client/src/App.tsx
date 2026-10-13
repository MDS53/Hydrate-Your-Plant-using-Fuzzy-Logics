import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { Navbar } from './components/Navbar.js';
import { HomePage } from './pages/HomePage.js';
import { CreatePlantPage } from './pages/CreatePlantPage.js';
import { PlantDetailPage } from './pages/PlantDetailPage.js';
import { AnalyticsPage } from './pages/AnalyticsPage.js';
import { ConfirmationPage } from './pages/ConfirmationPage.js';
import { ProfilePage } from './pages/ProfilePage.js';
import { LoginPage } from './pages/LoginPage.js';
import { RegisterPage } from './pages/RegisterPage.js';

const MainApp: React.FC = () => {
  const { user, isLoading } = useAuth();

  // Route state
  const [currentView, setCurrentView] = useState<string>('home');
  const [selectedPlantId, setSelectedPlantId] = useState<string | undefined>(undefined);
  const [confirmScheduleId, setConfirmScheduleId] = useState<string | undefined>(undefined);

  // Check URL on initial mount (for direct magic links like /confirm?scheduleId=...)
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.pathname.includes('/confirm') || url.searchParams.get('scheduleId')) {
      setCurrentView('confirm');
      setConfirmScheduleId(url.searchParams.get('scheduleId') || undefined);
    }
  }, []);

  const handleNavigate = (view: string, plantId?: string) => {
    setCurrentView(view);
    if (plantId) setSelectedPlantId(plantId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-950">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-emerald-800 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-stone-500 font-medium">Loading Hydrate your plant using fuzzy logic...</p>
        </div>
      </div>
    );
  }

  // If not logged in, but hitting confirmation page with scheduleId:
  if (!user && currentView === 'confirm') {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-stone-950 bg-mesh-nature">
        <Navbar currentView={currentView} onNavigate={handleNavigate} />
        <main className="pb-16">
          <ConfirmationPage
            scheduleId={confirmScheduleId}
            onDone={() => handleNavigate('home')}
          />
        </main>
      </div>
    );
  }

  // If not logged in: show Login or Register
  if (!user) {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-stone-950 bg-mesh-nature">
        <Navbar currentView={currentView} onNavigate={handleNavigate} />
        <main className="pb-16">
          {currentView === 'register' ? (
            <RegisterPage
              onSwitchToLogin={() => handleNavigate('login')}
              onRegisterSuccess={() => handleNavigate('create')}
            />
          ) : (
            <LoginPage onSwitchToRegister={() => handleNavigate('register')} />
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 bg-mesh-nature flex flex-col justify-between">
      <div>
        <Navbar currentView={currentView} onNavigate={handleNavigate} />

        <main className="pb-16">
          {currentView === 'home' && (
            <HomePage onNavigate={handleNavigate} />
          )}

          {currentView === 'create' && (
            <CreatePlantPage
              onBack={() => handleNavigate('home')}
              onSuccess={(newId) => handleNavigate('plant-detail', newId)}
            />
          )}

          {currentView === 'plant-detail' && selectedPlantId && (
            <PlantDetailPage
              plantId={selectedPlantId}
              onBack={() => handleNavigate('home')}
              onNavigateToAnalytics={(pId) => handleNavigate('analytics', pId)}
              onNavigateToConfirm={(sId) => {
                setConfirmScheduleId(sId);
                handleNavigate('confirm');
              }}
            />
          )}

          {currentView === 'analytics' && (
            <AnalyticsPage
              initialPlantId={selectedPlantId}
              onNavigateToPlant={(pId) => handleNavigate('plant-detail', pId)}
            />
          )}

          {currentView === 'confirm' && (
            <ConfirmationPage
              scheduleId={confirmScheduleId}
              onDone={() => handleNavigate('home')}
            />
          )}

          {currentView === 'profile' && (
            <ProfilePage
              onBack={() => handleNavigate('home')}
              onNavigateToPlants={() => handleNavigate('create')}
            />
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-stone-200 dark:border-stone-800 py-6 text-center text-xs text-stone-500 dark:text-stone-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-semibold text-stone-700 dark:text-stone-300">
            <span>🌿 Hydrate your plant using fuzzy logic</span>
            <span>&bull;</span>
            <span className="text-emerald-800 dark:text-emerald-400 font-bold">Smart Watering Scheduler</span>
          </div>
          <div>
            Intelligent botanical hydration calibrated by pot volume, species requirements, and weather conditions.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
