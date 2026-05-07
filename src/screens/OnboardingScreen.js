/**
 * src/screens/OnboardingScreen.js
 *
 * 3-step onboarding for first-time users (0 habits, first launch).
 * Skip button on every step. "Get Started" on final step navigates to Main.
 * Sets @sb_onboarding_complete in AsyncStorage so it never shows again.
 */
import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Dimensions, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';

const { width: W } = Dimensions.get('window');
export const ONBOARDING_KEY = '@sb_onboarding_complete';

// ── Step illustrations (pure View compositions) ────────────────────────────────
function TrackIllustration({ primary }) {
  return (
    <View style={il.container}>
      {/* Calendar-like grid */}
      <View style={[il.card, { borderColor: primary + '40' }]}>
        <View style={il.calRow}>
          {['M','T','W','T','F','S','S'].map((d, i) => (
            <View key={i} style={il.dayWrap}>
              <Text style={[il.dayLabel, { color: primary + '80' }]}>{d}</Text>
              <View style={[il.dayCirle, { backgroundColor: i < 5 ? primary : primary + '25', borderColor: primary + '50' }]} />
            </View>
          ))}
        </View>
        <View style={[il.progressBar, { backgroundColor: primary + '20' }]}>
          <View style={[il.progressFill, { width: '70%', backgroundColor: primary }]} />
        </View>
      </View>
    </View>
  );
}

function StreakIllustration({ primary }) {
  const bars = [0.4, 0.6, 0.5, 0.8, 0.7, 1.0, 0.9];
  return (
    <View style={il.container}>
      <View style={il.barChart}>
        {bars.map((h, i) => (
          <View key={i} style={il.barWrap}>
            <View style={[il.bar, { height: h * 80, backgroundColor: i === 5 ? primary : primary + '55', borderRadius: 4 }]} />
          </View>
        ))}
      </View>
      <Text style={[il.streakNum, { color: primary }]}>7 🔥</Text>
    </View>
  );
}

function ConsistencyIllustration({ primary }) {
  return (
    <View style={il.container}>
      {/* Shield + XP + leaderboard medal */}
      <View style={il.consistRow}>
        <View style={[il.badge, { borderColor: primary + '60', backgroundColor: primary + '12' }]}>
          <Text style={il.badgeEmoji}>🛡️</Text>
          <Text style={[il.badgeLabel, { color: primary }]}>Shield</Text>
        </View>
        <View style={[il.badge, { borderColor: primary + '60', backgroundColor: primary + '12' }]}>
          <Text style={il.badgeEmoji}>⚡</Text>
          <Text style={[il.badgeLabel, { color: primary }]}>XP</Text>
        </View>
        <View style={[il.badge, { borderColor: primary + '60', backgroundColor: primary + '12' }]}>
          <Text style={il.badgeEmoji}>🏆</Text>
          <Text style={[il.badgeLabel, { color: primary }]}>Rank</Text>
        </View>
      </View>
    </View>
  );
}

// ── Steps data ─────────────────────────────────────────────────────────────────
const STEPS = [
  {
    Illustration: TrackIllustration,
    heading:      'Track what you do',
    body:         'Log each habit daily. One tap marks it done.',
  },
  {
    Illustration: StreakIllustration,
    heading:      'Build your streak',
    body:         'Log every day to keep your streak alive.',
  },
  {
    Illustration: ConsistencyIllustration,
    heading:      'Stay consistent',
    body:         'Earn XP, shields, and climb the leaderboard.',
  },
];

// ── Main screen ────────────────────────────────────────────────────────────────
export default function OnboardingScreen({ navigation }) {
  const { colors } = useTheme();
  const [step, setStep] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const complete = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    navigation.replace('Main');
  };

  const next = () => {
    if (step < STEPS.length - 1) {
      Animated.timing(slideAnim, { toValue: -(step + 1) * W, duration: 300, useNativeDriver: true }).start(() =>
        setStep(step + 1)
      );
      Animated.timing(slideAnim, { toValue: -(step + 1) * W, duration: 300, useNativeDriver: true }).start();
      setStep(step + 1);
    } else {
      complete();
    }
  };

  const { Illustration, heading, body } = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      {/* Skip */}
      <TouchableOpacity style={s.skipBtn} onPress={complete} activeOpacity={0.7}>
        <Text style={[s.skipTxt, { color: colors.textMuted }]}>Skip</Text>
      </TouchableOpacity>

      {/* Illustration area */}
      <View style={s.ilArea}>
        <Illustration primary={colors.primary} />
      </View>

      {/* Text */}
      <View style={s.textArea}>
        <Text style={[s.heading, { color: colors.textPrimary }]}>{heading}</Text>
        <Text style={[s.body, { color: colors.textMuted }]}>{body}</Text>
      </View>

      {/* Dots */}
      <View style={s.dots}>
        {STEPS.map((_, i) => (
          <View
            key={i}
            style={[
              s.dot,
              { backgroundColor: i === step ? colors.primary : colors.border },
              i === step && { width: 24 },
            ]}
          />
        ))}
      </View>

      {/* CTA */}
      <View style={s.footer}>
        <TouchableOpacity
          style={[s.cta, { backgroundColor: colors.primary }]}
          onPress={next}
          activeOpacity={0.85}
        >
          <Text style={s.ctaTxt}>{isLast ? 'Get Started' : 'Next'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1 },
  skipBtn: { position: 'absolute', top: 56, right: 24, zIndex: 10 },
  skipTxt: { fontSize: 14, fontWeight: '500' },

  ilArea:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
  textArea:{ paddingHorizontal: 32, marginTop: 16, alignItems: 'center' },
  heading: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5, textAlign: 'center', marginBottom: 12 },
  body:    { fontSize: 15, lineHeight: 22, textAlign: 'center' },

  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 32 },
  dot:  { width: 8, height: 8, borderRadius: 4 },

  footer:  { paddingHorizontal: 24, paddingBottom: 32, marginTop: 32 },
  cta:     { borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  ctaTxt:  { color: '#fff', fontSize: 16, fontWeight: '700' },
});

const il = StyleSheet.create({
  container:    { alignItems: 'center', justifyContent: 'center', width: 280, height: 200 },

  // Track illustration
  card:         { width: '100%', borderWidth: 1, borderRadius: 16, padding: 16 },
  calRow:       { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  dayWrap:      { alignItems: 'center', gap: 4 },
  dayLabel:     { fontSize: 9, fontWeight: '600' },
  dayCirle:     { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5 },
  progressBar:  { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },

  // Streak illustration
  barChart:     { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 90 },
  barWrap:      { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar:          { width: '100%' },
  streakNum:    { fontSize: 28, fontWeight: '800', marginTop: 8 },

  // Consistency illustration
  consistRow:   { flexDirection: 'row', gap: 16 },
  badge:        { alignItems: 'center', borderWidth: 1.5, borderRadius: 12, padding: 12, width: 72 },
  badgeEmoji:   { fontSize: 24 },
  badgeLabel:   { fontSize: 11, fontWeight: '700', marginTop: 4 },
});
