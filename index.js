import { registerRootComponent } from 'expo';
import App from './App';

// ── Android home-screen widget ──────────────────────────────────────────────
// react-native-android-widget runs widgetTaskHandler on a headless JS thread
// when Android needs to refresh a widget. The try/catch keeps Expo Go working.
try {
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  const widgetTaskHandler = require('./widgets/WidgetTaskHandler').default;
  registerWidgetTaskHandler(widgetTaskHandler);
} catch (_) {
  // Library not linked in current environment (e.g., Expo Go) — ignore.
}

registerRootComponent(App);
