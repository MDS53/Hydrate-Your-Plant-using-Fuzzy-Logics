import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types/index.js';
import { apiRequest } from '../api/client.js';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, timezone?: string, reminderTime?: string) => Promise<void>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('plant_care_token'));
  const [isLoading, setIsLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('plant_theme');
    if (saved === 'dark' && localStorage.getItem('plant_theme_user_selected') === 'true') {
      return 'dark';
    }
    return 'light';
  });

  // Apply dark mode class to html
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('plant_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('plant_theme_user_selected', 'true');
      return next;
    });
  };

  const refreshUser = async () => {
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const data = await apiRequest<{ user: User }>('/auth/me');
      setUser(data.user);
    } catch (err) {
      console.warn('Failed to fetch user with existing token. Clearing session.');
      localStorage.removeItem('plant_care_token');
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, [token]);

  const login = async (email: string, password: string) => {
    const data = await apiRequest<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    localStorage.setItem('plant_care_token', data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const register = async (name: string, email: string, password: string, timezone?: string, reminderTime?: string) => {
    const data = await apiRequest<{ token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, timezone, reminderTime }),
    });

    localStorage.setItem('plant_care_token', data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('plant_care_token');
    setToken(null);
    setUser(null);
  };

  const updateProfile = async (data: Partial<User>) => {
    const res = await apiRequest<{ user: User }>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    setUser(res.user);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        theme,
        toggleTheme,
        login,
        register,
        logout,
        updateProfile,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
