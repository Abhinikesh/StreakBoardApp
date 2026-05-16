import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

const ANDROID_STEPS = [
  {
    step: '1',
    title: 'Long-press your home screen',
    body: 'Tap and hold an empty area on your Android home screen until the edit mode appears.',
    emoji: '👆',
  },
  {
    step: '2',
    title: 'Tap "Widgets"',
    body: 'Find and tap the "Widgets" button at the bottom of the screen.',
    emoji: '📦',
  },
  {
    step: '3',
    title: 'Search for "HabitBoard"',
    body: 'Scroll through the widget list or search for "HabitBoard". You\'ll find a Small (2×2) and Medium (4×2) size.',
    emoji: '🔍',
  },
  {
    step: '4',
    title: 'Drag and drop',
    body: 'Long-press the widget preview and drag it to your desired home screen position. Release to place it.',
    emoji: '🎯',
  },
];

const IOS_STEPS = [
  {
    step: '1',
    title: 'Long-press your home screen',
    body: 'Tap and hold any empty area on your iPhone home screen until icons start jiggling.',
    emoji: '👆',
  },
  {
    step: '2',
    title: 'Tap the "+" button',
    body: 'Tap the "+" button in the top-left corner to open the widget gallery.',
    emoji: '➕',
  },
  {
    step: '3',
    title: 'Search for "HabitBoard"',
    body: 'Type "HabitBoard" in the search bar at the top of the widget gallery.',
    emoji: '🔍',
  },
  {
    step: '4',
    title: 'Choose a size and tap "Add Widget"',
    body: 'Swipe to pick Small or Medium size, then tap "Add Widget". Drag it into position and tap Done.',
    emoji: '✅',
  },
];

export default function WidgetInstructionsScreen({ navigation }) {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const steps = Platform.OS === 'ios' ? IOS_STEPS : ANDROID_STEPS;
  const platform = Platform.OS === 'ios' ? 'iPhone' : 'Android';

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={[s.back, { color: colors.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.textPrimary }]}>Add Widget</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={s.hero}>
          <Text style={s.heroEmoji}>📱</Text>
          <Text style={[s.heroTitle, { color: colors.textPrimary }]}>
            HabitBoard on your {platform} home screen
          </Text>
          <Text style={[s.heroBody, { color: colors.textMuted }]}>
            Follow these {steps.length} steps to add the widget and see your streak without opening the app.
          </Text>
        </View>

        {/* Widget preview card */}
        <View style={[s.previewCard, { backgroundColor: '#0d0d1a' }]}>
          <Text style={s.previewLabel}>🔥 HabitBoard</Text>
          <Text style={s.previewStreak}>— 🔥</Text>
          <Text style={s.previewSub}>— / — habits done</Text>
          <View style={s.previewDots}>
            {[0, 1, 2, 3, 4].map(i => (
              <View key={i} style={[s.dot, i < 3 && { backgroundColor: '#7C3AED' }]} />
            ))}
          </View>
          <Text style={s.previewCaption}>Small widget preview</Text>
        </View>

        {/* Steps */}
        {steps.map((step) => (
          <View key={step.step} style={[s.stepCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[s.stepBadge, { backgroundColor: colors.primary + '20' }]}>
              <Text style={[s.stepNum, { color: colors.primary }]}>{step.step}</Text>
            </View>
            <View style={s.stepBody}>
              <Text style={s.stepEmoji}>{step.emoji}</Text>
              <Text style={[s.stepTitle, { color: colors.textPrimary }]}>{step.title}</Text>
              <Text style={[s.stepText, { color: colors.textMuted }]}>{step.body}</Text>
            </View>
          </View>
        ))}

        {/* Note */}
        <View style={[s.note, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
          <Text style={[s.noteTxt, { color: colors.textMuted }]}>
            💡 The widget refreshes automatically every 30 minutes. It also updates instantly when you log a habit inside the app.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  back: { fontSize: 15, fontWeight: '600' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },

  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 48 },

  hero: { alignItems: 'center', marginBottom: 24 },
  heroEmoji: { fontSize: 48, marginBottom: 12 },
  heroTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  heroBody: { fontSize: 14, lineHeight: 20, textAlign: 'center' },

  // Mini widget preview
  previewCard: { borderRadius: 16, padding: 16, marginBottom: 28, alignSelf: 'center', width: 150 },
  previewLabel: { color: '#a78bfa', fontSize: 9, fontWeight: '700' },
  previewStreak: { color: '#fff', fontSize: 34, fontWeight: '800', marginTop: 4 },
  previewSub: { color: '#9ca3af', fontSize: 10, marginTop: 2 },
  previewDots: { flexDirection: 'row', gap: 4, marginTop: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.18)' },
  previewCaption: { color: 'rgba(255,255,255,0.35)', fontSize: 8, marginTop: 10, textAlign: 'center' },

  stepCard: { flexDirection: 'row', borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 12, gap: 14, alignItems: 'flex-start' },
  stepBadge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepNum: { fontSize: 15, fontWeight: '800' },
  stepBody: { flex: 1 },
  stepEmoji: { fontSize: 20, marginBottom: 4 },
  stepTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  stepText: { fontSize: 13, lineHeight: 18 },

  note: { borderRadius: 12, borderWidth: 1, padding: 14 },
  noteTxt: { fontSize: 13, lineHeight: 18 },
});
