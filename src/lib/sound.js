import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

async function isSoundEnabled() {
  try {
    const val = await AsyncStorage.getItem('soundEnabled');
    return val !== 'false'; // default on
  } catch (_) { return true; }
}

export async function playDoneSound() {
  if (!(await isSoundEnabled())) return;
  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    const { sound } = await Audio.Sound.createAsync(
      { uri: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' },
      { shouldPlay: true, volume: 0.6 },
    );
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.didJustFinish) sound.unloadAsync();
    });
  } catch (e) {
    console.log('playDoneSound error:', e?.message);
  }
}

export async function playMissedSound() {
  if (!(await isSoundEnabled())) return;
  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    const { sound } = await Audio.Sound.createAsync(
      { uri: 'https://assets.mixkit.co/active_storage/sfx/2955/2955-preview.mp3' },
      { shouldPlay: true, volume: 0.5 },
    );
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.didJustFinish) sound.unloadAsync();
    });
  } catch (e) {
    console.log('playMissedSound error:', e?.message);
  }
}
