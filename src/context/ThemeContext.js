/**
 * src/context/ThemeContext.js
 *
 * Light/dark/system toggle with 8 selectable accent palettes.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

const THEME_KEY  = 'themeMode';
const ACCENT_KEY = 'accentKey';

export const ACCENTS = {
  purple: {
    name:        'Deep Purple',
    swatch:      '#7C3AED',
    lightPrimary:'#7C3AED', lightHover: '#6D28D9',
    darkPrimary: '#A78BFA', darkHover:  '#7C3AED',
  },
  ocean: {
    name:        'Ocean Blue',
    swatch:      '#1D4ED8',
    lightPrimary:'#1D4ED8', lightHover: '#1E40AF',
    darkPrimary: '#60A5FA', darkHover:  '#3B82F6',
  },
  forest: {
    name:        'Forest Green',
    swatch:      '#15803D',
    lightPrimary:'#15803D', lightHover: '#166534',
    darkPrimary: '#4ADE80', darkHover:  '#22C55E',
  },
  sunset: {
    name:        'Sunset Orange',
    swatch:      '#EA580C',
    lightPrimary:'#EA580C', lightHover: '#C2410C',
    darkPrimary: '#FB923C', darkHover:  '#F97316',
  },
  rose: {
    name:        'Rose Pink',
    swatch:      '#E11D48',
    lightPrimary:'#E11D48', lightHover: '#BE123C',
    darkPrimary: '#FB7185', darkHover:  '#F43F5E',
  },
  slate: {
    name:        'Slate Dark',
    swatch:      '#334155',
    lightPrimary:'#334155', lightHover: '#1E293B',
    darkPrimary: '#94A3B8', darkHover:  '#64748B',
  },
  amber: {
    name:        'Amber Gold',
    swatch:      '#D97706',
    lightPrimary:'#D97706', lightHover: '#B45309',
    darkPrimary: '#FCD34D', darkHover:  '#F59E0B',
  },
  teal: {
    name:        'Cool Teal',
    swatch:      '#0F766E',
    lightPrimary:'#0F766E', lightHover: '#115E59',
    darkPrimary: '#2DD4BF', darkHover:  '#14B8A6',
  },
};

const BASE_DARK = {
  bg:           '#000000',
  card:         '#0a0a0a',
  border:       '#1a1a1a',
  borderHover:  '#2a2a2a',
  textPrimary:  '#ffffff',
  textSecondary:'#D1D5DB',
  textMuted:    '#9CA3AF',
  textDisabled: '#4B5563',
  success:      '#10b981',
  danger:       '#ef4444',
};

const BASE_LIGHT = {
  bg:           '#f4f4ff',
  card:         '#ffffff',
  border:       '#e0e0f0',
  borderHover:  '#c0c0e0',
  textPrimary:  '#0d0d1a',
  textSecondary:'#555555',
  textMuted:    '#888888',
  success:      '#10b981',
  danger:       '#ef4444',
};

export const DARK  = { ...BASE_DARK,  primary: '#7c3aed', primaryHover: '#6d28d9' };
export const LIGHT = { ...BASE_LIGHT, primary: '#7c3aed', primaryHover: '#6d28d9' };

function buildColors(isDark, accent) {
  const a = ACCENTS[accent] || ACCENTS.purple;
  const base = isDark ? BASE_DARK : BASE_LIGHT;
  return {
    ...base,
    primary:      isDark ? a.darkPrimary : a.lightPrimary,
    primaryHover: isDark ? a.darkHover   : a.lightHover,
  };
}

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [themeMode,  setThemeModeState] = useState('system');
  const [accentKey,  setAccentKeyState] = useState('purple');
  const [loaded,     setLoaded]         = useState(false);

  useEffect(() => {
    AsyncStorage.multiGet([THEME_KEY, ACCENT_KEY]).then(([[, mode], [, accent]]) => {
      if (mode === 'light' || mode === 'dark' || mode === 'system') {
        setThemeModeState(mode);
      } else {
        setThemeModeState('system');
      }
      if (accent && ACCENTS[accent]) setAccentKeyState(accent);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const isDark =
    themeMode === 'dark'  ? true  :
    themeMode === 'light' ? false :
    systemScheme === 'dark';

  const setThemeMode = useCallback(async (mode) => {
    setThemeModeState(mode);
    try { await AsyncStorage.setItem(THEME_KEY, mode); } catch (_) {}
  }, []);

  const setAccentKey = useCallback(async (key) => {
    if (!ACCENTS[key]) return;
    setAccentKeyState(key);
    try { await AsyncStorage.setItem(ACCENT_KEY, key); } catch (_) {}
  }, []);

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
        toggleTheme,
        accentKey,
        setAccentKey,
        colors: buildColors(isDark, accentKey),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
