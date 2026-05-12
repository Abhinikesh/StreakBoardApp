import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Animated as RNAnimated, ActivityIndicator, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedProps, withTiming, Easing,
} from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import api from '../lib/axios';
import { getLevelInfo, getLevelIcon, LEVELS, XP_RULES } from '../lib/xpLevels';

// ── SVG constants ─────────────────────────────────────────────────────────────
const SVG_SIZE       = 200;
const RING_RADIUS    = 85;
const STROKE_WIDTH   = 14;
const CIRCUMFERENCE  = 2 * Math.PI * RING_RADIUS;  // ≈ 534.07
const TRACK_COLOR    = 'rgba(255,255,255,0.08)';

// AnimatedCircle: ties react-native-svg's Circle to Reanimated's shared values
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ── Circular progress ring (SVG — mathematically exact) ──────────────────────
function CircularRing({ progress = 0, color = '#FF6B6B' }) {
  // strokeDashoffset drives the visible arc:
  //   offset = CIRCUMFERENCE       → 0 % filled  (invisible arc)
  //   offset = 0                   → 100% filled  (full circle)
  const offset = useSharedValue(CIRCUMFERENCE);

  useEffect(() => {
    const clamped = Math.max(0, Math.min(1, progress));
    offset.value = withTiming(CIRCUMFERENCE * (1 - clamped), {
      duration: 450,
      easing: Easing.out(Easing.quad),
    });
  }, [progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: offset.value,
  }));

  return (
    <Svg
      width={SVG_SIZE}
      height={SVG_SIZE}
      viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
    >
      {/* Background track — full circle */}
      <Circle
        cx={100} cy={100} r={RING_RADIUS}
        stroke={TRACK_COLOR}
        strokeWidth={STROKE_WIDTH}
        fill="none"
      />
      {/* Progress arc — starts at top via rotation offset applied to origin */}
      <AnimatedCircle
        cx={100} cy={100} r={RING_RADIUS}
        stroke={color}
        strokeWidth={STROKE_WIDTH}
        fill="none"
        strokeDasharray={CIRCUMFERENCE}
        animatedProps={animatedProps}
        strokeLinecap="round"
        rotation={-90}
        origin={`${SVG_SIZE / 2}, ${SVG_SIZE / 2}`}
      />
    </Svg>
  );
}

// ── XP History item ───────────────────────────────────────────────────────────
function HistoryItem({ item, colors }) {
  const d   = new Date(item.createdAt);
  const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const label = `${mon[d.getMonth()]} ${d.getDate()}`;
  return (
    <View style={[styles.historyRow, { borderBottomColor: colors.border }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.historyReason, { color: colors.textPrimary }]} numberOfLines={1}>
          {item.reason}
        </Text>
        <Text style={[styles.historyDate, { color: colors.textMuted }]}>{label}</Text>
      </View>
      <Text style={[styles.historyXp, { color: '#a78bfa' }]}>+{item.amount} XP</Text>
    </View>
  );
}

