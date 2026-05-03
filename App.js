import React, { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import AppNavigator from './src/navigation/AppNavigator';
import { ThemeProvider } from './src/context/ThemeContext';
import { OfflineProvider } from './src/context/OfflineContext';
import { preloadSounds, unloadSounds } from './src/lib/sound';
import { checkReEngagement } from './src/lib/reengagement';

export default function App() {
  const appStateRef = useRef(AppState.currentState);

  // ── Notification received listener ──────────────────────────────────────────
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(() => {});
    return () => sub.remove();
  }, []);

  // ── Sound preload ──────────────────────────────────────────────────────────
  useEffect(() => {
    preloadSounds();
    return () => { unloadSounds(); };
  }, []);

  // ── Re-engagement: check on mount + every foreground resume ───────────────
  useEffect(() => {
    // Check immediately on cold start
    checkReEngagement();

    // Check again each time the app comes back to foreground
    const sub = AppState.addEventListener('change', (nextState) => {
      if (appStateRef.current !== 'active' && nextState === 'active') {
        checkReEngagement();
      }
      appStateRef.current = nextState;
    });

    return () => sub.remove();
  }, []);

  return (
    <ThemeProvider>
      <OfflineProvider>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <AppNavigator />
        </SafeAreaProvider>
      </OfflineProvider>
    </ThemeProvider>
  );
}
