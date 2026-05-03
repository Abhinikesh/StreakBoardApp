/**
 * src/lib/habitReminders.js
 *
 * Per-habit daily notification scheduling.
 * Each habit gets its own unique notification identifier and Android channel.
 * Falls back to global reminder time for habits with no custom time set.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GLOBAL_REMINDER_KEY  = 'reminderTime';
const HABIT_NOTIF_PREFIX   = 'habit_reminder_';
const CHANNEL_PREFIX       = 'habit-reminder-';

// ── Channel per habit (Android) ────────────────────────────────────────────
async function ensureHabitChannel(habitId, habitName) {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(`${CHANNEL_PREFIX}${habitId}`, {
      name: `Reminder: ${habitName}`,
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#7c3aed',
    });
  } catch (_) {}
}

// ── Request permissions (safe to call repeatedly) ──────────────────────────
export async function ensureNotificationPermission() {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') return true;
    const { status: asked } = await Notifications.requestPermissionsAsync();
    return asked === 'granted';
  } catch { return false; }
}

// ── Schedule a daily notification for one habit ────────────────────────────
export async function scheduleHabitReminderNotif(habit) {
  if (!habit.reminderEnabled || !habit.reminderTime) return;

  const [hourStr, minStr] = habit.reminderTime.split(':');
  const hour   = parseInt(hourStr, 10);
  const minute = parseInt(minStr,  10);
  if (isNaN(hour) || isNaN(minute)) return;

  const identifier = `${HABIT_NOTIF_PREFIX}${habit._id}`;
  const channelId  = `${CHANNEL_PREFIX}${habit._id}`;

  try {
    // Cancel old notification for this habit
    await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});

    await ensureHabitChannel(habit._id, habit.name);

    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: '⏰ Time for your habit',
        body:  `Don't forget to log: ${habit.name}`,
        sound: true,
        data:  { habitId: habit._id, screen: 'Main' },
        ...(Platform.OS === 'android' && { channelId }),
      },
      trigger: {
        type:   Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        ...(Platform.OS === 'android' && { channelId }),
      },
    });
  } catch (e) {
    if (__DEV__) console.warn('[habitReminders] schedule error', habit.name, e.message);
  }
}

// ── Cancel notification for one habit ─────────────────────────────────────
export async function cancelHabitReminderNotif(habitId) {
  try {
    await Notifications.cancelScheduledNotificationAsync(`${HABIT_NOTIF_PREFIX}${habitId}`);
  } catch (_) {}
}

// ── Reschedule all habits on app open ─────────────────────────────────────
// Reads global fallback from AsyncStorage; schedules each habit that has
// reminderEnabled=true (using its custom time or global if none set).
export async function rescheduleAllHabitReminders(habits) {
  if (!habits?.length) return;
  await ensureNotificationPermission();

  const globalTime = (await AsyncStorage.getItem(GLOBAL_REMINDER_KEY)) || '20:00';

  for (const h of habits) {
    if (!h.isActive) { await cancelHabitReminderNotif(h._id); continue; }

    const useGlobal = !h.reminderTime; // no custom time → check global toggle
    if (h.reminderEnabled) {
      await scheduleHabitReminderNotif({
        ...h,
        reminderTime: h.reminderTime || globalTime,
      });
    } else {
      await cancelHabitReminderNotif(h._id);
    }
  }
}
