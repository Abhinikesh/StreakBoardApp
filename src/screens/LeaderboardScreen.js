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

// A user is considered "inactive" when their current streak is 0
const isInactive = (entry) => (entry?.currentStreak ?? 0) === 0;

function getAvatarColor(name) {
  const palette = ['#7c3aed','#10b981','#ef4444','#f59e0b','#3b82f6','#ec4899','#14b8a6','#f97316'];
  return palette[(name?.charCodeAt(0) || 0) % palette.length];
}

function renderAvatar(user, size = 44, borderColor = null, inactive = false) {
  const bg     = getAvatarColor(user?.name);
  const border = borderColor ? { borderWidth: 3, borderColor } : {};
  const dim    = inactive ? { opacity: 0.45 } : {};

  if (user?.avatar) {
    return (
      <Image
        source={{ uri: user.avatar }}
        style={{ width: size, height: size, borderRadius: size / 2, ...border, ...dim }}
      />
    );
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: bg, alignItems: 'center', justifyContent: 'center',
      ...border, ...dim,
    }}>
      <Text style={{ color: '#ffffff', fontSize: size * 0.38, fontWeight: '700' }}>
        {(user?.name || '?')[0].toUpperCase()}
      </Text>
    </View>
  );
}

// ── Podium card component ────────────────────────────────────────────────────
function PodiumCard({ user, rankIdx, onPress, colors }) {
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
  // "active" = streak > 0 only  |  "all" = everyone
  const [filter,     setFilter]     = useState('active');

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

  // ── Sort: active users always above inactive ones; within each group use tab metric ──
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
          // Active users always rank above inactive ones
          const aActive = a.currentStreak > 0 ? 1 : 0;
          const bActive = b.currentStreak > 0 ? 1 : 0;
          if (aActive !== bActive) return bActive - aActive;

          // Within the same activity tier, sort by the selected tab metric
          if (tab === 'streak') return b.currentStreak  - a.currentStreak;
          if (tab === 'rate')   return b.completionRate - a.completionRate;
          return b.totalDone - a.totalDone;
        });
    } catch (_) { return []; }
  })();

  // ── Apply active filter (never removes — just hides 0-streak entries) ─────
  // When the current user has streak = 0 and filter = 'active', still show them
  const visibleSorted = filter === 'active'
    ? sorted.filter((e) => e.currentStreak > 0 || (e._id || e.id) === myId)
    : sorted;

  const getVal = (entry) => {
    if (!entry) return '—';
    if (tab === 'streak') return `${entry.currentStreak ?? 0} 🔥`;
    if (tab === 'rate')   return `${Math.round(entry.completionRate ?? 0)}%`;
    return `${entry.totalDone ?? 0} ✅`;
  };

  const getValColor = (entry) => {
    if (isInactive(entry) && filter === 'all') return colors.textMuted;
    if (tab === 'streak') return colors.primary;
    if (tab === 'rate')   return '#f59e0b';
    return '#22C55E';
  };

  const isMe = (entry) => entry?._id === myId || entry?.id === myId;

  const listEntries = search.trim()
    ? visibleSorted.filter((e) => (e.name || '').toLowerCase().includes(search.toLowerCase()))
    : visibleSorted.slice(3);

  // Podium uses top-3 of the visible set
  const podiumEntries = visibleSorted.slice(0, 3);

  const navigateToProfile = (user) => {
    if (!user) return;
    navigation.navigate('PublicProfile', {
      shareCode:     user.shareCode,
      userName:      user.name,
      userId:        user._id || user.id,
      currentStreak: user.currentStreak ?? 0,
    });
  };

  const TABS = [['streak', '🔥 Streak'], ['rate', '📈 Rate'], ['done', '✅ Done']];

  // Count for the filter pill labels
  const activeCount   = sorted.filter((e) => e.currentStreak > 0).length;
  const inactiveCount = sorted.length - activeCount;

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      {/* ── Navbar ── */}
      <View style={s.navbar}>
        <Text style={s.navBrand}>🏆 Leaderboard</Text>
        {/* User count chip */}
        <View style={s.countChip}>
          <Text style={s.countChipTxt}>{sorted.length} users</Text>
        </View>
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
        {/* ── Metric tab row ── */}
        <View style={s.tabRow}>
          {TABS.map(([key, label]) => (
            <TouchableOpacity key={key} style={[s.tab, tab === key && s.tabActive]}
              onPress={() => setTab(key)} activeOpacity={0.75}>
              <Text style={[s.tabTxt, tab === key && s.tabTxtActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Active / All filter toggle ── */}
        <View style={s.filterRow}>
          <TouchableOpacity
            style={[s.filterBtn, filter === 'active' && s.filterBtnActive]}
            onPress={() => setFilter('active')}
            activeOpacity={0.75}
          >
            <Text style={[s.filterBtnTxt, filter === 'active' && s.filterBtnTxtActive]}>
              🔥 Active
            </Text>
            {activeCount > 0 && (
              <View style={[s.filterCount, filter === 'active' && s.filterCountActive]}>
                <Text style={[s.filterCountTxt, filter === 'active' && s.filterCountTxtActive]}>
                  {activeCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.filterBtn, filter === 'all' && s.filterBtnActive]}
            onPress={() => setFilter('all')}
            activeOpacity={0.75}
          >
            <Text style={[s.filterBtnTxt, filter === 'all' && s.filterBtnTxtActive]}>
              👥 All users
            </Text>
            {inactiveCount > 0 && filter === 'all' && (
              <View style={s.filterCount}>
                <Text style={s.filterCountTxt}>{inactiveCount} inactive</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {visibleSorted.length === 0 ? (
          <View style={s.empty}>
            <Text style={{ fontSize: 48, textAlign: 'center', marginTop: 60 }}>🏆</Text>
            <Text style={s.emptyTitle}>
              {filter === 'active' ? 'No active streaks yet' : 'No rankings yet'}
            </Text>
            <Text style={s.emptySub}>
              {filter === 'active'
                ? 'Switch to "All users" or start logging habits!'
                : 'Start logging habits to appear here'}
            </Text>
            {filter === 'active' && (
              <TouchableOpacity style={s.showAllBtn} onPress={() => setFilter('all')}>
                <Text style={s.showAllBtnTxt}>Show all users</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            {/* ── Top-3 Podium (only shown with ≥ 3 visible users) ── */}
            {podiumEntries.length >= 3 && (
              <View style={s.podiumCard}>
                {/* Order: 2nd, 1st, 3rd */}
                <PodiumCard
                  user={podiumEntries[1]} rankIdx={1}
                  onPress={() => navigateToProfile(podiumEntries[1])}
                  colors={colors}
                />
                <PodiumCard
                  user={podiumEntries[0]} rankIdx={0}
                  onPress={() => navigateToProfile(podiumEntries[0])}
                  colors={colors}
                />
                <PodiumCard
                  user={podiumEntries[2]} rankIdx={2}
                  onPress={() => navigateToProfile(podiumEntries[2])}
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

            {/* ── "All" mode: separator label before inactive section ── */}
            {filter === 'all' && !search.trim() && inactiveCount > 0 && (() => {
              // Check if the list contains any inactive entry after the top-3
              const listHasInactive = listEntries.some(isInactive);
              if (!listHasInactive) return null;
              // Find where the first inactive entry starts in listEntries
              const firstInactiveLocalIdx = listEntries.findIndex(isInactive);
              return firstInactiveLocalIdx > 0 ? null : null; // separator rendered inline below
            })()}

            {/* ── List #4+ ── */}
            {listEntries.length === 0 && search.trim() ? (
              <View style={s.empty}>
                <Text style={s.emptySub}>No users match "{search}"</Text>
              </View>
            ) : (
              (() => {
                const rows = [];
                let inactiveSepShown = false;

                listEntries.forEach((entry, i) => {
                  // In "All" mode, insert a divider before the first inactive entry
                  if (
                    filter === 'all' && !search.trim() &&
                    !inactiveSepShown && isInactive(entry)
                  ) {
                    inactiveSepShown = true;
                    rows.push(
                      <View key="inactive-sep" style={s.inactiveSep}>
                        <View style={s.inactiveSepLine} />
                        <Text style={s.inactiveSepTxt}>Inactive users</Text>
                        <View style={s.inactiveSepLine} />
                      </View>
                    );
                  }

                  const globalIdx = search.trim()
                    ? visibleSorted.findIndex((e) => (e._id || e.id) === (entry._id || entry.id))
                    : i + 3;
                  const rank       = globalIdx + 1;
                  const me         = isMe(entry);
                  const inactive   = isInactive(entry);
                  const accentColor = inactive
                    ? colors.border
                    : rank <= 7 ? colors.primary : colors.border;

                  rows.push(
                    <TouchableOpacity
                      key={entry._id || entry.id || i}
                      style={[
                        s.listRow,
                        me      && s.listRowMe,
                        inactive && filter === 'all' && s.listRowInactive,
                        { borderLeftColor: accentColor },
                      ]}
                      activeOpacity={0.8}
                      onPress={() => navigateToProfile(entry)}
                    >
                      {/* Rank */}
                      <Text style={[s.listRank, inactive && filter === 'all' && s.dimText]}>
                        {globalIdx < 3 ? MEDAL[globalIdx] : `#${rank}`}
                      </Text>

                      {/* Avatar */}
                      <View style={{ marginHorizontal: 10 }}>
                        {renderAvatar(entry, 42, me ? colors.primary : null, inactive && filter === 'all')}
                      </View>

                      {/* Name + badges */}
                      <View style={s.listNameCol}>
                        <View style={s.listNameRow}>
                          <Text
                            style={[
                              s.listName,
                              me && { color: colors.primary },
                              inactive && filter === 'all' && s.dimText,
                            ]}
                            numberOfLines={1}
                          >
                            {entry.name || 'User'}
                          </Text>
                          {me && (
                            <View style={s.youBadge}>
                              <Text style={s.youBadgeTxt}>You</Text>
                            </View>
                          )}
                          {/* Inactive badge — only in "All" view */}
                          {inactive && filter === 'all' && !me && (
                            <View style={s.inactiveBadge}>
                              <Text style={s.inactiveBadgeTxt}>Inactive</Text>
                            </View>
                          )}
                        </View>
                        {entry.email
                          ? <Text style={[s.listEmail, inactive && filter === 'all' && s.dimText]} numberOfLines={1}>{entry.email}</Text>
                          : null}
                      </View>

                      {/* Value */}
                      <View style={s.listValCol}>
                        <Text style={[s.listValNum, { color: getValColor(entry) }]}>
                          {getVal(entry)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                });

                return rows;
              })()
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

  // Navbar
  navbar:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
                  borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.bg },
  navBrand:     { fontSize: 20, fontWeight: '800', color: colors.primary },
  countChip:    { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
                  borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  countChipTxt: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },

  // Metric tabs
  tabRow:       { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 12, padding: 4, marginBottom: 12 },
  tab:          { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabActive:    { backgroundColor: colors.primary },
  tabTxt:       { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  tabTxtActive: { color: colors.textPrimary },

  // Active / All filter toggle
  filterRow:           { flexDirection: 'row', gap: 8, marginBottom: 16 },
  filterBtn:           { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                         gap: 6, paddingVertical: 9, borderRadius: 12,
                         backgroundColor: colors.card,
                         borderWidth: 1.5, borderColor: colors.border },
  filterBtnActive:     { borderColor: colors.primary, backgroundColor: colors.primary + '18' },
  filterBtnTxt:        { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  filterBtnTxtActive:  { color: colors.primary },
  filterCount:         { backgroundColor: colors.border, borderRadius: 10,
                         paddingHorizontal: 7, paddingVertical: 2 },
  filterCountActive:   { backgroundColor: colors.primary },
  filterCountTxt:      { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  filterCountTxtActive:{ color: '#ffffff' },

  // Empty state
  empty:      { alignItems: 'center', marginTop: 40 },
  emptyTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 16 },
  emptySub:   { color: colors.textMuted, fontSize: 14, marginTop: 8, textAlign: 'center' },
  showAllBtn: { marginTop: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
                borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28 },
  showAllBtnTxt: { color: colors.primary, fontSize: 14, fontWeight: '600' },

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

  // Inactive section separator
  inactiveSep:     { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  inactiveSepLine: { flex: 1, height: 1, backgroundColor: colors.border },
  inactiveSepTxt:  { color: colors.textMuted, fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },

  // List rows
  listRow:         {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border,
    borderLeftWidth: 4,
    paddingHorizontal: 12, paddingVertical: 12, marginBottom: 8,
  },
  listRowMe:       { backgroundColor: colors.primary + '1a', borderColor: colors.primary + '4d' },
  listRowInactive: { opacity: 0.6 },
  listRank:        { width: 30, color: colors.textMuted, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  listNameCol:     { flex: 1 },
  listNameRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  listName:        { color: colors.textPrimary, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  listEmail:       { color: colors.textMuted, fontSize: 11, marginTop: 1 },
  dimText:         { color: colors.textMuted },

  // Badges
  youBadge:          { backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  youBadgeTxt:       { color: colors.textPrimary, fontSize: 10, fontWeight: '700' },
  inactiveBadge:     { backgroundColor: colors.border, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  inactiveBadgeTxt:  { color: colors.textMuted, fontSize: 10, fontWeight: '600' },

  listValCol:  { alignItems: 'flex-end', minWidth: 60 },
  listValNum:  { fontSize: 15, fontWeight: '800' },
});
