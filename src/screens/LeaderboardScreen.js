import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Image,
  StatusBar, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../lib/axios';
import { useTheme } from '../context/ThemeContext';

const MEDAL       = ['🥇', '🥈', '🥉'];
const MEDAL_COLOR = ['#FFD700', '#C0C0C0', '#CD7F32'];
const PODIUM_BG   = ['#7C3AED', '#6B7280', '#9CA3AF'];
const PODIUM_H    = [90, 60, 50]; // heights for 1st, 2nd, 3rd

function getAvatarColor(name) {
  const palette = ['#7c3aed','#10b981','#ef4444','#f59e0b','#3b82f6','#ec4899','#14b8a6','#f97316'];
  return palette[(name?.charCodeAt(0) || 0) % palette.length];
}

function renderAvatar(user, size = 44, borderColor = null) {
  const bg = getAvatarColor(user?.name);
  const border = borderColor ? { borderWidth: 3, borderColor } : {};
  if (user?.avatar) {
    return (
      <Image
        source={{ uri: user.avatar }}
        style={{ width: size, height: size, borderRadius: size / 2, ...border }}
      />
    );
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: bg, alignItems: 'center', justifyContent: 'center',
      ...border,
    }}>
      <Text style={{ color: '#ffffff', fontSize: size * 0.38, fontWeight: '700' }}>
        {(user?.name || '?')[0].toUpperCase()}
      </Text>
    </View>
  );
}

// ── Podium card component ────────────────────────────────────────────────────
function PodiumCard({ user, rankIdx, onPress, colors }) {
  // rankIdx: 0=1st, 1=2nd, 2=3rd (array indices for sorted[])
  // display rank: 1/2/3
  const rank       = rankIdx + 1;
  const avatarSize = rank === 1 ? 72 : 60;
  const cardFlex   = rank === 1 ? 1.2 : 1;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{ alignItems: 'center', flex: cardFlex, paddingHorizontal: 4 }}
    >
      <Text style={{ fontSize: 22, marginBottom: 6 }}>{MEDAL[rankIdx]}</Text>

      {/* Avatar with medal-coloured glow */}
      <View style={{
        shadowColor: MEDAL_COLOR[rankIdx], shadowOpacity: 0.7,
        shadowRadius: 10, elevation: 8,
        borderRadius: avatarSize / 2, marginBottom: 8,
      }}>
        {renderAvatar(user, avatarSize, MEDAL_COLOR[rankIdx])}
      </View>

      <Text
        style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 12,
                 textAlign: 'center', maxWidth: 90, marginBottom: 2 }}
        numberOfLines={1}
      >
        {user?.name || '—'}
      </Text>
      <Text style={{ color: MEDAL_COLOR[rankIdx], fontWeight: '800', fontSize: 15, marginBottom: 8 }}>
        {user?.currentStreak ?? 0} 🔥
      </Text>

      {/* Podium block */}
      <View style={{
        width: rank === 1 ? 80 : 66,
        height: PODIUM_H[rankIdx],
        backgroundColor: PODIUM_BG[rankIdx],
        borderTopLeftRadius: 8, borderTopRightRadius: 8,
        opacity: 0.9,
      }} />
    </TouchableOpacity>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────
