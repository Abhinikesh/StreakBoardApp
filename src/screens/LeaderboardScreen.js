import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator,
  StatusBar, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../lib/axios';
import { useTheme } from '../context/ThemeContext';

const MEDAL = ['🥇', '🥈', '🥉'];

function getAvatarColor(name) {
  const palette = ['#7c3aed','#10b981','#ef4444','#f59e0b','#3b82f6','#ec4899','#14b8a6','#f97316'];
  return palette[(name?.charCodeAt(0) || 0) % palette.length];
}

export default function LeaderboardScreen() {
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
      // Normalise field names: API returns overallRate and longestStreak
      const raw = lbRes.data || [];
      const normalised = raw.map((e) => ({
        ...e,
        // streak fields — screen looks for .streak or .currentStreak
        currentStreak: Number(e.currentStreak ?? e.longestStreak ?? e.streak ?? 0),
        streak:        Number(e.currentStreak ?? e.longestStreak ?? e.streak ?? 0),
        // rate field — screen looks for .completionRate or .rate
        completionRate: Number(e.completionRate ?? e.overallRate ?? e.rate ?? 0),
        rate:           Number(e.completionRate ?? e.overallRate ?? e.rate ?? 0),
        // done field
        totalDone: Number(e.totalDone ?? e.done ?? 0),
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

  const sorted = (() => {
    try {
      return [...entries]
        .map((e) => ({
          ...e,
          currentStreak:  Number(e.currentStreak)  || 0,
          completionRate: Number(e.completionRate) || 0,
          totalDone:      Number(e.totalDone)      || 0,
        }))
        .sort((a, b) => {
          if (tab === 'streak') return b.currentStreak  - a.currentStreak;
          if (tab === 'rate')   return b.completionRate - a.completionRate;
          return b.totalDone - a.totalDone;
        });
    } catch (_) {
      return [];
    }
  })();

  const getRate = (entry) => entry.rate ?? entry.completionRate ?? entry.completion ?? 0;

  const getVal = (entry) => {
    if (tab === 'streak') return `${entry.streak ?? entry.currentStreak ?? 0} 🔥`;
    if (tab === 'rate')   return `${Math.round(getRate(entry))}%`;
    return `${entry.totalDone ?? entry.done ?? 0} ✅`;
  };

  const getValColor = () => {
    if (tab === 'streak') return colors.primary;
    if (tab === 'rate')   return '#f59e0b';
    return colors.success;
  };

  const getValLabel = () => tab === 'streak' ? 'streak' : tab === 'rate' ? 'rate' : 'done';
  const isMe = (entry) => entry?._id === myId || entry?.id === myId;

  const listEntries = search.trim()
    ? sorted.filter((e) => (e.name || '').toLowerCase().includes(search.toLowerCase()))
    : sorted.slice(3);

  const TABS = [['streak', '🔥 Streak'], ['rate', '📈 Rate'], ['done', '✅ Done']];

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      <View style={s.navbar}>
        <Text style={s.navBrand}>🏆 Ranks</Text>
        <Text style={s.navDate}>{sorted.length} users</Text>
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
            {sorted.length >= 3 && (
              <View style={s.podium}>
                <View style={[s.podiumSlot, { marginTop: 30 }]}>
                  <Text style={s.podiumMedal}>{MEDAL[1]}</Text>
                  <View style={[s.podiumAvatar, { backgroundColor: getAvatarColor(sorted[1]?.name) }, isMe(sorted[1]) && s.podiumAvatarMe]}>
                    <Text style={s.podiumInitial}>{(sorted[1]?.name || '?')[0].toUpperCase()}</Text>
                  </View>
                  <Text style={s.podiumName} numberOfLines={1}>{sorted[1]?.name || 'User'}</Text>
                  <Text style={[s.podiumVal, { color: getValColor() }]}>{getVal(sorted[1])}</Text>
                  <View style={[s.podiumBar, { height: 50, backgroundColor: colors.textMuted }]} />
                </View>
                <View style={s.podiumSlot}>
                  <Text style={s.podiumMedal}>{MEDAL[0]}</Text>
                  <View style={[s.podiumAvatar, s.podiumAvatarFirst, { backgroundColor: getAvatarColor(sorted[0]?.name) }, isMe(sorted[0]) && s.podiumAvatarMe]}>
                    <Text style={[s.podiumInitial, { fontSize: 22 }]}>{(sorted[0]?.name || '?')[0].toUpperCase()}</Text>
                  </View>
                  <Text style={[s.podiumName, { fontWeight: '700' }]} numberOfLines={1}>{sorted[0]?.name || 'User'}</Text>
                  <Text style={[s.podiumVal, { color: getValColor(), fontSize: 15 }]}>{getVal(sorted[0])}</Text>
                  <View style={[s.podiumBar, { height: 70, backgroundColor: colors.primary }]} />
                </View>
                <View style={[s.podiumSlot, { marginTop: 48 }]}>
                  <Text style={s.podiumMedal}>{MEDAL[2]}</Text>
                  <View style={[s.podiumAvatar, { backgroundColor: getAvatarColor(sorted[2]?.name) }, isMe(sorted[2]) && s.podiumAvatarMe]}>
                    <Text style={s.podiumInitial}>{(sorted[2]?.name || '?')[0].toUpperCase()}</Text>
                  </View>
                  <Text style={s.podiumName} numberOfLines={1}>{sorted[2]?.name || 'User'}</Text>
                  <Text style={[s.podiumVal, { color: getValColor() }]}>{getVal(sorted[2])}</Text>
                  <View style={[s.podiumBar, { height: 35, backgroundColor: colors.borderHover }]} />
                </View>
              </View>
            )}

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

            {listEntries.length === 0 && search.trim() ? (
              <View style={s.empty}>
                <Text style={s.emptySub}>No users match "{search}"</Text>
              </View>
            ) : (
              listEntries.map((entry, i) => {
                const globalIdx = search.trim()
                  ? sorted.findIndex((e) => (e._id || e.id) === (entry._id || entry.id))
                  : i + 3;
                const me = isMe(entry);
                return (
                  <View key={entry._id || entry.id || i} style={[s.listRow, me && s.listRowMe]}>
                    <Text style={s.listRank}>
                      {globalIdx < 3 ? MEDAL[globalIdx] : `#${globalIdx + 1}`}
                    </Text>
                    <View style={[s.listAvatar, { backgroundColor: getAvatarColor(entry.name) }]}>
                      <Text style={s.listAvatarTxt}>{(entry.name || '?')[0].toUpperCase()}</Text>
                    </View>
                    <View style={s.listNameCol}>
                      <View style={s.listNameRow}>
                        <Text style={[s.listName, me && { color: colors.primary }]} numberOfLines={1}>
                          {entry.name || 'User'}
                        </Text>
                        {me && <View style={s.youBadge}><Text style={s.youBadgeTxt}>You</Text></View>}
                      </View>
                      {entry.email ? <Text style={s.listEmail} numberOfLines={1}>{entry.email}</Text> : null}
                    </View>
                    <View style={s.listValCol}>
                      <Text style={[s.listValNum, { color: getValColor() }]}>{getVal(entry)}</Text>
                      <Text style={s.listValLbl}>{getValLabel()}</Text>
                    </View>
                  </View>
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

  navbar:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
              borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.bg },
  navBrand: { fontSize: 20, fontWeight: '800', color: colors.primary },
  navDate:  { fontSize: 11, color: colors.textMuted },

  tabRow:       { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 12, padding: 4, marginBottom: 16 },
  tab:          { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabActive:    { backgroundColor: colors.primary },
  tabTxt:       { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  tabTxtActive: { color: colors.textPrimary },

  empty:      { alignItems: 'center', marginTop: 40 },
  emptyTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 16 },
  emptySub:   { color: colors.textMuted, fontSize: 14, marginTop: 8, textAlign: 'center' },

  podium:           { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', marginBottom: 28, gap: 8 },
  podiumSlot:       { flex: 1, alignItems: 'center' },
  podiumMedal:      { fontSize: 24, marginBottom: 6 },
  podiumAvatar:     { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  podiumAvatarFirst:{ width: 60, height: 60, borderRadius: 30 },
  podiumAvatarMe:   { borderWidth: 3, borderColor: colors.primary },
  podiumInitial:    { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  podiumName:       { color: colors.textPrimary, fontSize: 12, textAlign: 'center', marginBottom: 2 },
  podiumVal:        { fontSize: 13, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  podiumBar:        { width: '80%', borderTopLeftRadius: 8, borderTopRightRadius: 8 },

  searchInput: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: colors.textPrimary, fontSize: 14, marginBottom: 14 },

  listRow:      { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 8 },
  listRowMe:    { backgroundColor: colors.primary + '1a', borderColor: colors.primary + '4d' },
  listRank:     { width: 30, color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  listAvatar:   { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginLeft: 10, marginRight: 12 },
  listAvatarTxt:{ color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  listNameCol:  { flex: 1 },
  listNameRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  listName:     { color: colors.textPrimary, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  listEmail:    { color: colors.textMuted, fontSize: 11, marginTop: 1 },
  youBadge:     { backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  youBadgeTxt:  { color: colors.textPrimary, fontSize: 10, fontWeight: '700' },
  listValCol:   { alignItems: 'flex-end' },
  listValNum:   { fontSize: 16, fontWeight: '700' },
  listValLbl:   { color: colors.textMuted, fontSize: 10 },
});
