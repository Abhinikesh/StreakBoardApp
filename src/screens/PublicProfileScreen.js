import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, StatusBar, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../lib/axios';
import { useTheme } from '../context/ThemeContext';

function getAvatarColor(name) {
  const palette = ['#7c3aed', '#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#ec4899'];
  return palette[(name?.charCodeAt(0) || 0) % palette.length];
}

export default function PublicProfileScreen({ route, navigation }) {
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const { shareCode, userName, userId, currentStreak: paramCurrentStreak } = route.params || {};

  const [profile,  setProfile]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  const fetchProfile = useCallback(async () => {
    if (!shareCode) { setError('No share code provided.'); setLoading(false); return; }
    try {
      const res = await api.get(`/api/social/u/${shareCode}`);
      setProfile(res.data);
    } catch (e) {
      setError(
        e.response?.status === 404
          ? 'This profile is private or doesn\'t exist.'
          : 'Could not load profile. Check your connection.',
      );
    } finally {
      setLoading(false);
    }
  }, [shareCode]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={s.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>{userName || 'Profile'}</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={s.center}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>🔒</Text>
          <Text style={s.errorTitle}>Profile Unavailable</Text>
          <Text style={s.errorSub}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={fetchProfile}>
            <Text style={s.retryBtnTxt}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const p = profile || {};
  const avatarBg  = getAvatarColor(p.name);
  const memberSince = p.createdAt
    ? new Date(p.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : null;

  // The API returns stats nested under `p.stats` (same endpoint the web version uses)
  const st = p.stats || {};
  // currentStreak comes from the leaderboard entry (passed as nav param) since
  // the public-profile endpoint doesn't include it directly.
  const currentStreak = paramCurrentStreak ?? p.currentStreak ?? st.currentStreak ?? 0;
  const bestStreak    = st.longestStreak ?? st.bestStreak    ?? p.bestStreak    ?? p.longestStreak ?? 0;
  const totalDone     = st.totalDone     ?? st.done          ?? p.totalDone     ?? 0;
  const completionRate = Math.round(
    st.overallRate ?? st.completionRate ?? p.overallRate ?? p.completionRate ?? 0
  );

  const STATS = [
    { label: 'Current Streak', value: `${currentStreak} 🔥` },
    { label: 'Best Streak',    value: `${bestStreak} ⭐` },
    { label: 'Total Done',     value: `${totalDone} ✅` },
    { label: 'Completion',     value: `${completionRate}%` },
  ];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      {/* ── Header bar ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{p.name || userName || 'Profile'}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Avatar + Name ── */}
        <View style={s.avatarSection}>
          {p.avatar ? (
            <Image source={{ uri: p.avatar }} style={s.avatarImg} />
          ) : (
            <View style={[s.avatarCircle, { backgroundColor: avatarBg }]}>
              <Text style={s.avatarInitial}>
                {(p.name || '?')[0].toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={s.profileName}>{p.name || 'StreakBoard User'}</Text>
          {memberSince && (
            <Text style={s.memberSince}>Member since {memberSince}</Text>
          )}
          {shareCode && (
            <View style={s.codeChip}>
              <Text style={s.codeChipText}>#{shareCode}</Text>
            </View>
          )}
        </View>

        {/* ── Stats grid ── */}
        <View style={s.statsGrid}>
          {STATS.map((stat, i) => (
            <View
              key={stat.label}
              style={[
                s.statCell,
                i % 2 === 0 && { borderRightWidth: 1, borderRightColor: colors.border },
                i < 2      && { borderBottomWidth: 1, borderBottomColor: colors.border },
              ]}
            >
              <Text style={s.statValue}>{stat.value}</Text>
              <Text style={s.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Active habits ── */}
        {/* The public-profile API does not expose individual habit details for privacy.
             The stats above (longestStreak, overallRate, etc.) reflect overall progress. */}
        {Array.isArray(p.habits) && p.habits.length > 0 ? (
          <View style={s.card}>
            <Text style={s.cardTitle}>Active Habits ({p.habits.length})</Text>
            {p.habits.map((habit, i) => (
              <View
                key={habit._id || i}
                style={[s.habitRow, i < p.habits.length - 1 && s.habitDivider]}
              >
                <Text style={s.habitIcon}>{habit.icon || '🎯'}</Text>
                <View style={s.habitInfo}>
                  <Text style={s.habitName} numberOfLines={1}>{habit.name}</Text>
                  <Text style={s.habitSub}>
                    {habit.trackingPeriod ?? 30}-day goal
                    {habit.currentStreak != null ? `  ·  🔥 ${habit.currentStreak} streak` : ''}
                  </Text>
                </View>
                {habit.todayStatus === 'done' && (
                  <View style={s.doneBadge}><Text style={s.doneBadgeTxt}>✓</Text></View>
                )}
              </View>
            ))}
          </View>
        ) : (
          <View style={s.card}>
            <Text style={s.cardTitle}>Habit Stats</Text>
            <Text style={s.emptyHabits}>
              {`${st.totalHabits ?? 0} habit${(st.totalHabits ?? 0) !== 1 ? 's' : ''} tracked  ·  ${st.activeDays ?? 0} active day${(st.activeDays ?? 0) !== 1 ? 's' : ''}`}
            </Text>
          </View>
        )}

        {/* ── Watermark ── */}
        <View style={s.footer}>
          <Text style={s.footerText}>🔥 StreakBoard · Track what you do. Not what you plan.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  content:{ paddingHorizontal: 20, paddingBottom: 60, paddingTop: 8 },

  // Header
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                paddingHorizontal: 16, paddingVertical: 12,
                borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.bg },
  backBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.card,
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 1, borderColor: colors.border },
  backArrow:  { color: colors.primary, fontSize: 18, fontWeight: '700' },
  headerTitle:{ color: colors.textPrimary, fontSize: 16, fontWeight: '700', flex: 1, textAlign: 'center' },

  // Avatar section
  avatarSection: { alignItems: 'center', paddingVertical: 24 },
  avatarImg:     { width: 88, height: 88, borderRadius: 44, marginBottom: 12 },
  avatarCircle:  { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarInitial: { color: '#fff', fontSize: 36, fontWeight: '700' },
  profileName:   { color: colors.textPrimary, fontSize: 22, fontWeight: '700' },
  memberSince:   { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  codeChip:      { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
                   borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, marginTop: 10 },
  codeChipText:  { color: colors.textMuted, fontSize: 12, fontWeight: '500' },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: colors.card,
               borderRadius: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 16, overflow: 'hidden' },
  statCell:  { width: '50%', alignItems: 'center', paddingVertical: 18 },
  statValue: { color: colors.textPrimary, fontSize: 20, fontWeight: '800' },
  statLabel: { color: colors.textMuted, fontSize: 11, marginTop: 3, fontWeight: '500' },

  // Card
  card:      { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 16 },
  cardTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 12 },

  // Habits
  habitRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  habitDivider:{ borderBottomWidth: 1, borderBottomColor: colors.border },
  habitIcon:   { fontSize: 22, marginRight: 12 },
  habitInfo:   { flex: 1 },
  habitName:   { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  habitSub:    { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  doneBadge:   { backgroundColor: '#22C55E22', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  doneBadgeTxt:{ color: '#22C55E', fontSize: 13, fontWeight: '700' },
  emptyHabits: { color: colors.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 16 },

  // Error
  errorTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '700', marginBottom: 8 },
  errorSub:   { color: colors.textMuted, fontSize: 14, textAlign: 'center', marginHorizontal: 32 },
  retryBtn:   { marginTop: 20, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28 },
  retryBtnTxt:{ color: colors.textPrimary, fontSize: 14, fontWeight: '600' },

  // Footer
  footer:     { alignItems: 'center', marginTop: 8 },
  footerText: { color: colors.textMuted, fontSize: 11 },
});
