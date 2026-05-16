import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_ACTIVE      = 'comeback_active';
const KEY_STARTED     = 'comeback_started';
const KEY_BEST        = 'comeback_best';
const KEY_LAST_LOG    = 'comeback_last_log';
const KEY_PREV_STREAK = 'comeback_prev_streak';
const KEY_CACHED_BEST = 'comeback_cached_best';

const MESSAGES = [
  () => ({ title: 'Welcome back! 🔥', body: 'Day 1 of your comeback streak!' }),
  () => ({ title: "Every champion falls. 💪", body: 'Champions also get back up. Streak restarted!' }),
  (best) => ({ title: "You're back! 🎉", body: `Your best was ${best} day${best !== 1 ? 's' : ''} — let's beat it!` }),
];

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86_400_000);
}

export async function updateBestStreak(n) {
  try {
    const num = Number(n) || 0;
    if (num > 0) await AsyncStorage.setItem(KEY_CACHED_BEST, String(num));
  } catch (_) {}
}

export async function recordPreviousStreak(n) {
  try {
    const num = Number(n) || 0;
    await AsyncStorage.setItem(KEY_PREV_STREAK, String(num));
  } catch (_) {}
}

export async function triggerComebackIfEligible() {
  try {
    const [[, activeRaw], [, bestRaw], [, prevStreakRaw]] = await AsyncStorage.multiGet([
      KEY_ACTIVE, KEY_CACHED_BEST, KEY_PREV_STREAK,
    ]);
    const best       = Number(bestRaw) || 0;
    const prevStreak = Number(prevStreakRaw) || 0;

    if (best === 0) return null;

    if (prevStreak > 0) return null;

    if (activeRaw === 'true') {
      await _advanceComebackDay();
      return null;
    }

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

export async function markComebackLoggedToday() {
  try {
    const active = await AsyncStorage.getItem(KEY_ACTIVE);
    if (active !== 'true') return;
    await _advanceComebackDay();
  } catch (_) {}
}

async function _advanceComebackDay() {
  try {
    const [[, startedRaw]] = await AsyncStorage.multiGet([KEY_STARTED]);
    const today = todayISO();
    await AsyncStorage.setItem(KEY_LAST_LOG, today);

    if (!startedRaw) return;
    const daysIn = daysBetween(startedRaw, today) + 1;
    if (daysIn > 3) {
      await AsyncStorage.setItem(KEY_ACTIVE, 'false');
    }
  } catch (_) {}
}

export async function getComebackStatus() {
  try {
    const [[, activeRaw], [, startedRaw], [, bestRaw], [, lastLogRaw]] =
      await AsyncStorage.multiGet([KEY_ACTIVE, KEY_STARTED, KEY_BEST, KEY_LAST_LOG]);

    const active  = activeRaw === 'true';
    const best    = Number(bestRaw) || 0;
    const started = startedRaw || todayISO();
    const daysIn  = daysBetween(started, todayISO()) + 1;

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

export async function clearComeback() {
  try {
    await AsyncStorage.multiSet([
      [KEY_ACTIVE,   'false'],
      [KEY_STARTED,  ''],
      [KEY_LAST_LOG, ''],
    ]);
  } catch (_) {}
}
