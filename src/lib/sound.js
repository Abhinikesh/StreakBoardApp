/**
 * src/lib/sound.js
 *
 * Habit-log sound effects using expo-av.
 *
 * Sounds are bundled local WAV files (assets/sounds/) generated with
 * multi-harmonic synthesis + exponential decay so they sound like chimes,
 * not beeps. They load instantly at startup, work offline, and never fail
 * due to network issues.
 *
 * ── API ──────────────────────────────────────────────────────────────────────
 *  preloadSounds()            — call once in App.js useEffect
 *  unloadSounds()             — call in the same useEffect cleanup
 *  playTickSound(enabled)     — habit marked DONE      (C5 → E5 chime)
 *  playCrossSound(enabled)    — habit unchecked/missed (E4 → C4 soft drop)
 *  playStreakMilestoneSound(enabled) — streak incremented (C5→E5→G5→C6 fanfare)
 */

import { Audio } from 'expo-av';

// ── Bundled local sound assets ─────────────────────────────────────────────────
const TICK_ASSET    = require('../../assets/sounds/tick.mp3');
const CROSS_ASSET   = require('../../assets/sounds/cross.mp3');
const STREAK_ASSET  = require('../../assets/sounds/streak_increase.mp3');

// Module-level sound object cache
let tickSound    = null;
let crossSound   = null;
let streakSound  = null;
let preloaded    = false;

// ── Audio mode ────────────────────────────────────────────────────────────────
// playsInSilentModeIOS: false → respects the iOS hardware silent/mute switch.
// staysActiveInBackground: false → releases audio session when app is backgrounded.
const AUDIO_MODE = {
  playsInSilentModeIOS:    false,
  staysActiveInBackground: false,
  shouldDuckAndroid:       true,   // lower other audio (music) briefly while playing
};

// ── Volume levels ─────────────────────────────────────────────────────────────
const TICK_VOL    = 0.80;   // bright but not jarring
const CROSS_VOL   = 0.65;   // softer — dismissive, not alarming
const STREAK_VOL  = 0.85;   // celebratory — a touch louder

// ── Preload ───────────────────────────────────────────────────────────────────
/**
 * Load all three sounds into memory so playback is zero-latency.
 * Safe to call multiple times — idempotent.
 */
export async function preloadSounds() {
  if (preloaded) return;
  try {
    await Audio.setAudioModeAsync(AUDIO_MODE);

    const [t, c, s] = await Promise.all([
      Audio.Sound.createAsync(TICK_ASSET,   { volume: TICK_VOL,   shouldPlay: false }),
      Audio.Sound.createAsync(CROSS_ASSET,  { volume: CROSS_VOL,  shouldPlay: false }),
      Audio.Sound.createAsync(STREAK_ASSET, { volume: STREAK_VOL, shouldPlay: false }),
    ]);

    tickSound   = t.sound;
    crossSound  = c.sound;
    streakSound = s.sound;
    preloaded   = true;
  } catch (e) {
    // Non-fatal — app works without sounds
    if (__DEV__) console.warn('[sound] preload failed:', e?.message ?? e);
  }
}

// ── Unload ────────────────────────────────────────────────────────────────────
/**
 * Free memory. Call in the App.js useEffect cleanup that called preloadSounds.
 */
export async function unloadSounds() {
  preloaded = false;
  try {
    await Promise.all([
      tickSound?.unloadAsync(),
      crossSound?.unloadAsync(),
      streakSound?.unloadAsync(),
    ]);
  } catch (_) {}
  tickSound = crossSound = streakSound = null;
}

// ── Internal helper ───────────────────────────────────────────────────────────
async function _play(soundObj, volume) {
  if (!soundObj) return;
  await soundObj.setPositionAsync(0);
  await soundObj.setVolumeAsync(volume);
  await soundObj.playAsync();
}

// ── Public play functions ─────────────────────────────────────────────────────

/**
 * Play the ✓ Done tick chime (C5 → E5).
 * @param {boolean} enabled  Value of the "Sound Effects" setting.
 */
export async function playTickSound(enabled = true) {
  if (!enabled) return;
  try { await _play(tickSound, TICK_VOL); } catch (_) {}
}

/**
 * Play the ✗ Uncheck/missed soft drop (E4 → C4).
 * @param {boolean} enabled  Value of the "Sound Effects" setting.
 */
export async function playCrossSound(enabled = true) {
  if (!enabled) return;
  try { await _play(crossSound, CROSS_VOL); } catch (_) {}
}

/**
 * Play the 🔥 Streak milestone fanfare (C5 → E5 → G5 → C6).
 * Call when the user's streak for a habit has just incremented.
 * @param {boolean} enabled  Value of the "Sound Effects" setting.
 */
export async function playStreakMilestoneSound(enabled = true) {
  if (!enabled) return;
  try { await _play(streakSound, STREAK_VOL); } catch (_) {}
}

// ── Legacy aliases ─────────────────────────────────────────────────────────────
// Keep old names so any import that still uses them doesn't break.
export const playDoneSound   = (enabled) => playTickSound(enabled);
export const playMissedSound = (enabled) => playCrossSound(enabled);
