import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';

const DISMISSED_KEY = '@sb_widget_tip_dismissed';

export default function WidgetTipCard({ onHowToAdd }) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AsyncStorage.getItem(DISMISSED_KEY).then((v) => {
      if (!v) {
        setVisible(true);
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      }
    });
  }, []);

  const dismiss = () => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
      setVisible(false);
      AsyncStorage.setItem(DISMISSED_KEY, 'true');
    });
  };

  if (!visible) return null;

  return (
    <Animated.View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.primary + '40', opacity: fadeAnim }]}>
      {/* Dismiss */}
      <TouchableOpacity style={styles.closeBtn} onPress={dismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={[styles.closeTxt, { color: colors.textMuted }]}>✕</Text>
      </TouchableOpacity>

      <Text style={styles.emoji}>📱</Text>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Add the HabitBoard Widget</Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>
        See your streak and today's progress right on your home screen — no need to open the app.
      </Text>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.howBtn, { backgroundColor: colors.primary }]}
          onPress={onHowToAdd}
          activeOpacity={0.85}
        >
          <Text style={styles.howBtnTxt}>How to add →</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={dismiss} activeOpacity={0.7}>
          <Text style={[styles.skipTxt, { color: colors.textMuted }]}>Not now</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    position: 'relative',
  },
  closeBtn:  { position: 'absolute', top: 12, right: 12 },
  closeTxt:  { fontSize: 14, fontWeight: '600' },
  emoji:     { fontSize: 28, marginBottom: 8 },
  title:     { fontSize: 15, fontWeight: '700', marginBottom: 6 },
  body:      { fontSize: 13, lineHeight: 19, marginBottom: 14 },
  actions:   { flexDirection: 'row', alignItems: 'center', gap: 16 },
  howBtn:    { borderRadius: 20, paddingVertical: 8, paddingHorizontal: 20 },
  howBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
  skipTxt:   { fontSize: 13 },
});
