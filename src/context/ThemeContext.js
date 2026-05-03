import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

const THEME_KEY = 'themeMode'; // 'light' | 'dark' | 'system'

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

  // themeMode: 'light' | 'dark' | 'system'
  const [themeMode, setThemeModeState] = useState('system');
  const [loaded, setLoaded] = useState(false);

  // Load the saved preference once on mount
  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY)
      .then((saved) => {
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          setThemeModeState(saved);
        } else if (saved === null) {
          // Legacy apps had no entry — treat as system default
          setThemeModeState('system');
        } else {
          // Migrate old boolean-style 'dark'/'light' values (same strings, so fine)
          setThemeModeState('system');
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  // Derived isDark value: resolved against the live system scheme when mode = 'system'
  const isDark =
    themeMode === 'dark'  ? true  :
    themeMode === 'light' ? false :
    systemScheme === 'dark'; // 'system' — follow the OS

  /** Persist + apply a new theme mode */
  const setThemeMode = useCallback(async (mode) => {
    // mode must be 'light' | 'dark' | 'system'
    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem(THEME_KEY, mode);
    } catch (_) {}
  }, []);

  /**
   * Backward-compat: ProfileScreen used to call toggleTheme(booleanValue).
   * Keep this working so any code that still calls it doesn't break.
   */
  const toggleTheme = useCallback(async (value) => {
    const next = typeof value === 'boolean' ? value : !isDark;
    await setThemeMode(next ? 'dark' : 'light');
  }, [isDark, setThemeMode]);

  if (!loaded) return null;

  return (
    <ThemeContext.Provider
      value={{
        isDark,
        themeMode,
        setThemeMode,
        toggleTheme,           // kept for backward compat
        colors: isDark ? DARK : LIGHT,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
