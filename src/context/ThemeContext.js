/**
 * src/context/ThemeContext.js
 *
 * Extends the existing light/dark/system toggle with 6 selectable accent palettes.
 * All screens already consume `colors.primary` from this context — so changing the
 * accent automatically propagates to every screen with zero per-screen changes.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

const THEME_KEY  = 'themeMode';   // 'light' | 'dark' | 'system'
const ACCENT_KEY = 'accentKey';   // see ACCENTS below

// ── 6 accent palettes ─────────────────────────────────────────────────────────
// lightPrimary = shown on light bg   darkPrimary = shown on dark bg (lighter)
export const ACCENTS = {
  purple: {
    name:        'Default Purple',
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
    name:        'Sunset Red',
    swatch:      '#B91C1C',
    lightPrimary:'#B91C1C', lightHover: '#991B1B',
    darkPrimary: '#F87171', darkHover:  '#EF4444',
  },
  midnight: {
    name:        'Midnight',
    swatch:      '#1E1B4B',
    lightPrimary:'#4338CA', lightHover: '#3730A3',
    darkPrimary: '#818CF8', darkHover:  '#6366F1',
  },
  slate: {
    name:        'Slate Grey',
    swatch:      '#334155',
    lightPrimary:'#334155', lightHover: '#1E293B',
    darkPrimary: '#94A3B8', darkHover:  '#64748B',
  },
};

// ── Base palettes (structural — primary is overridden per accent) ──────────────
const BASE_DARK = {
  bg:           '#0d0d1a',
  card:         '#111120',
  border:       '#1e1e2e',
  borderHover:  '#2a2a3a',
  textPrimary:  '#ffffff',    // contrast ~19:1 on bg ✅
  textSecondary:'#D1D5DB',    // was #888888 (~4.2:1) → now ~12:1 ✅
  textMuted:    '#9CA3AF',    // was #555555 (~2.4:1, invisible) → now ~7:1 ✅
  textDisabled: '#4B5563',    // intentionally low — truly disabled state
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

// Keep DARK/LIGHT exports for any code that imports them directly
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

// ── Provider ──────────────────────────────────────────────────────────────────
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

  // Backward-compat
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
