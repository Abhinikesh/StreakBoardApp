/**
 * StreakMediumWidget.js  —  Android 4×2 home-screen widget
 * Rendered by react-native-android-widget inside the widget task handler.
 */
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

const THEME_COLOR = '#7C3AED';

export function StreakMediumWidget({
  streak = 0,
  done   = 0,
  total  = 0,
  habits = [],
}) {
  const topHabits = habits.slice(0, 4);
  const dots      = Array.from({ length: Math.min(total, 5) }, (_, i) => ({
    filled: i < done,
  }));

  return (
    <FlexWidget
      style={{
        flex:            1,
        flexDirection:   'row',
        backgroundColor: '#0d0d1a',
        borderRadius:    18,
        padding:         14,
        gap:             14,
      }}
      clickAction="OPEN_APP"
    >
      {/* ── Left column: streak + dots ── */}
      <FlexWidget
        style={{
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '40%',
        }}
      >
        <TextWidget
          text="🔥 HabitBoard"
          style={{ color: '#a78bfa', fontSize: 9, fontWeight: 'bold' }}
        />
        <TextWidget
          text={`${streak}`}
          style={{ color: '#ffffff', fontSize: 42, fontWeight: 'bold' }}
        />
        <TextWidget
          text={`${done}/${total} done`}
          style={{ color: '#9ca3af', fontSize: 11 }}
        />
        <FlexWidget style={{ flexDirection: 'row', gap: 4, marginTop: 6 }}>
          {dots.map((d, i) => (
            <FlexWidget
              key={i}
              style={{
                width:           9,
                height:          9,
                borderRadius:    5,
                backgroundColor: d.filled ? THEME_COLOR : 'rgba(255,255,255,0.18)',
              }}
            />
          ))}
        </FlexWidget>
      </FlexWidget>

      {/* ── Divider ── */}
      <FlexWidget
        style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 1 }}
      />

      {/* ── Right column: habit list ── */}
      <FlexWidget
        style={{
          flex:          1,
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        {topHabits.map((h, i) => (
          <FlexWidget
            key={i}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}
          >
            <TextWidget
              text={h.done ? '✅' : '○'}
              style={{ fontSize: 12, color: h.done ? THEME_COLOR : 'rgba(255,255,255,0.35)' }}
            />
            <TextWidget
              text={`${h.icon} ${h.name}`}
              style={{
                color:    h.done ? '#ffffff' : 'rgba(255,255,255,0.55)',
                fontSize: 11,
              }}
            />
          </FlexWidget>
        ))}

        {/* Tap label */}
        <TextWidget
          text="Tap to open app →"
          style={{ color: 'rgba(167,139,250,0.6)', fontSize: 9, marginTop: 4 }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}
