import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Animated, ActivityIndicator, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import api from '../lib/axios';
import { getLevelInfo, getLevelIcon, LEVELS, XP_RULES } from '../lib/xpLevels';

// ── Circular progress ring ────────────────────────────────────────────────────
function CircularRing({ progress = 0, size = 180, stroke = 16, color = '#7c3aed' }) {
  const half    = size / 2;
  const clamp   = Math.max(0, Math.min(1, progress));
  const rotate1 = clamp > 0.5 ? 180 : clamp * 360;
  const rotate2 = clamp > 0.5 ? (clamp - 0.5) * 360 : 0;
  const bg      = 'rgba(255,255,255,0.06)';

  return (
    <View style={{ width: size, height: size }}>
      {/* Background ring */}
      <View style={{
        position: 'absolute', width: size, height: size,
        borderRadius: half, borderWidth: stroke, borderColor: bg,
      }} />

      {/* Right half (always visible, rotated by first portion) */}
      <View style={{
        position: 'absolute', width: half, height: size,
        overflow: 'hidden', right: 0,
      }}>
        <View style={{
          position: 'absolute', width: size, height: size,
          borderRadius: half, borderWidth: stroke, borderColor: color,
          right: 0,
          transform: [{ rotate: `${rotate1}deg` }],
          transformOrigin: `${-half + stroke / 2}px ${half}px`,
        }} />
      </View>

      {/* Left half (only visible when > 50%) */}
      {clamp > 0.5 && (
        <View style={{
          position: 'absolute', width: half, height: size,
          overflow: 'hidden', left: 0,
        }}>
          <View style={{
            position: 'absolute', width: size, height: size,
            borderRadius: half, borderWidth: stroke, borderColor: color,
            left: 0,
            transform: [{ rotate: `${rotate2}deg` }],
            transformOrigin: `${half + stroke / 2}px ${half}px`,
          }} />
        </View>
      )}
    </View>
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
  const barAnim = useRef(new Animated.Value(0)).current;

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
    Animated.timing(barAnim, {
      toValue: xpData.progress || 0,
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

  const { current, next } = getLevelInfo(xpData.totalXp || 0);
  const pct = Math.round((xpData.progress || 0) * 100);
  const icon = getLevelIcon(current.level);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      {/* Navbar */}
      <View style={[styles.navbar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backArrow, { color: colors.textPrimary }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.textPrimary }]}>XP & Levels</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

        {/* ── Hero: circular ring + level name ── */}
        <View style={styles.hero}>
          <View style={styles.ringWrap}>
            <CircularRing progress={xpData.progress || 0} color={colors.primary} />
            {/* Center content */}
            <View style={styles.ringCenter}>
              <Text style={{ fontSize: 36 }}>{icon}</Text>
              <Text style={[styles.heroLevel, { color: colors.primary }]}>Lv.{current.level}</Text>
              <Text style={[styles.heroName, { color: colors.textPrimary }]}>{current.name}</Text>
            </View>
          </View>

          <Text style={[styles.pctText, { color: colors.textMuted }]}>{pct}% to {next?.name ?? 'Max'}</Text>

          {/* XP bar */}
          <View style={[styles.barTrack, { backgroundColor: colors.border, marginTop: 8 }]}>
            <Animated.View style={[styles.barFill, {
              backgroundColor: colors.primary,
              width: barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            }]} />
          </View>

          <Text style={[styles.xpLabel, { color: colors.textSecondary }]}>
            {(xpData.totalXp || 0).toLocaleString()} XP total
            {next && ` · ${xpData.xpToNext.toLocaleString()} to Level ${next.level}`}
          </Text>
        </View>

        {/* ── How to earn XP ── */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>⚡ How to Earn XP</Text>
          {XP_RULES.map((rule, i) => (
            <View key={i} style={[styles.ruleRow, i < XP_RULES.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
              <Text style={{ fontSize: 18, width: 28 }}>{rule.icon}</Text>
              <Text style={[styles.ruleLabel, { color: colors.textSecondary, flex: 1, marginLeft: 10 }]}>{rule.label}</Text>
              <Text style={[styles.ruleXp, { color: colors.primary }]}>{rule.xp}</Text>
            </View>
          ))}
        </View>

        {/* ── All Levels ── */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>🏆 All Levels</Text>
          {LEVELS.map((lvl, i) => (
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
  ringWrap:    { width: 180, height: 180, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
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
