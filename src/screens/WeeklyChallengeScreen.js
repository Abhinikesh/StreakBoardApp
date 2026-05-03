/**
 * WeeklyChallengeScreen.js
 * Full weekly challenge view: rules, personal progress, top-10 leaderboard, rewards.
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, SafeAreaView, StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme, DARK } from '../context/ThemeContext';
import api from '../lib/axios';
import { useOffline } from '../context/OfflineContext';
import OfflineWall from '../components/OfflineWall';

// ── Helpers ─────────────────────────────────────────────────────────────────
function progressLabel(type, progress, target) {
  switch (type) {
    case 'daily_log':   return `${progress} / ${target} days logged`;
    case 'full_day':    return `${progress} / ${target} full days`;
    case 'streak':      return `${progress} / ${target} day streak`;
    case 'early_bird':  return `${progress} / ${target} early days`;
    case 'perfect_day': return `${progress} / ${target} perfect day`;
    default:            return `${progress} / ${target}`;
  }
}

function daysWord(n) { return n === 1 ? '1 day' : `${n} days`; }

const REWARD_ROWS = [
  { label: 'Complete the challenge', reward: '+150 XP' },
  { label: 'Finish in the Top 10',   reward: 'Weekly Winner badge' },
  { label: 'Complete (not top 10)',   reward: 'Participant badge' },
];

// ── Main component ───────────────────────────────────────────────────────────
export default function WeeklyChallengeScreen({ navigation }) {
  const { theme, colors } = useTheme();
  const dark = theme === DARK;
  const s = makeStyles(colors, dark);
  const { isOnline } = useOffline();
  if (!isOnline) return <OfflineWall colors={colors} onBack={() => navigation.goBack()} label="Weekly Challenge requires an internet connection." />;

  const [data,       setData]       = useState(null);   // { challenge, progress, completed, rank }
  const [leaderboard,setLeaderboard]= useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [progRes, lbRes] = await Promise.all([
        api.get('/api/weekly-challenge/my-progress'),
        api.get('/api/weekly-challenge/leaderboard'),
      ]);
      if (progRes.data) setData(progRes.data);
      setLeaderboard(lbRes.data || []);
    } catch (_) {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));

  const onRefresh = useCallback(() => { setRefreshing(true); fetchAll(); }, [fetchAll]);

  if (loading) {
    return (
      <SafeAreaView style={s.root}>
        <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
        <View style={s.navbar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={s.backTxt}>‹</Text>
          </TouchableOpacity>
          <Text style={s.navTitle}>Weekly Challenge</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={s.centre}><ActivityIndicator color={colors.primary} size="large" /></View>
      </SafeAreaView>
    );
  }

  if (!data?.challenge) {
    return (
      <SafeAreaView style={s.root}>
        <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
        <View style={s.navbar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={s.backTxt}>‹</Text>
          </TouchableOpacity>
          <Text style={s.navTitle}>Weekly Challenge</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={s.centre}>
          <Text style={s.emptyIcon}>🏆</Text>
          <Text style={s.emptyTitle}>No active challenge</Text>
          <Text style={s.emptyBody}>A new challenge starts every Monday. Check back soon.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { challenge, progress, completed, rank } = data;
  const pct = Math.min(1, (progress || 0) / (challenge.targetValue || 1));

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />

      {/* Navbar */}
      <View style={s.navbar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backTxt}>‹</Text>
        </TouchableOpacity>
        <Text style={s.navTitle}>Weekly Challenge</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* ── Hero card ── */}
        <View style={s.heroCard}>
          <View style={s.heroTopRow}>
            <View style={s.weekBadge}>
              <Text style={s.weekBadgeTxt}>WEEK {weekNumber(challenge.startDate)}</Text>
            </View>
            {challenge.daysRemaining != null && (
              <Text style={s.heroTimer}>{daysWord(challenge.daysRemaining)} remaining</Text>
            )}
          </View>

          <Text style={s.heroTitle}>{challenge.title}</Text>
          <Text style={s.heroDesc}>{challenge.description}</Text>

          {/* Progress bar */}
          <View style={s.barTrack}>
            <View style={[s.barFill, { width: `${Math.round(pct * 100)}%` }]} />
          </View>
          <View style={s.barRow}>
            <Text style={s.barLabel}>{progressLabel(challenge.type, progress, challenge.targetValue)}</Text>
            <Text style={s.barPct}>{Math.round(pct * 100)}%</Text>
          </View>

          {/* Stats row */}
          <View style={s.statsRow}>
            <View style={s.statPill}>
              <Text style={s.statPillNum}>{(challenge.participantCount || 0).toLocaleString()}</Text>
              <Text style={s.statPillLbl}>Participants</Text>
            </View>
            {rank && (
              <View style={[s.statPill, { backgroundColor: colors.primary + '18' }]}>
                <Text style={[s.statPillNum, { color: colors.primary }]}>#{rank}</Text>
                <Text style={s.statPillLbl}>Your rank</Text>
              </View>
            )}
            {completed && (
              <View style={[s.statPill, { backgroundColor: '#16a34a1a' }]}>
                <Text style={[s.statPillNum, { color: '#16a34a' }]}>✓</Text>
                <Text style={s.statPillLbl}>Completed</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Rewards ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>REWARDS</Text>
          {REWARD_ROWS.map((r, i) => (
            <View key={i} style={[s.rewardRow, i < REWARD_ROWS.length - 1 && s.rewardRowBorder]}>
              <Text style={s.rewardLabel}>{r.label}</Text>
              <Text style={s.rewardValue}>{r.reward}</Text>
            </View>
          ))}
        </View>

        {/* ── Leaderboard ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>TOP 10 THIS WEEK</Text>
          {leaderboard.length === 0 ? (
            <Text style={s.emptyBody}>No participants yet. Be the first!</Text>
          ) : (
            leaderboard.map((entry, i) => {
              const MEDALS = ['🥇', '🥈', '🥉'];
              const entryPct = Math.min(1, entry.progress / (entry.targetValue || 1));
              return (
                <View key={i} style={s.lbRow}>
                  <Text style={s.lbRankTxt}>{i < 3 ? MEDALS[i] : `#${i + 1}`}</Text>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={s.lbName} numberOfLines={1}>{entry.name}</Text>
                    <View style={s.lbBarTrack}>
                      <View style={[s.lbBarFill, { width: `${Math.round(entryPct * 100)}%` }]} />
                    </View>
                  </View>
                  <Text style={s.lbProgress}>
                    {entry.progress}/{entry.targetValue}
                  </Text>
                  {entry.completed && <Text style={s.lbCheck}>✓</Text>}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── ISO week number ──────────────────────────────────────────────────────────
function weekNumber(dateStr) {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - y) / 86400000 + 1) / 7);
}

// ── Styles ───────────────────────────────────────────────────────────────────
function makeStyles(colors, dark) {
  return StyleSheet.create({
    root:    { flex: 1, backgroundColor: colors.background },
    scroll:  { flex: 1 },
    content: { paddingBottom: 40 },
    centre:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },

    // Navbar
    navbar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: colors.border,
      backgroundColor: colors.card,
    },
    backBtn:  { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    backTxt:  { color: colors.primary, fontSize: 26, fontWeight: '300', lineHeight: 30 },
    navTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },

    // Hero
    heroCard: {
      backgroundColor: colors.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.primary + '33',
      margin: 16,
      padding: 20,
    },
    heroTopRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
    weekBadge:    { backgroundColor: colors.primary + '20', borderRadius: 6, paddingHorizontal: 9, paddingVertical: 4 },
    weekBadgeTxt: { color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 0.7 },
    heroTimer:    { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
    heroTitle:    { color: colors.textPrimary, fontSize: 20, fontWeight: '900', marginBottom: 6 },
    heroDesc:     { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 18 },

    barTrack: { height: 8, backgroundColor: colors.border, borderRadius: 6, overflow: 'hidden', marginBottom: 8 },
    barFill:  { height: '100%', backgroundColor: colors.primary, borderRadius: 6 },
    barRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    barLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
    barPct:   { color: colors.primary, fontSize: 12, fontWeight: '800' },

    statsRow:    { flexDirection: 'row', gap: 10 },
    statPill:    { flex: 1, backgroundColor: colors.border + 'aa', borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
    statPillNum: { color: colors.textPrimary, fontSize: 18, fontWeight: '900' },
    statPillLbl: { color: colors.textMuted, fontSize: 10, marginTop: 2 },

    // Section
    section:      { backgroundColor: colors.card, borderRadius: 18, margin: 16, marginTop: 0, overflow: 'hidden' },
    sectionTitle: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },

    // Rewards
    rewardRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
    rewardRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
    rewardLabel:     { color: colors.textSecondary, fontSize: 13, flex: 1 },
    rewardValue:     { color: colors.primary, fontSize: 13, fontWeight: '700', marginLeft: 8 },

    // Leaderboard rows
    lbRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.border },
    lbRankTxt:  { width: 30, fontSize: 18, textAlign: 'center' },
    lbName:     { color: colors.textPrimary, fontSize: 13, fontWeight: '600', marginBottom: 4 },
    lbBarTrack: { height: 4, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
    lbBarFill:  { height: '100%', backgroundColor: colors.primary + 'bb', borderRadius: 3 },
    lbProgress: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginLeft: 10 },
    lbCheck:    { color: '#16a34a', fontSize: 14, fontWeight: '800', marginLeft: 4 },

    // Empty
    emptyIcon:  { fontSize: 48, textAlign: 'center', marginBottom: 12 },
    emptyTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
    emptyBody:  { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 16, paddingBottom: 12 },
  });
}
