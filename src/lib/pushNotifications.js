/**
 * src/lib/pushNotifications.js
 *
 * Registers the device for Expo push notifications and persists the token
 * to the HabitBoard backend. The backend uses this token when sending
 * push notifications for habit reminders and streak alerts.
 *
 * Call registerAndSavePushToken() once after login / on app launch.
 */
import * as Notifications from 'expo-notifications';
import api from './axios';

const EXPO_PROJECT_ID = '38630291-cf31-48aa-9431-1ad2adfe778e';

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
