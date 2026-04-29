import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermission() {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleHabitReminder(timeStr) {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    const [hourStr, minStr] = (timeStr || '20:00').split(':');
    const hour   = parseInt(hourStr, 10);
    const minute = parseInt(minStr,  10);
    if (isNaN(hour) || isNaN(minute)) return false;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔥 StreakBoard',
        body:  "Don't forget to log your habits today!",
        sound: true,
      },
      trigger: { hour, minute, repeats: true },
    });
    await AsyncStorage.setItem('reminderTime',    timeStr);
    await AsyncStorage.setItem('reminderEnabled', 'true');
    return true;
  } catch (e) {
    console.error('scheduleHabitReminder error:', e);
    return false;
  }
}

export async function cancelHabitReminder() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await AsyncStorage.setItem('reminderEnabled', 'false');
    return true;
  } catch (_) { return false; }
}

export async function getReminderSettings() {
  try {
    const enabled = await AsyncStorage.getItem('reminderEnabled');
    const time    = await AsyncStorage.getItem('reminderTime');
    return { enabled: enabled === 'true', time: time || '20:00' };
  } catch (_) {
    return { enabled: false, time: '20:00' };
  }
}
