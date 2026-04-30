import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import AppNavigator from './src/navigation/AppNavigator';
import { ThemeProvider } from './src/context/ThemeContext';
import { preloadSounds, unloadSounds } from './src/lib/sound';

export default function App() {
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      console.log('Notification received:', notification);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    preloadSounds();
    return () => { unloadSounds(); };
  }, []);

  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <AppNavigator />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
