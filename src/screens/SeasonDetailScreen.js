import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import api from '../lib/axios';
import { getLevelIcon } from '../lib/xpLevels';

// ── Reward tiers definition ────────────────────────────────────────────────────
const REWARDS = [
  { rank: '🥇 Rank 1',  xp: '+1000 XP', badge: 'Season Champion 👑', color: '#f59e0b' },
  { rank: '🥈 Rank 2',  xp: '+600 XP',  badge: 'Season Runner-up 🌟', color: '#9ca3af' },
  { rank: '🥉 Rank 3',  xp: '+400 XP',  badge: 'Season Podium 🏅',    color: '#cd7c3a' },
  { rank: 'Top 4–10',   xp: '+200 XP',  badge: 'Top 10 ⚡',           color: '#7c3aed' },
  { rank: '15+ days logged', xp: '+100 XP', badge: 'Participant 🎽',  color: '#0ea5e9' },
];

// ── Small avatar circle ────────────────────────────────────────────────────────
function MiniAvatar({ name = '?', size = 36, color = '#7c3aed' }) {
  const letter = (name[0] || '?').toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2,
      backgroundColor: color + '33', borderWidth: 1.5, borderColor: color,
      alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color, fontWeight: '800', fontSize: size * 0.44 }}>{letter}</Text>
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────
export default function SeasonDetailScreen({ navigation, route }) {
  const { colors } = useTheme();
  const initialSeason = route?.params?.season || null;

  const [season,     setSeason]     = useState(initialSeason);
  const [top3,       setTop3]       = useState([]);
  const [myRank,     setMyRank]     = useState(null);
  const [past,       setPast]       = useState([]);
  const [loading,    setLoading]    = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [currentRes, lbRes, myRankRes, pastRes] = await Promise.all([
        api.get('/api/seasons/current'),
        api.get('/api/seasons/leaderboard'),
        api.get('/api/seasons/my-rank'),
        api.get('/api/seasons/past'),
      ]);
      if (currentRes.data) setSeason(currentRes.data);
      setTop3((lbRes.data || []).slice(0, 3));
      setMyRank(myRankRes.data);
      setPast(pastRes.data || []);
    } catch (_) {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return <View style={[styles.center, { backgroundColor: colors.bg }]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>;
  }

  const MEDAL = ['🥇', '🥈', '🥉'];
  const CROWN_COLOR = ['#f59e0b', '#9ca3af', '#cd7c3a'];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      {/* Navbar */}
      <View style={[styles.navbar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backArrow, { color: colors.textPrimary }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.textPrimary }]}>Season Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

        {/* ── Current season hero ── */}
        <View style={[styles.heroCard, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '44' }]}>
          <Text style={[styles.heroEmoji]}>🌟</Text>
          <Text style={[styles.heroName, { color: colors.textPrimary }]}>
            {season?.name ?? 'Current Season'}
          </Text>
          {season?.daysRemaining != null && (
            <View style={[styles.countdownPill, { backgroundColor: colors.primary + '22', borderColor: colors.primary + '44' }]}>
              <Text style={[styles.countdownTxt, { color: colors.primary }]}>
                {season.daysRemaining > 0
                  ? `⏳ ${season.daysRemaining} day${season.daysRemaining !== 1 ? 's' : ''} remaining`
                  : '🏁 Season ended'}
              </Text>
            </View>
          )}
        </View>

        {/* ── My rank ── */}
        {myRank && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>📍 Your Standing</Text>
            <View style={styles.myRankRow}>
              <View style={[styles.rankBadge, { backgroundColor: colors.primary + '22', borderColor: colors.primary + '44' }]}>
                <Text style={[styles.rankNum, { color: colors.primary }]}>
                  {myRank.rank != null ? `#${myRank.rank}` : '—'}
                </Text>
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={[styles.rankLabel, { color: colors.textPrimary }]}>
                  {myRank.rank != null ? `Rank ${myRank.rank} this season` : 'Not ranked yet'}
                </Text>
                <Text style={[styles.rankSub, { color: colors.textMuted }]}>
                  {myRank.bestStreak > 0
                    ? `Best streak: ${myRank.bestStreak} days 🔥`
                    : 'Start logging to appear on the board!'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Top 3 leaders ── */}
        {top3.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>🏆 Current Leaders</Text>
            {top3.map((entry, i) => (
              <View key={entry._id} style={[styles.leaderRow, i < top3.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                <Text style={[styles.leaderMedal]}>{MEDAL[i]}</Text>
                <MiniAvatar name={entry.name} size={38} color={CROWN_COLOR[i]} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.leaderName, { color: colors.textPrimary }]}>{entry.name}</Text>
                  <Text style={[styles.leaderStreak, { color: colors.textMuted }]}>
                    {getLevelIcon(entry.currentLevel || 1)} Lv.{entry.currentLevel || 1}
                  </Text>
                </View>
                <View style={[styles.streakPill, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '33' }]}>
                  <Text style={[styles.streakPillTxt, { color: colors.primary }]}>{entry.bestStreak}🔥</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── Rewards tiers ── */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>🎁 End-of-Season Rewards</Text>
          {REWARDS.map((r, i) => (
            <View key={i} style={[styles.rewardRow, i < REWARDS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rewardRank, { color: colors.textPrimary }]}>{r.rank}</Text>
                <Text style={[styles.rewardBadge, { color: colors.textMuted }]}>{r.badge}</Text>
              </View>
              <View style={[styles.rewardXpPill, { backgroundColor: r.color + '22', borderColor: r.color + '44' }]}>
                <Text style={[styles.rewardXpTxt, { color: r.color }]}>{r.xp}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Past seasons ── */}
        {past.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>📜 Past Seasons</Text>
            {past.map((s, i) => (
              <View key={s._id} style={[styles.pastRow, i < past.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                <Text style={{ fontSize: 20, marginRight: 10 }}>👑</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pastName, { color: colors.textPrimary }]}>{s.name}</Text>
                  {s.winner ? (
                    <Text style={[styles.pastWinner, { color: colors.textMuted }]}>
                      Champion: {s.winner.name} · {s.winner.bestStreak}🔥
                    </Text>
                  ) : (
                    <Text style={[styles.pastWinner, { color: colors.textMuted }]}>No ranked participants</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1 },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navbar:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
             paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  backBtn:  { width: 40, alignItems: 'flex-start' },
  backArrow:{ fontSize: 32, lineHeight: 34, marginTop: -4 },
  navTitle: { fontSize: 17, fontWeight: '700' },

  heroCard: { margin: 16, borderRadius: 20, borderWidth: 1, alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20 },
  heroEmoji:{ fontSize: 44, marginBottom: 10 },
  heroName: { fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 12 },
  countdownPill: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 6 },
  countdownTxt:  { fontSize: 13, fontWeight: '700' },

  section:      { marginHorizontal: 16, marginTop: 16, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  sectionTitle: { fontSize: 15, fontWeight: '700', paddingHorizontal: 16, paddingVertical: 14 },

  myRankRow:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 14 },
  rankBadge:  { width: 56, height: 56, borderRadius: 28, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  rankNum:    { fontSize: 20, fontWeight: '900' },
  rankLabel:  { fontSize: 14, fontWeight: '700' },
  rankSub:    { fontSize: 12, marginTop: 2 },

  leaderRow:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  leaderMedal:{ fontSize: 22, width: 28, textAlign: 'center', marginRight: 8 },
  leaderName: { fontSize: 14, fontWeight: '700' },
  leaderStreak:{ fontSize: 11, marginTop: 2 },
  streakPill: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  streakPillTxt:{ fontSize: 13, fontWeight: '800' },

  rewardRow:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  rewardRank: { fontSize: 13, fontWeight: '700' },
  rewardBadge:{ fontSize: 11, marginTop: 2 },
  rewardXpPill: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  rewardXpTxt:  { fontSize: 12, fontWeight: '800' },

  pastRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13 },
  pastName:   { fontSize: 14, fontWeight: '700' },
  pastWinner: { fontSize: 12, marginTop: 2 },
});
