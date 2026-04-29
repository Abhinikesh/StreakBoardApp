import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

export const DARK = {
  bg:           '#0d0d1a',
  card:         '#111120',
  border:       '#1e1e2e',
  borderHover:  '#2a2a3a',
  primary:      '#7c3aed',
  primaryHover: '#6d28d9',
  textPrimary:  '#ffffff',
  textSecondary:'#888888',
  textMuted:    '#555555',
  success:      '#10b981',
  danger:       '#ef4444',
};

export const LIGHT = {
  bg:           '#f4f4ff',
  card:         '#ffffff',
  border:       '#e0e0f0',
  borderHover:  '#c0c0e0',
  primary:      '#7c3aed',
  primaryHover: '#6d28d9',
  textPrimary:  '#0d0d1a',
  textSecondary:'#555555',
  textMuted:    '#888888',
  success:      '#10b981',
  danger:       '#ef4444',
};

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme(); // 'dark' | 'light' | null
  const [isDark, setIsDark] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('theme')
      .then((saved) => {
        if (saved !== null) {
          // User has a saved preference — honour it
          setIsDark(saved === 'dark');
        } else {
          // No saved preference — follow the system theme
          setIsDark(systemScheme !== 'light');
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [systemScheme]);

  const toggleTheme = async (value) => {
    // Accept either a boolean (Switch-style) or no-arg toggle
    const next = typeof value === 'boolean' ? value : !isDark;
    setIsDark(next);
    try {
      await AsyncStorage.setItem('theme', next ? 'dark' : 'light');
    } catch (_) {}
  };

  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, colors: isDark ? DARK : LIGHT }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
