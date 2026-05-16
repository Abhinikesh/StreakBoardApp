/**
 * StreakSmallWidget.js  —  Android 2×2 home-screen widget
 * Rendered by react-native-android-widget inside the widget task handler.
 */
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

const THEME_COLOR = '#7C3AED';

export function StreakSmallWidget({
  streak = 0,
  done   = 0,
  total  = 0,
  habits = [],
}) {
  // Up to 5 dot indicators
  const dots = Array.from({ length: Math.min(total, 5) }, (_, i) => ({
    filled: i < done,
  }));

  return (
    <FlexWidget
      style={{
        flex:            1,
        flexDirection:   'column',
        backgroundColor: '#0d0d1a',
        borderRadius:    18,
        padding:         14,
        justifyContent:  'space-between',
      }}
      clickAction="OPEN_APP"
    >
      {/* App label */}
      <TextWidget
        text="🔥 HabitBoard"
        style={{ color: '#a78bfa', fontSize: 10, fontWeight: 'bold' }}
      />

      {/* Streak count */}
      <TextWidget
        text={`${streak}`}
        style={{ color: '#ffffff', fontSize: 38, fontWeight: 'bold', marginTop: 2 }}
      />

      {/* Done / total */}
      <TextWidget
        text={`${done}/${total} habits done`}
        style={{ color: '#9ca3af', fontSize: 11, marginTop: 2 }}
      />

      {/* Dot indicators */}
      <FlexWidget style={{ flexDirection: 'row', marginTop: 8, gap: 5 }}>
        {dots.map((d, i) => (
          <FlexWidget
            key={i}
            style={{
              width:           10,
              height:          10,
              borderRadius:    5,
              backgroundColor: d.filled ? THEME_COLOR : 'rgba(255,255,255,0.18)',
            }}
          />
        ))}
      </FlexWidget>
    </FlexWidget>
  );
}
