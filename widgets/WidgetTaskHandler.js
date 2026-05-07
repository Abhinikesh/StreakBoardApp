/**
 * WidgetTaskHandler.js
 * Registered in index.js via registerWidgetTaskHandler().
 * Runs on the headless JS thread when Android needs to refresh a widget.
 */
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { StreakSmallWidget }  from './StreakSmallWidget';
import { StreakMediumWidget } from './StreakMediumWidget';

const WIDGET_DATA_KEY = '@sb_widget_data';

async function getWidgetData() {
  try {
    const raw = await AsyncStorage.getItem(WIDGET_DATA_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return { streak: 0, done: 0, total: 0, habits: [] };
}

export default async function widgetTaskHandler(props) {
  const { widgetAction, widgetName } = props;

  switch (widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      const data = await getWidgetData();

      if (widgetName === 'StreakSmall') {
        props.renderWidget(<StreakSmallWidget  {...data} />);
      } else {
        props.renderWidget(<StreakMediumWidget {...data} />);
      }
      break;
    }

    case 'WIDGET_CLICK':
      // The native layer already launches the app when the user taps.
      // No action needed here, but the case must exist to avoid warnings.
      break;

    default:
      break;
  }
}
