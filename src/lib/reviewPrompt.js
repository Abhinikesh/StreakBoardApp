/**
 * src/lib/reviewPrompt.js
 *
 * Shows the native App Store / Play Store review dialog exactly once,
 * when the user has:
 *   - Used the app for 7+ days (tracked from first launch)
 *   - Has a current streak of 3+ days
 *
 * Uses expo-store-review. Never shows a custom modal — only the native dialog.
 * Condition is checked in DashboardScreen after each data load.
 */
import * as StoreReview from 'expo-store-review';
import AsyncStorage from '@react-native-async-storage/async-storage';

const INSTALL_DATE_KEY  = '@sb_install_date';
const REVIEW_DONE_KEY   = '@sb_review_done';

/** Call once on first app launch (idempotent — only sets the key if missing). */
export async function markInstallDate() {
  try {
    const existing = await AsyncStorage.getItem(INSTALL_DATE_KEY);
    if (!existing) {
      await AsyncStorage.setItem(INSTALL_DATE_KEY, new Date().toISOString());
    }
  } catch (_) {}
}

/**
 * Check conditions and show review prompt if eligible.
 * @param {number} currentStreak - user's current streak count
 */
export async function maybeRequestReview(currentStreak = 0) {
  try {
    // Already prompted — never ask again
    const done = await AsyncStorage.getItem(REVIEW_DONE_KEY);
    if (done) return;

    // Check streak condition
    if (currentStreak < 3) return;

    // Check 7-day condition
    const installDate = await AsyncStorage.getItem(INSTALL_DATE_KEY);
    if (!installDate) return;
    const daysSinceInstall =
      (Date.now() - new Date(installDate).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceInstall < 7) return;

    // Check OS-level availability
    const isAvailable = await StoreReview.isAvailableAsync();
    if (!isAvailable) return;

    // All conditions met — request review and mark done
    await StoreReview.requestReview();
    await AsyncStorage.setItem(REVIEW_DONE_KEY, 'true');
  } catch (_) {
    // Silently ignore — review prompt is non-critical
  }
}
