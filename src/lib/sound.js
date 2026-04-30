import { Audio } from 'expo-av';

let tickSound = null;
let crossSound = null;

/**
 * Preload both sounds once at app startup.
 * Call this from App.js useEffect.
 */
export async function preloadSounds() {
  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false });

    // TICK — short bright pop (✓ Done)
    const tickResult = await Audio.Sound.createAsync(
      { uri: 'https://assets.mixkit.co/sfx/preview/mixkit-fast-small-sweep-transition-166.mp3' },
      { volume: 0.5, shouldPlay: false },
    );
    tickSound = tickResult.sound;

    // CROSS — soft low click (✗ Missed)
    const crossResult = await Audio.Sound.createAsync(
      { uri: 'https://assets.mixkit.co/sfx/preview/mixkit-clicking-on-a-small-button-2359.mp3' },
      { volume: 0.4, shouldPlay: false },
    );
    crossSound = crossResult.sound;
  } catch (e) {
    console.log('Sound preload failed:', e);
  }
}

/**
 * Play the ✓ Done tick sound.
 * @param {boolean} enabled  Pass your soundEnabled state value.
 */
export async function playTickSound(enabled = true) {
  if (!enabled) return;
  try {
    if (tickSound) {
      await tickSound.setPositionAsync(0);
      await tickSound.setVolumeAsync(0.5);
      await tickSound.playAsync();
    }
  } catch (_) {
    // never block UI for sound failures
  }
}

/**
 * Play the ✗ Missed cross sound.
 * @param {boolean} enabled  Pass your soundEnabled state value.
 */
export async function playCrossSound(enabled = true) {
  if (!enabled) return;
  try {
    if (crossSound) {
      await crossSound.setPositionAsync(0);
      await crossSound.setVolumeAsync(0.4);
      await crossSound.playAsync();
    }
  } catch (_) {}
}

/**
 * Unload sounds to free memory (call on app unmount if needed).
 */
export async function unloadSounds() {
  try {
    if (tickSound) { await tickSound.unloadAsync(); tickSound = null; }
    if (crossSound) { await crossSound.unloadAsync(); crossSound = null; }
  } catch (_) {}
}

// ─── Legacy aliases kept so any other screen importing the old names doesn't break ───
export const playDoneSound   = () => playTickSound(true);
export const playMissedSound = () => playCrossSound(true);
