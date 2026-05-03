/**
 * src/lib/offlineStore.js
 *
 * AsyncStorage-backed local cache for habits, logs, and the pending sync queue.
 * All functions are safe to call when AsyncStorage is unavailable — they catch
 * and return sensible defaults so the app never crashes.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  HABITS:       'offline_habits',
  HABIT_LOGS:   'offline_habitLogs',   // { [habitId]: { allLogs, todayLog } }
  PROFILE:      'offline_profile',
  PENDING:      'offline_pendingQueue', // [{ id, habitId, habitName, date, status, op }]
  LAST_SYNC:    'offline_lastSync',
};

// ── Habits ────────────────────────────────────────────────────────────────────
export async function getCachedHabits() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.HABITS);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export async function saveHabitsToCache(habits) {
  try { await AsyncStorage.setItem(KEYS.HABITS, JSON.stringify(habits)); } catch {}
}

// ── Logs ──────────────────────────────────────────────────────────────────────
export async function getCachedLogs() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.HABIT_LOGS);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export async function saveLogsToCache(logsMap) {
  try { await AsyncStorage.setItem(KEYS.HABIT_LOGS, JSON.stringify(logsMap)); } catch {}
}

// ── Profile ───────────────────────────────────────────────────────────────────
export async function getCachedProfile() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.PROFILE);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export async function saveProfileToCache(profile) {
  try { await AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(profile)); } catch {}
}

// ── Pending sync queue ─────────────────────────────────────────────────────────
export async function getPendingQueue() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.PENDING);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
export async function addToPendingQueue(item) {
  try {
    const queue = await getPendingQueue();
    // Deduplicate: same habitId + date + op → overwrite
    const filtered = queue.filter(
      (q) => !(q.habitId === item.habitId && q.date === item.date && q.op === item.op)
    );
    filtered.push({ ...item, queuedAt: new Date().toISOString() });
    await AsyncStorage.setItem(KEYS.PENDING, JSON.stringify(filtered));
  } catch {}
}
export async function clearPendingQueue() {
  try { await AsyncStorage.removeItem(KEYS.PENDING); } catch {}
}
export async function removePendingItem(id) {
  try {
    const queue = await getPendingQueue();
    const filtered = queue.filter((q) => q.id !== id);
    await AsyncStorage.setItem(KEYS.PENDING, JSON.stringify(filtered));
  } catch {}
}

// ── Sync timestamp ────────────────────────────────────────────────────────────
export async function getLastSync() {
  try { return await AsyncStorage.getItem(KEYS.LAST_SYNC); } catch { return null; }
}
export async function setLastSync() {
  try { await AsyncStorage.setItem(KEYS.LAST_SYNC, new Date().toISOString()); } catch {}
}

// ── Local optimistic log update ───────────────────────────────────────────────
// Applies a log action to the cached logsMap without hitting the server.
// Used when offline so the UI reflects the change immediately.
export async function applyLocalLog(habitId, date, status, op) {
  try {
    const logsMap = (await getCachedLogs()) || {};
    const entry   = logsMap[habitId] || { allLogs: [], todayLog: null };
    const allLogs = [...(entry.allLogs || [])];

    if (op === 'delete') {
      const updated = allLogs.filter((l) => l.date !== date);
      logsMap[habitId] = { allLogs: updated, todayLog: null };
    } else {
      const existing = allLogs.findIndex((l) => l.date === date);
      const newLog   = { _id: `local_${habitId}_${date}`, habitId, date, status, local: true };
      if (existing >= 0) allLogs[existing] = newLog;
      else allLogs.push(newLog);
      logsMap[habitId] = { allLogs, todayLog: newLog };
    }
    await saveLogsToCache(logsMap);
    return logsMap;
  } catch { return null; }
}
