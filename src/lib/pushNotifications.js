/**
 * src/lib/pushNotifications.js
 *
 * Registers the device for Expo push notifications and persists the token
 * to the StreakBoard backend. The backend uses this token when sending
 * push notifications for new direct messages, friend requests, etc.
 *
 * Call registerAndSavePushToken() once after login / on app launch.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import api from './axios';

const EXPO_PROJECT_ID = '38630291-cf31-48aa-9431-1ad2adfe778e';

// ── Android channel for direct messages ────────────────────────────────────
async function ensureDMChannel() {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync('direct-messages', {
      name: 'Direct Messages',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#7c3aed',
      showBadge: true,
    });
  } catch (_) {}
}

/**
 * Requests push permission, retrieves the Expo push token, and saves it
 * to the backend (PATCH /api/user/push-token).
 *
 * Safe to call on every app launch — the token only changes rarely,
 * and the backend PATCH is idempotent.
 *
 * @returns {Promise<string|null>} The Expo push token, or null if unavailable.
 */
export async function registerAndSavePushToken() {
  try {
    await ensureDMChannel();

    // Request / confirm permission
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      if (__DEV__) console.log('[pushNotifications] permission denied');
      return null;
    }

    // Retrieve Expo push token (scoped to this project)
    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId: EXPO_PROJECT_ID,
    });
    if (!token) return null;

    // Persist to backend — fire-and-forget, never block startup
    // Backend reads req.body.token (PATCH /api/user/push-token)
    api.patch('/api/user/push-token', { token }).catch(() => {});

    if (__DEV__) console.log('[pushNotifications] token registered:', token);
    return token;
  } catch (e) {
    if (__DEV__) console.warn('[pushNotifications] register error:', e.message);
    return null;
  }
}
