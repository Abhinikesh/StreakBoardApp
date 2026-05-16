import React, { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import AppNavigator from './src/navigation/AppNavigator';
import { ThemeProvider } from './src/context/ThemeContext';
import { OfflineProvider } from './src/context/OfflineContext';
import { UserProfileProvider } from './src/context/UserProfileContext';
import { preloadSounds, unloadSounds } from './src/lib/sound';
import { checkReEngagement } from './src/lib/reengagement';
import { registerAndSavePushToken } from './src/lib/pushNotifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function App() {
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => { registerAndSavePushToken(); }, []);

  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(() => {});
    return () => sub.remove();
  }, []);

  useEffect(() => {
    preloadSounds();
    return () => { unloadSounds(); };
  }, []);

  useEffect(() => {
    checkReEngagement();

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
        <UserProfileProvider>
          <SafeAreaProvider>
            <StatusBar style="light" />
            <AppNavigator />
          </SafeAreaProvider>
        </UserProfileProvider>
      </OfflineProvider>
    </ThemeProvider>
  );
}
