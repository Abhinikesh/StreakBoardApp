/**
 * src/lib/comeback.js
 *
 * Comeback streak feature — purely client-side, zero server changes.
 *
 * Flow:
 *  1. ProfileScreen calls updateBestStreak(n) whenever it loads user stats.
 *  2. DashboardScreen calls triggerComebackIfEligible() after the user's
 *     FIRST successful 'done' habit log on a day where all streaks were 0.
 *  3. DashboardScreen calls markComebackLoggedToday() every time a 'done'
 *     log is made while a comeback is active — used to check continuity.
 *  4. getComebackStatus() returns the current badge/state for ProfileScreen
 *     and LeaderboardScreen to read.
 *
 * Storage keys:
 *  - comeback_active          : 'true' | 'false'
 *  - comeback_started         : 'YYYY-MM-DD'
 *  - comeback_best            : stringified number (best streak at time of break)
 *  - comeback_last_log        : 'YYYY-MM-DD' (last day user logged during comeback)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_ACTIVE   = 'comeback_active';
const KEY_STARTED  = 'comeback_started';
const KEY_BEST     = 'comeback_best';
const KEY_LAST_LOG = 'comeback_last_log';
// Cached best streak so triggerComebackIfEligible can read it without a separate API call
const KEY_CACHED_BEST = 'comeback_cached_best';

const MESSAGES = [
  (best) => ({ title: 'Welcome back! 🔥', body: 'Day 1 of your comeback streak!' }),
  (best) => ({ title: "Every champion falls. 💪", body: 'Champions also get back up. Streak restarted!' }),
  (best) => ({ title: "You're back! 🎉", body: `Your best was ${best} day${best !== 1 ? 's' : ''} — let's beat it!` }),
];

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86_400_000);
}

// ── Called from ProfileScreen whenever stats load ─────────────────────────────
export async function updateBestStreak(n) {
  try {
    const num = Number(n) || 0;
    if (num > 0) await AsyncStorage.setItem(KEY_CACHED_BEST, String(num));
  } catch (_) {}
}

// ── Called from DashboardScreen after first 'done' log on an all-zero-streak day ─
/**
 * @returns {{ title, body, best }} on a new comeback, or null if already active / not eligible.
 */
export async function triggerComebackIfEligible() {
  try {
    const [[, activeRaw], [, bestRaw]] = await AsyncStorage.multiGet([KEY_ACTIVE, KEY_CACHED_BEST]);
    const best = Number(bestRaw) || 0;

    // No comeback if best streak was 0 (truly brand new user with no history)
    if (best === 0) return null;

    // Already in an active comeback — don't show the banner again, but update last log
    if (activeRaw === 'true') {
      await _advanceComebackDay();
      return null;
    }

    // Start a new comeback
    const today = todayISO();
    await AsyncStorage.multiSet([
      [KEY_ACTIVE,   'true'],
      [KEY_STARTED,  today],
      [KEY_BEST,     String(best)],
      [KEY_LAST_LOG, today],
    ]);

    const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)](best);
    return { ...msg, best };
  } catch (_) { return null; }
}

// ── Called every time a 'done' log succeeds while comeback is active ──────────
export async function markComebackLoggedToday() {
  try {
    const active = await AsyncStorage.getItem(KEY_ACTIVE);
    if (active !== 'true') return;
    await _advanceComebackDay();
  } catch (_) {}
}

// Internal: update last_log + auto-expire after 3 days
async function _advanceComebackDay() {
  try {
    const [[, startedRaw], [, lastLogRaw]] = await AsyncStorage.multiGet([KEY_STARTED, KEY_LAST_LOG]);
    const today = todayISO();
    await AsyncStorage.setItem(KEY_LAST_LOG, today);

    if (!startedRaw) return;
    const daysIn = daysBetween(startedRaw, today) + 1; // day 1 = started date
    if (daysIn > 3) {
      // Badge expires after 3 consecutive days
      await AsyncStorage.multiSet([
        [KEY_ACTIVE, 'false'],
      ]);
    }
  } catch (_) {}
}

// ── getComebackStatus: read by ProfileScreen and LeaderboardScreen ─────────────
/**
 * @returns {{ active: boolean, daysIn: number, best: number }}
 */
export async function getComebackStatus() {
  try {
    const [[, activeRaw], [, startedRaw], [, bestRaw], [, lastLogRaw]] =
      await AsyncStorage.multiGet([KEY_ACTIVE, KEY_STARTED, KEY_BEST, KEY_LAST_LOG]);

    const active  = activeRaw === 'true';
    const best    = Number(bestRaw) || 0;
    const started = startedRaw || todayISO();
    const daysIn  = daysBetween(started, todayISO()) + 1;

    // Auto-expire: if the user missed a day during comeback (lastLog < yesterday),
    // quietly clear the badge so it doesn't persist forever
    if (active && lastLogRaw) {
      const daysSinceLog = daysBetween(lastLogRaw, todayISO());
      if (daysSinceLog > 1) {
        await AsyncStorage.setItem(KEY_ACTIVE, 'false');
        return { active: false, daysIn: 0, best };
      }
    }

    return { active, daysIn: active ? Math.min(daysIn, 3) : 0, best };
  } catch (_) {
    return { active: false, daysIn: 0, best: 0 };
  }
}

// ── clearComeback: call if user explicitly wants to reset ─────────────────────
export async function clearComeback() {
  try {
    await AsyncStorage.multiSet([
      [KEY_ACTIVE,   'false'],
      [KEY_STARTED,  ''],
      [KEY_LAST_LOG, ''],
    ]);
  } catch (_) {}
}
