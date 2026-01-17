import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';

type ThemeMode = 'light' | 'dark';

interface ThemeColors {
  background: string;
  card: string;
  text: string;
  textSecondary: string;
  border: string;
  borderFocused: string;
  borderLight: string;
  primary: string;
  primaryLight: string;
  danger: string;
  icon: string;
  iconMuted: string;
}

interface ThemeContextType {
  mode: ThemeMode;
  colors: ThemeColors;
  toggleTheme: () => void;
  isDark: boolean;
}

const lightColors: ThemeColors = {
  background: '#FAFAFA',
  card: '#FFFFFF',
  text: '#111827',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  borderFocused: '#003C6C',
  borderLight: '#F3F4F6',
  primary: '#003C6C',
  primaryLight: '#E8F4FC',
  danger: '#EF4444',
  icon: '#003C6C',
  iconMuted: '#9CA3AF',
};

const darkColors: ThemeColors = {
  background: '#070F1B',
  card: '#152238',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  border: '#1E3448',
  borderFocused: '#E5E7EB',
  borderLight: '#243B55',
  primary: '#60A5FA',
  primaryLight: '#1E3A5F',
  danger: '#F87171',
  icon: '#60A5FA',
  iconMuted: '#64748B',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_KEY = 'theme_mode';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('light');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedTheme = await SecureStore.getItemAsync(THEME_KEY);
      if (savedTheme === 'dark' || savedTheme === 'light') {
        setMode(savedTheme);
      }
    } catch (error) {
      console.error('Error loading theme:', error);
    } finally {
      setIsLoaded(true);
    }
  };

  const toggleTheme = async () => {
    const newMode = mode === 'light' ? 'dark' : 'light';
    setMode(newMode);
    try {
      await SecureStore.setItemAsync(THEME_KEY, newMode);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const colors = mode === 'light' ? lightColors : darkColors;

  if (!isLoaded) {
    return null;
  }

  return (
    <ThemeContext.Provider
      value={{
        mode,
        colors,
        toggleTheme,
        isDark: mode === 'dark',
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
