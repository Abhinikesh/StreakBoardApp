/**
 * widgetData.js
 * Writes today's habit snapshot to AsyncStorage so the Android home-screen
 * widget task handler can read it when it updates.
 *
 * Call writeWidgetData() after:
 *   1. fetchAll() completes in DashboardScreen
 *   2. A habit is marked done/missed
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const WIDGET_DATA_KEY = '@sb_widget_data';

// ─── Streak helper (identical logic to Dashboard computeStreak) ──────────────
function computeStreakFromLogs(logs) {
  if (!logs || !logs.length) return 0;
  const toStr = (d) => d.toISOString().split('T')[0];
  const today = new Date();
  const todayStr = toStr(today);
  const yest = new Date(today);
  yest.setDate(yest.getDate() - 1);
  const yesterdayStr = toStr(yest);

  const loggedDates = new Set(logs.map((l) => l.date));
  if (!loggedDates.has(todayStr) && !loggedDates.has(yesterdayStr)) return 0;

  const startStr = loggedDates.has(todayStr) ? todayStr : yesterdayStr;
  let streak = 0;
  const cur = new Date(startStr);
  while (loggedDates.has(toStr(cur))) {
    streak++;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}

/**
 * @param {Array}  habits    - active habit objects from API
 * @param {Object} habitLogs - { [habitId]: { allLogs: [], todayLog: {} | null } }
 */
export async function writeWidgetData({ habits = [], habitLogs = {} }) {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Up to 5 habits displayed in the widget
    const widgetHabits = habits.slice(0, 5).map((h) => {
      const entry   = habitLogs[h._id] || {};
      const isDone  = entry.todayLog?.status === 'done';
      return { id: h._id, name: h.name, icon: h.icon || '📌', done: isDone };
    });

    const done  = widgetHabits.filter((h) => h.done).length;
    const total = widgetHabits.length;

    // Max streak across all habits
    let streak = 0;
    for (const hId of Object.keys(habitLogs)) {
      const allLogs = habitLogs[hId]?.allLogs || [];
      const s = computeStreakFromLogs(allLogs);
      if (s > streak) streak = s;
    }

    const data = { streak, done, total, habits: widgetHabits, date: today };
    await AsyncStorage.setItem(WIDGET_DATA_KEY, JSON.stringify(data));

    // On Android, request a widget refresh so it picks up the new data immediately
    if (Platform.OS === 'android') {
      try {
        const { requestWidgetUpdate } = require('react-native-android-widget');
        const React = require('react');
        const { StreakSmallWidget }  = require('../../widgets/StreakSmallWidget');
        const { StreakMediumWidget } = require('../../widgets/StreakMediumWidget');

        await requestWidgetUpdate({
          widgetName: 'StreakSmall',
          renderWidget: () => React.createElement(StreakSmallWidget, data),
          widgetNotFound: () => {},
        });
        await requestWidgetUpdate({
          widgetName: 'StreakMedium',
          renderWidget: () => React.createElement(StreakMediumWidget, data),
          widgetNotFound: () => {},
        });
      } catch (_) {
        // Library not yet linked — silently skip during Expo Go sessions
      }
    }
  } catch (err) {
    // Never throw — widget data is non-critical
  }
}

/**
 * Reads the last-written widget snapshot (for the instructions preview).
 */
export async function readWidgetData() {
  try {
    const raw = await AsyncStorage.getItem(WIDGET_DATA_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
