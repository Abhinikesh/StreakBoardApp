import React, { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import AppNavigator, { navigationRef } from './src/navigation/AppNavigator';
import { ThemeProvider } from './src/context/ThemeContext';
import { OfflineProvider } from './src/context/OfflineContext';
import { UserProfileProvider } from './src/context/UserProfileContext';
import { preloadSounds, unloadSounds } from './src/lib/sound';
import { checkReEngagement } from './src/lib/reengagement';
import { markInstallDate } from './src/lib/reviewPrompt';
import { registerAndSavePushToken } from './src/lib/pushNotifications';
import { getActiveConversation } from './src/lib/activeConversation';

// ── Foreground notification display behaviour ────────────────────────────────
// Must be called before any component mounts.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data || {};
    // Suppress DM notification if the user already has that conversation open
    if (
      data.type === 'message' &&
      data.senderId &&
      data.senderId === getActiveConversation()
    ) {
      return { shouldShowAlert: false, shouldPlaySound: false, shouldSetBadge: false };
    }
    return { shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true };
  },
});

// ── Navigate to the right screen when a push notification is tapped ─────────────
// Must be module-level so it's available to both the mount-time response
// (getLastNotificationResponseAsync) and the live listener.
function handleNotificationResponse(response) {
  const data = response?.notification?.request?.content?.data || {};

  if (data.type === 'message' && data.senderId) {
    // Navigate to the conversation. If the nav container isn't ready yet
    // (cold-start), wait until it is.
    const navigate = () =>
      navigationRef.navigate('Conversation', {
        friendId:   data.senderId,
        friendName: data.senderName || 'User',
      });

    if (navigationRef.isReady()) {
      navigate();
    } else {
      // Poll until ready (only needed on cold-start)
      const timer = setInterval(() => {
        if (navigationRef.isReady()) {
          clearInterval(timer);
          navigate();
        }
      }, 100);
    }
  }
}

export default function App() {
  const appStateRef = useRef(AppState.currentState);

  // ── Push token registration ───────────────────────────────────────────────
  // Registers device + saves Expo push token to backend so the server
  // can notify this device when a new DM or friend request arrives.
  useEffect(() => { registerAndSavePushToken(); }, []);

  // ── Notification tap → navigate to conversation ─────────────────────────
  // When user taps a DM push notification, navigate directly to that
  // ConversationScreen (works from both background and killed state).
  useEffect(() => {
    // Handle tap on a notification received while app was in background/killed
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      handleNotificationResponse(response);
    });

    // Handle tap on notifications received while app is running
    const sub = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse,
    );
    return () => sub.remove();
  }, []);

  // ── Foreground notification received listener (no-op — display handled above) ──────────
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(() => {});
    return () => sub.remove();
  }, []);

  // ── Sound preload ──────────────────────────────────────────────────────────
  useEffect(() => {
    preloadSounds();
    markInstallDate(); // idempotent — only sets once on first ever launch
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
