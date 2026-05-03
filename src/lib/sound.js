/**
 * src/lib/sound.js
 *
 * Habit-log sound effects using expo-av.
 *
 * WHY LOCAL ASSETS: The previous implementation fetched sounds from remote
 * URLs (mixkit.co). Any network delay or cold-start failure left tickSound /
 * crossSound as null, so playAsync was never called — sounds were silently
 * skipped.  Local WAV assets bundled with the app (assets/sounds/) load
 * instantly at startup, work fully offline, and never fail due to network.
 *
 * Call preloadSounds() once in App.js useEffect (already wired up).
 * Call unloadSounds() in the cleanup return of that same useEffect.
 */

import { Audio } from 'expo-av';

// ── Bundled local sound assets ─────────────────────────────────────────────────
// Generated short WAV tones: tick = 880 Hz bright pop, cross = 300 Hz low click
const TICK_ASSET  = require('../../assets/sounds/tick.wav');
const CROSS_ASSET = require('../../assets/sounds/cross.wav');

let tickSound  = null;
let crossSound = null;
let preloaded  = false;

// ── Preload both sounds once at app startup ────────────────────────────────────
/**
 * Call from App.js useEffect — loads both sounds into memory so playback
 * is instant when the user taps a habit button.
 */
export async function preloadSounds() {
  if (preloaded) return; // idempotent — safe to call multiple times
  try {
    // Allow playback even when the iOS silent switch is on
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS:    true,
      staysActiveInBackground: false,
    });

    // TICK — bright high-pitched pop (✓ Done)
    const { sound: tick } = await Audio.Sound.createAsync(
      TICK_ASSET,
      { volume: 0.6, shouldPlay: false },
    );
    tickSound = tick;

    // CROSS — low muted click (✗ Missed / unchecked)
    const { sound: cross } = await Audio.Sound.createAsync(
      CROSS_ASSET,
      { volume: 0.4, shouldPlay: false },
    );
    crossSound = cross;

    preloaded = true;
  } catch (e) {
    // Non-fatal — app works perfectly without sounds
    if (__DEV__) console.warn('Sound preload failed:', e);
  }
}

// ── Play the ✓ Done tick sound ─────────────────────────────────────────────────
/**
 * @param {boolean} enabled  Pass the soundEnabled preference value.
 */
export async function playTickSound(enabled = true) {
  if (!enabled || !tickSound) return;
  try {
    await tickSound.setPositionAsync(0);
    await tickSound.setVolumeAsync(0.6);
    await tickSound.playAsync();
  } catch (_) {
    // Never block the UI for a sound failure
  }
}

// ── Play the ✗ Missed / uncheck cross sound ───────────────────────────────────
/**
 * @param {boolean} enabled  Pass the soundEnabled preference value.
 */
export async function playCrossSound(enabled = true) {
  if (!enabled || !crossSound) return;
  try {
    await crossSound.setPositionAsync(0);
    await crossSound.setVolumeAsync(0.4);
    await crossSound.playAsync();
  } catch (_) {}
}

// ── Unload sounds to free memory ──────────────────────────────────────────────
/**
 * Call in the cleanup return of the App.js useEffect that called preloadSounds.
 */
export async function unloadSounds() {
  preloaded = false;
  try {
    if (tickSound)  { await tickSound.unloadAsync();  tickSound  = null; }
    if (crossSound) { await crossSound.unloadAsync(); crossSound = null; }
  } catch (_) {}
}

// ── Legacy aliases ─────────────────────────────────────────────────────────────
// Kept so any import using the old names doesn't break.
export const playDoneSound   = () => playTickSound(true);
export const playMissedSound = () => playCrossSound(true);
