/**
 * src/lib/syncManager.js
 *
 * Flushes the offline pending queue to the server.
 * Called automatically by OfflineContext when connectivity restores.
 */
import api from './axios';
import {
  getPendingQueue, removePendingItem, clearPendingQueue,
  saveHabitsToCache, saveLogsToCache, saveProfileToCache, setLastSync,
} from './offlineStore';

const todayStr = () => new Date().toISOString().split('T')[0];

/**
 * Sync all pending queue items to the server.
 * Returns number of items successfully synced.
 */
export async function syncPendingQueue() {
  const queue = await getPendingQueue();
  if (!queue.length) return 0;

  let synced = 0;
  for (const item of queue) {
    try {
      if (item.op === 'log') {
        // POST /api/logs — server upserts (findOneAndUpdate with upsert)
        await api.post('/api/logs', {
          habitId: item.habitId,
          date:    item.date,
          status:  item.status,
        });
        await removePendingItem(item.id);
        synced++;
      } else if (item.op === 'delete') {
        // Best-effort delete — if log doesn't exist server returns 404, we still clear
        if (item.logId && !item.logId.startsWith('local_')) {
          await api.delete(`/api/logs/${item.logId}`).catch(() => {});
        }
        await removePendingItem(item.id);
        synced++;
      }
    } catch (err) {
      // Leave in queue on network error; skip on 4xx (data issue)
      if (err.response && err.response.status < 500) {
        await removePendingItem(item.id);
      }
    }
  }
  return synced;
}

/**
 * Pull the latest habits + logs from the server and update the local cache.
 * Silent — never throws.
 */
export async function refreshCacheFromServer() {
  try {
    const [habitsRes, profileRes] = await Promise.all([
      api.get('/api/habits'),
      api.get('/api/user/profile'),
    ]);

    const activeHabits = (habitsRes.data || []).filter((h) => h.isActive);
    await saveHabitsToCache(activeHabits);
    await saveProfileToCache(profileRes.data || {});

    // Fetch logs for each habit
    const today = todayStr();
    const logResults = await Promise.all(
      activeHabits.map((h) =>
        api.get(`/api/logs/${h._id}`).then((r) => ({
          habitId: h._id,
          logs:    r.data || [],
        })).catch(() => ({ habitId: h._id, logs: [] }))
      )
    );

    const logsMap = {};
    for (const { habitId, logs } of logResults) {
      const todayLog = logs.find((l) => l.date === today) || null;
      logsMap[habitId] = { allLogs: logs, todayLog };
    }
    await saveLogsToCache(logsMap);
    await setLastSync();
  } catch {}
}
