/**
 * src/lib/xpLevels.js
 *
 * Shared XP level config — used by ProfileScreen, DashboardScreen,
 * XpDetailScreen, and LeaderboardScreen.
 * Keep in sync with backend/lib/xp.js LEVELS.
 */

export const LEVELS = [
  { level: 1,  name: 'Beginner',    minXp: 0 },
  { level: 2,  name: 'Apprentice',  minXp: 200 },
  { level: 3,  name: 'Consistent',  minXp: 500 },
  { level: 4,  name: 'Dedicated',   minXp: 1_000 },
  { level: 5,  name: 'Focused',     minXp: 2_000 },
  { level: 6,  name: 'Disciplined', minXp: 3_500 },
  { level: 7,  name: 'Committed',   minXp: 5_500 },
  { level: 8,  name: 'Expert',      minXp: 8_000 },
  { level: 9,  name: 'Elite',       minXp: 12_000 },
  { level: 10, name: 'Grandmaster', minXp: 18_000 },
];

/** Emoji badge per level */
export const LEVEL_ICONS = ['🌱','📘','✨','💪','🎯','⚡','🔥','🏅','💎','👑'];

/**
 * Returns full level info for a given total XP value.
 * @param {number} totalXp
 * @returns {{ current, next, xpIntoLevel, xpNeeded, progress }}
 */
export function getLevelInfo(totalXp = 0) {
  let current = LEVELS[0];
  let next    = LEVELS[1] || null;

  for (let i = 0; i < LEVELS.length; i++) {
    if (totalXp >= LEVELS[i].minXp) {
      current = LEVELS[i];
      next    = LEVELS[i + 1] || null;
    }
  }

  const xpIntoLevel = next ? totalXp - current.minXp : 0;
  const xpNeeded    = next ? next.minXp - current.minXp : 0;
  const progress    = xpNeeded > 0 ? xpIntoLevel / xpNeeded : 1;

  return { current, next, xpIntoLevel, xpNeeded, progress };
}

/**
 * Returns level icon emoji for a given level number (1-based).
 */
export function getLevelIcon(level = 1) {
  return LEVEL_ICONS[Math.max(0, Math.min(level - 1, LEVEL_ICONS.length - 1))];
}

/** XP earning rules — displayed in XpDetailScreen "How to earn" list */
export const XP_RULES = [
  { label: 'Log a habit (done)',        xp: '+10',  icon: '✅' },
  { label: 'Complete all habits today', xp: '+25',  icon: '🏆' },
  { label: '3-day streak',              xp: '+50',  icon: '🔥' },
  { label: '7-day streak',              xp: '+100', icon: '🔥' },
  { label: '14-day streak',             xp: '+200', icon: '🔥' },
  { label: '30-day streak (& +30/30)',  xp: '+500', icon: '🔥' },
  { label: 'First habit created',       xp: '+20',  icon: '🌱' },
  { label: '7-day login streak',        xp: '+75',  icon: '📅' },
];
