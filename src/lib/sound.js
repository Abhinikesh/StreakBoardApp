import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Reads the Sound Effects toggle from ProfileScreen's AsyncStorage key
async function isSoundEnabled() {
  try {
    const val = await AsyncStorage.getItem('soundEnabled');
    return val !== 'false'; // default: on
  } catch (_) {
    return true;
  }
}

/**
 * Gentle high bubble-pop for ✓ DONE
 * Volume 0.28, rate 1.6 → short bright pop
 */
export async function playDoneSound() {
  if (!(await isSoundEnabled())) return;
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });
    const { sound } = await Audio.Sound.createAsync(
      {
        uri: 'https://assets.mixkit.co/sfx/preview/mixkit-bubble-pop-up-alert-notification-2357.mp3',
      },
      {
        shouldPlay: true,
        volume: 0.28,
        rate: 1.6,
        shouldCorrectPitch: false,
      },
    );
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.didJustFinish) sound.unloadAsync();
    });
  } catch (_) {}
}

/**
 * Soft low click for ✗ MISSED
 * Volume 0.22, rate 0.85 → muted dull thud
 */
export async function playMissedSound() {
  if (!(await isSoundEnabled())) return;
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });
    const { sound } = await Audio.Sound.createAsync(
      {
        uri: 'https://assets.mixkit.co/sfx/preview/mixkit-click-error-on-software-interface-2569.mp3',
      },
      {
        shouldPlay: true,
        volume: 0.22,
        rate: 0.85,
        shouldCorrectPitch: false,
      },
    );
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.didJustFinish) sound.unloadAsync();
    });
  } catch (_) {}
}