// ── Level row in "All Levels" section ─────────────────────────────────────────
function LevelRow({ lvl, current, colors }) {
  const isActive  = current.level === lvl.level;
  const isPast    = current.level > lvl.level;
  const icon      = getLevelIcon(lvl.level);
  return (
    <View style={[styles.levelRow, {
      backgroundColor: isActive ? colors.primary + '22' : 'transparent',
      borderColor:     isActive ? colors.primary + '55' : colors.border,
    }]}>
      <Text style={{ fontSize: 20, width: 32 }}>{icon}</Text>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={[styles.levelRowName, {
          color: isActive ? colors.primary : isPast ? colors.textSecondary : colors.textMuted,
          fontWeight: isActive ? '700' : '500',
        }]}>
          {lvl.level}. {lvl.name}
        </Text>
        <Text style={[styles.levelRowXp, { color: colors.textMuted }]}>
          {lvl.minXp.toLocaleString()} XP
        </Text>
      </View>
      {isPast  && <Text style={{ fontSize: 16 }}>✅</Text>}
      {isActive && <Text style={[styles.nowBadge, { color: colors.primary, backgroundColor: colors.primary + '22' }]}>NOW</Text>}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function XpDetailScreen({ navigation, route }) {
  const { colors } = useTheme();
  const [xpData,   setXpData]   = useState(route?.params?.xpData || null);
  const [history,  setHistory]  = useState([]);
  const [loading,  setLoading]  = useState(!route?.params?.xpData);

  // RN Animated for the bar fill (kept separate from Reanimated)
  const barAnim = useRef(new RNAnimated.Value(0)).current;

  const fetchData = useCallback(async () => {
    try {
      const [profRes, histRes] = await Promise.all([
        api.get('/api/xp/profile'),
        api.get('/api/xp/history'),
      ]);
      setXpData(profRes.data);
      setHistory(histRes.data || []);
    } catch (_) {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!xpData) return;
    // Derive progress locally from totalXp — guaranteed to match labels shown below
    const { progress } = getLevelInfo(xpData.totalXp || 0);
    RNAnimated.timing(barAnim, {
      toValue: progress,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [xpData]);

  if (loading || !xpData) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // ── Derive all display values from totalXp locally (not from API's progress field)
  // so the ring, bar, and labels are always in perfect sync.
  const totalXp = xpData.totalXp || 0;
  const { current, next, xpIntoLevel, xpNeeded, progress } = getLevelInfo(totalXp);
  const pct  = next ? Math.round((xpIntoLevel / xpNeeded) * 100) : 100;
  const icon = getLevelIcon(current.level);

  // Accent color: use coral (#FF6B6B) if theme primary is purple-ish, else theme primary
  const ringColor = '#FF6B6B';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      {/* Navbar */}
      <View style={[styles.navbar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backArrow, { color: colors.textPrimary }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.textPrimary }]}>XP &amp; Levels</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

        {/* ── Hero: circular ring + level name ── */}
        <View style={styles.hero}>
          <View style={styles.ringWrap}>
            <CircularRing progress={progress} color={ringColor} />
            {/* Center content — absolutely positioned inside the SVG area */}
            <View style={styles.ringCenter}>
              <Text style={{ fontSize: 36 }}>{icon}</Text>
              <Text style={[styles.heroLevel, { color: ringColor }]}>Lv.{current.level}</Text>
              <Text style={[styles.heroName, { color: colors.textPrimary }]}>{current.name}</Text>
            </View>
          </View>

          {/* Percentage label */}
          <Text style={[styles.pctText, { color: colors.textMuted }]}>
            {pct}% to {next?.name ?? 'Max Level'}
          </Text>

          {/* XP bar — mirrors the ring visually */}
          <View style={[styles.barTrack, { backgroundColor: colors.border, marginTop: 8 }]}>
            <RNAnimated.View style={[styles.barFill, {
              backgroundColor: ringColor,
              width: barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            }]} />
          </View>

          {/* Dynamic XP summary */}
          <Text style={[styles.xpLabel, { color: colors.textSecondary }]}>
            {totalXp.toLocaleString()} XP total
            {next
              ? `  ·  ${(xpNeeded - xpIntoLevel).toLocaleString()} XP to Level ${next.level}`
              : '  ·  Max level reached 🏆'}
          </Text>
        </View>

        {/* ── How to earn XP ── */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>⚡ How to Earn XP</Text>
          {XP_RULES.map((rule, i) => (
            <View key={i} style={[styles.ruleRow, i < XP_RULES.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
              <Text style={{ fontSize: 18, width: 28 }}>{rule.icon}</Text>
              <Text style={[styles.ruleLabel, { color: colors.textSecondary, flex: 1, marginLeft: 10 }]}>{rule.label}</Text>
              <Text style={[styles.ruleXp, { color: ringColor }]}>{rule.xp}</Text>
            </View>
          ))}
        </View>

        {/* ── All Levels ── */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>🏆 All Levels</Text>
          {LEVELS.map((lvl) => (
            <LevelRow key={lvl.level} lvl={lvl} current={current} colors={colors} />
          ))}
        </View>

        {/* ── XP History ── */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>📋 Recent XP Events</Text>
          {history.length === 0 ? (
            <Text style={[styles.historyEmpty, { color: colors.textMuted }]}>
              No XP events yet. Start logging habits to earn XP!
            </Text>
          ) : (
            history.map((item) => (
              <HistoryItem key={item._id} item={item} colors={colors} />
            ))
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1 },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navbar:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  backBtn:     { width: 40, alignItems: 'flex-start' },
  backArrow:   { fontSize: 32, lineHeight: 34, marginTop: -4 },
  navTitle:    { fontSize: 17, fontWeight: '700' },

  hero:        { alignItems: 'center', paddingTop: 32, paddingBottom: 24, paddingHorizontal: 24 },
  // ringWrap must match SVG_SIZE exactly so ringCenter can overlay precisely
  ringWrap:    { width: 200, height: 200, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  ringCenter:  { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  heroLevel:   { fontSize: 22, fontWeight: '800', marginTop: 4 },
  heroName:    { fontSize: 14, fontWeight: '600', marginTop: 2 },
  pctText:     { fontSize: 13, marginBottom: 6 },
  barTrack:    { width: '100%', height: 8, borderRadius: 8, overflow: 'hidden' },
  barFill:     { height: 8, borderRadius: 8 },
  xpLabel:     { fontSize: 13, marginTop: 8, textAlign: 'center' },

  section:     { marginHorizontal: 16, marginTop: 16, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  sectionTitle:{ fontSize: 15, fontWeight: '700', paddingHorizontal: 16, paddingVertical: 14 },

  ruleRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11 },
  ruleLabel:   { fontSize: 13 },
  ruleXp:      { fontSize: 13, fontWeight: '700' },

  levelRow:    { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginVertical: 4, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  levelRowName:{ fontSize: 14 },
  levelRowXp:  { fontSize: 11, marginTop: 2 },
  nowBadge:    { fontSize: 10, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },

  historyRow:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  historyReason:{ fontSize: 13, fontWeight: '500' },
  historyDate: { fontSize: 11, marginTop: 2 },
  historyXp:   { fontSize: 14, fontWeight: '800' },
  historyEmpty:{ paddingHorizontal: 16, paddingBottom: 16, fontSize: 13 },
});
