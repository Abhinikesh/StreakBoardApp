/**
 * src/lib/reengagement.js
 *
 * Re-engagement push notification system.
 *
 * Responsibilities:
 *  - Track the last date the user logged a habit (markUserActive)
 *  - On each app foreground event, check if 3+ days have passed
 *  - If so, and if notifications are enabled, schedule one re-engagement
 *    notification for today (at the user's reminder time or 20:00 default)
 *  - Ensure max ONE notification per calendar day (idempotent)
 *  - Cancel pending re-engagement notifications the moment the user logs a habit
 *
 * This module does NOT touch the daily-reminder notification channel or any
 * existing notification scheduling logic.
 */

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// ── Storage keys ──────────────────────────────────────────────────────────────
const LAST_ACTIVE_KEY    = 'reengagement_last_active';   // 'YYYY-MM-DD'
const SENT_TODAY_KEY     = 'reengagement_sent_date';     // 'YYYY-MM-DD'
const RE_CHANNEL_ID      = 'streakboard-reengagement';
const RE_NOTIF_TAG       = 'reengagement-daily';         // used to cancel previous

// ── Message pool (rotated randomly) ───────────────────────────────────────────
const MESSAGES = [
  { title: '🔥 Your streak is waiting!', body: "Don't let it die today — log one habit and keep going!" },
  { title: '💪 It\'s been a few days…',  body: 'Come back and rebuild your streak. You\'ve got this!' },
  { title: '🔑 Consistency is key',      body: 'Your habits miss you! Even one small log counts.' },
  { title: '🔥 Small steps, big results', body: 'Log in now and take one step toward your goal.' },
  { title: '⚡ Don\'t break the chain!', body: 'Your streak needs you today. Tap to log a habit.' },
];

function randomMessage() {
  return MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function daysBetween(dateStrA, dateStrB) {
  const a = new Date(dateStrA);
  const b = new Date(dateStrB);
  return Math.round((b - a) / 86_400_000);
}

// ── Ensure Android channel exists ─────────────────────────────────────────────
async function ensureReChannel() {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(RE_CHANNEL_ID, {
      name: 'Re-engagement Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });
  } catch (_) {}
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Call this after EVERY successful habit log.
 * Records today as the last active date and cancels any pending
 * re-engagement notification scheduled for today.
 */
export async function markUserActive() {
  try {
    const today = todayISO();
    await AsyncStorage.setItem(LAST_ACTIVE_KEY, today);

    // Cancel any queued re-engagement notifications
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if (n.identifier?.startsWith(RE_NOTIF_TAG)) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }

    // Mark sent-today so we don't re-schedule later in the same day
    await AsyncStorage.setItem(SENT_TODAY_KEY, today);
  } catch (_) {}
}

/**
 * Call this on every app foreground event (AppState 'active').
 * Schedules a re-engagement notification if:
 *   - User has notifications enabled (reminderEnabled = 'true')
 *   - 3+ days have passed since last_active_date
 *   - We haven't already sent one today
 */
export async function checkReEngagement() {
  try {
    // 1. Respect the user's notification preference
    const [
      [, reminderEnabled],
      [, lastActiveRaw],
      [, sentTodayRaw],
      [, reminderTimeRaw],
    ] = await AsyncStorage.multiGet([
      'reminderEnabled',
      LAST_ACTIVE_KEY,
      SENT_TODAY_KEY,
      'reminderTime',
    ]);

    // If notifications are explicitly disabled, bail
    if (reminderEnabled === 'false') return;

    // Verify OS permission is still granted
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    const today = todayISO();

    // Already sent one today — skip
    if (sentTodayRaw === today) return;

    // Determine days since last active
    // If no record yet, record today as active (fresh install / first use)
    if (!lastActiveRaw) {
      await AsyncStorage.setItem(LAST_ACTIVE_KEY, today);
      return;
    }

    const daysSinceActive = daysBetween(lastActiveRaw, today);
    if (daysSinceActive < 3) return;

    // 2. Parse the reminder time (HH:MM), fall back to 20:00
    let hour = 20, minute = 0;
    if (reminderTimeRaw) {
      const parts = reminderTimeRaw.split(':');
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (!isNaN(h) && !isNaN(m)) { hour = h; minute = m; }
    }

    // 3. Don't schedule in the past — if the scheduled time has already passed
    //    today, push to 8 PM or skip gracefully (the next foreground event tomorrow
    //    will catch it again)
    const now = new Date();
    const fireTime = new Date();
    fireTime.setHours(hour, minute, 0, 0);
    if (fireTime <= now) {
      // Time already passed today; we'll catch it tomorrow
      return;
    }

    // 4. Cancel any stale re-engagement notifications first
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if (n.identifier?.startsWith(RE_NOTIF_TAG)) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }

    // 5. Ensure Android channel
    await ensureReChannel();

    // 6. Schedule
    const { title, body } = randomMessage();
    const identifier = `${RE_NOTIF_TAG}-${today}`;

    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title,
        body,
        sound: true,
        ...(Platform.OS === 'android' && { channelId: RE_CHANNEL_ID }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireTime,
      },
    });

    // 7. Mark that we've scheduled one for today
    await AsyncStorage.setItem(SENT_TODAY_KEY, today);
  } catch (_) {
    // Never crash the app over a notification failure
  }
}
