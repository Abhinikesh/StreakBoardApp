/**
 * src/lib/notifications.js
 *
 * Wraps expo-notifications scheduling for the daily habit reminder.
 *
 * KEY FIX: expo-notifications ≥ 0.29 requires an explicit `type` field on the
 * trigger object (SchedulableTriggerInputTypes enum).  The old code passed
 * `{ hour, minute, repeats: true }` without `type`, so every internal parser
 * returned `undefined` and the library threw — causing the "Could not schedule
 * reminder" error in ProfileScreen.  We now use DAILY trigger type which fires
 * every day at the given hour:minute.
 *
 * Android channel: required on Android 8+ (API 26+).  We create / update it
 * once inside scheduleHabitReminder so the notification actually appears.
 */

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const CHANNEL_ID           = 'streakboard-daily-reminder';
const GLOBAL_NOTIF_ID      = 'global-habit-reminder';
const REMINDER_TIME_KEY    = 'reminderTime';
const REMINDER_ENABLED_KEY = 'reminderEnabled';

// ── Global notification handler ────────────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ── Ensure the Android notification channel exists ─────────────────────────────
async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Daily Habit Reminder',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#7c3aed',
    });
  } catch (e) {
    // Non-fatal — the notification will still fire on most devices without it,
    // but sound/importance may differ.
    if (__DEV__) console.warn('ensureAndroidChannel:', e);
  }
}

// ── Permission helper ──────────────────────────────────────────────────────────
export async function requestNotificationPermission() {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch (e) {
    if (__DEV__) console.warn('requestNotificationPermission:', e);
    return false;
  }
}

// ── Schedule a daily repeating reminder ───────────────────────────────────────
/**
 * @param {string} timeStr  "HH:MM" in 24-hour format, e.g. "20:00"
 * @returns {Promise<boolean>} true on success
 */
export async function scheduleHabitReminder(timeStr) {
  try {
    const [hourStr, minStr] = (timeStr || '20:00').split(':');
    const hour   = parseInt(hourStr, 10);
    const minute = parseInt(minStr,  10);

    if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      if (__DEV__) console.warn('scheduleHabitReminder: invalid time', timeStr);
      return false;
    }

    // Cancel only the global reminder (not per-habit ones)
    await Notifications.cancelScheduledNotificationAsync(GLOBAL_NOTIF_ID).catch(() => {});

    // Ensure the Android channel is ready
    await ensureAndroidChannel();

    // ── THE CORE FIX ─────────────────────────────────────────────────────────
    // expo-notifications ≥ 0.29 requires an explicit `type` property on the
    // trigger.  Without it every internal parser (parseCalendarTrigger,
    // parseDailyTrigger, …) returns undefined and the library throws.
    // SchedulableTriggerInputTypes.DAILY = "daily" — fires every day at hour:minute.
    await Notifications.scheduleNotificationAsync({
      identifier: GLOBAL_NOTIF_ID,
      content: {
        title: '🔥 StreakBoard',
        body:  "Don't forget to log your habits today!",
        sound: true,
        ...(Platform.OS === 'android' && { channelId: CHANNEL_ID }),
      },
      trigger: {
        type:   Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        ...(Platform.OS === 'android' && { channelId: CHANNEL_ID }),
      },
    });

    // Persist so ProfileScreen can restore state after restart
    await AsyncStorage.multiSet([
      [REMINDER_TIME_KEY,    timeStr],
      [REMINDER_ENABLED_KEY, 'true'],
    ]);

    return true;
  } catch (e) {
    if (__DEV__) console.error('scheduleHabitReminder error:', e);
    return false;
  }
}

// ── Cancel the daily reminder ──────────────────────────────────────────────────
export async function cancelHabitReminder() {
  try {
    await Notifications.cancelScheduledNotificationAsync(GLOBAL_NOTIF_ID).catch(() => {});
    await AsyncStorage.setItem(REMINDER_ENABLED_KEY, 'false');
    return true;
  } catch (e) {
    if (__DEV__) console.warn('cancelHabitReminder:', e);
    return false;
  }
}

// ── Read persisted reminder settings ──────────────────────────────────────────
export async function getReminderSettings() {
  try {
    const [[, enabled], [, time]] = await AsyncStorage.multiGet([
      REMINDER_ENABLED_KEY,
      REMINDER_TIME_KEY,
    ]);
    return { enabled: enabled === 'true', time: time || '20:00' };
  } catch (_) {
    return { enabled: false, time: '20:00' };
  }
}