export default function LeaderboardScreen({ navigation }) {
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const [entries,    setEntries]    = useState([]);
  const [myId,       setMyId]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab,        setTab]        = useState('streak');
  const [search,     setSearch]     = useState('');

  const fetchAll = useCallback(async () => {
    try {
      const [lbRes, meRes] = await Promise.all([
        api.get('/api/social/leaderboard'),
        api.get('/api/user/profile'),
      ]);
      const raw = lbRes.data || [];
      const normalised = raw.map((e) => ({
        ...e,
        currentStreak:  Number(e.currentStreak  ?? e.longestStreak ?? e.streak ?? 0),
        streak:         Number(e.currentStreak  ?? e.longestStreak ?? e.streak ?? 0),
        completionRate: Number(e.completionRate ?? e.overallRate   ?? e.rate   ?? 0),
        rate:           Number(e.completionRate ?? e.overallRate   ?? e.rate   ?? 0),
        totalDone:      Number(e.totalDone      ?? e.done          ?? 0),
      }));
      setEntries(normalised);
      setMyId(meRes.data?._id || meRes.data?.id || null);
    } catch (_) {}
  }, []);

  useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));

  useEffect(() => {
    (async () => { setLoading(true); await fetchAll(); setLoading(false); })();
  }, [fetchAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await fetchAll(); setRefreshing(false);
  }, [fetchAll]);

  // ── Sorted list (null-safe for all tabs) ────────────────────────────────────
  const sorted = (() => {
    try {
      return [...entries]
        .map((e) => ({
          ...e,
          currentStreak:  Number(e.currentStreak)  || 0,
          completionRate: Number(e.completionRate)  || 0,
          totalDone:      Number(e.totalDone)       || 0,
        }))
        .sort((a, b) => {
          if (tab === 'streak') return b.currentStreak  - a.currentStreak;
          if (tab === 'rate')   return b.completionRate - a.completionRate;
          return b.totalDone - a.totalDone;
        });
    } catch (_) { return []; }
  })();

  const getVal = (entry) => {
    if (!entry) return '—';
    if (tab === 'streak') return `${entry.currentStreak ?? 0} 🔥`;
    if (tab === 'rate')   return `${Math.round(entry.completionRate ?? 0)}%`;
    return `${entry.totalDone ?? 0} ✅`;
  };

  const getValColor = () => {
    if (tab === 'streak') return colors.primary;
    if (tab === 'rate')   return '#f59e0b';
    return '#22C55E';
  };

  const isMe = (entry) => entry?._id === myId || entry?.id === myId;

  const listEntries = search.trim()
    ? sorted.filter((e) => (e.name || '').toLowerCase().includes(search.toLowerCase()))
    : sorted.slice(3);

  const navigateToProfile = (user) => {
    if (!user) return;
    navigation.navigate('PublicProfile', {
      shareCode: user.shareCode,
      userName:  user.name,
      userId:    user._id || user.id,
    });
  };

  const TABS = [['streak', '🔥 Streak'], ['rate', '📈 Rate'], ['done', '✅ Done']];

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      {/* ── Navbar — no user count ── */}
      <View style={s.navbar}>
        <Text style={s.navBrand}>🏆 Leaderboard</Text>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
            tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {/* ── Tab row ── */}
        <View style={s.tabRow}>
          {TABS.map(([key, label]) => (
            <TouchableOpacity key={key} style={[s.tab, tab === key && s.tabActive]}
              onPress={() => setTab(key)} activeOpacity={0.75}>
              <Text style={[s.tabTxt, tab === key && s.tabTxtActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {sorted.length === 0 ? (
          <View style={s.empty}>
            <Text style={{ fontSize: 48, textAlign: 'center', marginTop: 60 }}>🏆</Text>
            <Text style={s.emptyTitle}>No rankings yet</Text>
            <Text style={s.emptySub}>Start logging habits to appear here</Text>
          </View>
        ) : (
          <>
            {/* ── Top-3 Podium ── */}
            {sorted.length >= 3 && (
              <View style={s.podiumCard}>
                {/* Order: 2nd, 1st, 3rd */}
                <PodiumCard
                  user={sorted[1]} rankIdx={1}
                  onPress={() => navigateToProfile(sorted[1])}
                  colors={colors}
                />
                <PodiumCard
                  user={sorted[0]} rankIdx={0}
                  onPress={() => navigateToProfile(sorted[0])}
                  colors={colors}
                />
                <PodiumCard
                  user={sorted[2]} rankIdx={2}
                  onPress={() => navigateToProfile(sorted[2])}
                  colors={colors}
                />
              </View>
            )}

            {/* ── Search ── */}
            <TextInput
              style={s.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search users..."
              placeholderTextColor={colors.textMuted}
              fontSize={14}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {/* ── List #4+ ── */}
            {listEntries.length === 0 && search.trim() ? (
              <View style={s.empty}>
                <Text style={s.emptySub}>No users match "{search}"</Text>
              </View>
            ) : (
              listEntries.map((entry, i) => {
                const globalIdx = search.trim()
                  ? sorted.findIndex((e) => (e._id || e.id) === (entry._id || entry.id))
                  : i + 3;
                const rank = globalIdx + 1;
                const me   = isMe(entry);
                const accentColor = rank <= 7 ? colors.primary : colors.border;

                return (
                  <TouchableOpacity
                    key={entry._id || entry.id || i}
                    style={[s.listRow, me && s.listRowMe, { borderLeftColor: accentColor }]}
                    activeOpacity={0.8}
                    onPress={() => navigateToProfile(entry)}
                  >
                    {/* Rank */}
                    <Text style={s.listRank}>
                      {globalIdx < 3 ? MEDAL[globalIdx] : `#${rank}`}
                    </Text>

                    {/* Avatar */}
                    <View style={{ marginHorizontal: 10 }}>
                      {renderAvatar(entry, 42, me ? colors.primary : null)}
                    </View>

                    {/* Name + email */}
                    <View style={s.listNameCol}>
                      <View style={s.listNameRow}>
                        <Text style={[s.listName, me && { color: colors.primary }]} numberOfLines={1}>
                          {entry.name || 'User'}
                        </Text>
                        {me && <View style={s.youBadge}><Text style={s.youBadgeTxt}>You</Text></View>}
                      </View>
                      {entry.email
                        ? <Text style={s.listEmail} numberOfLines={1}>{entry.email}</Text>
                        : null}
                    </View>

                    {/* Value */}
                    <View style={s.listValCol}>
                      <Text style={[s.listValNum, { color: getValColor() }]}>
                        {getVal(entry)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.bg },
  center:  { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 120, paddingTop: 16 },

  navbar:   { flexDirection: 'row', alignItems: 'center',
              paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
              borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.bg },
  navBrand: { fontSize: 20, fontWeight: '800', color: colors.primary },

  tabRow:       { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 12, padding: 4, marginBottom: 16 },
  tab:          { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabActive:    { backgroundColor: colors.primary },
  tabTxt:       { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  tabTxtActive: { color: colors.textPrimary },

  empty:      { alignItems: 'center', marginTop: 40 },
  emptyTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 16 },
  emptySub:   { color: colors.textMuted, fontSize: 14, marginTop: 8, textAlign: 'center' },

  // Podium container
  podiumCard: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center',
    backgroundColor: colors.card, borderRadius: 20,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingTop: 20, paddingBottom: 0,
    marginBottom: 20, overflow: 'hidden',
  },

  searchInput: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    color: colors.textPrimary, fontSize: 14, marginBottom: 14,
  },

  // List rows
  listRow:      {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border,
    borderLeftWidth: 4,
    paddingHorizontal: 12, paddingVertical: 12, marginBottom: 8,
  },
  listRowMe:    { backgroundColor: colors.primary + '1a', borderColor: colors.primary + '4d' },
  listRank:     { width: 30, color: colors.textMuted, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  listNameCol:  { flex: 1 },
  listNameRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  listName:     { color: colors.textPrimary, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  listEmail:    { color: colors.textMuted, fontSize: 11, marginTop: 1 },
  youBadge:     { backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  youBadgeTxt:  { color: colors.textPrimary, fontSize: 10, fontWeight: '700' },
  listValCol:   { alignItems: 'flex-end', minWidth: 60 },
  listValNum:   { fontSize: 15, fontWeight: '800' },
});
