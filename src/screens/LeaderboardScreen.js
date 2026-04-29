import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, SafeAreaView,
  StatusBar, RefreshControl,
} from 'react-native';
import api from '../lib/axios';

const COLORS = {
  bg: '#0d0d1a', card: '#111120', border: '#1e1e2e',
  primary: '#7c3aed', textPrimary: '#ffffff',
  textSecondary: '#888888', textMuted: '#555555',
  success: '#10b981', danger: '#ef4444', amber: '#f59e0b',
};

const MEDAL = ['🥇', '🥈', '🥉'];

function getAvatarColor(name) {
  const colors = [
    '#7c3aed','#10b981','#ef4444','#f59e0b',
    '#3b82f6','#ec4899','#14b8a6','#f97316',
  ];
  return colors[(name?.charCodeAt(0) || 0) % colors.length];
}

export default function LeaderboardScreen() {
  const [entries,    setEntries]    = useState([]);
  const [myId,       setMyId]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab,        setTab]        = useState('streak'); // 'streak' | 'rate' | 'done'
  const [search,     setSearch]     = useState('');

  const fetchAll = useCallback(async () => {
    try {
      const [lbRes, meRes] = await Promise.all([
        api.get('/api/social/leaderboard'),
        api.get('/api/user/profile'),
      ]);
      setEntries(lbRes.data || []);
      setMyId(meRes.data?._id || meRes.data?.id || null);
    } catch (_) {}
  }, []);

  useEffect(() => {
    (async () => { setLoading(true); await fetchAll(); setLoading(false); })();
  }, [fetchAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await fetchAll(); setRefreshing(false);
  }, [fetchAll]);

  const sorted = [...entries].sort((a, b) => {
    if (tab === 'streak') return (b.streak || b.currentStreak || 0) - (a.streak || a.currentStreak || 0);
    if (tab === 'rate')   return (b.rate || 0) - (a.rate || 0);
    return (b.totalDone || 0) - (a.totalDone || 0);
  });

  const getRate = (entry) => entry.rate ?? entry.completionRate ?? entry.completion ?? 0;

  const getVal = (entry) => {
    if (tab === 'streak') return `${entry.streak ?? entry.currentStreak ?? 0} 🔥`;
    if (tab === 'rate')   return `${Math.round(getRate(entry))}%`;
    return `${entry.totalDone ?? entry.done ?? 0} ✅`;
  };

  const getValColor = () => {
    if (tab === 'streak') return COLORS.primary;
    if (tab === 'rate')   return COLORS.amber;
    return COLORS.success;
  };

  const getValLabel = () => tab === 'streak' ? 'streak' : tab === 'rate' ? 'rate' : 'done';

  const isMe = (entry) => entry._id === myId || entry.id === myId;

  const listEntries = search.trim()
    ? sorted.filter((e) => (e.name || '').toLowerCase().includes(search.toLowerCase()))
    : sorted.slice(3);

  const TABS = [
    ['streak', '🔥 Streak'],
    ['rate',   '📈 Rate'],
    ['done',   '✅ Done'],
  ];

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* Navbar */}
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
            tintColor={COLORS.primary} colors={[COLORS.primary]} />
        }
      >
        <Text style={s.title}>🏆 Leaderboard</Text>
        <Text style={s.subtitle}>See how you rank against others</Text>

        {/* ── 3-tab toggle ── */}
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
            {/* ── Podium ── */}
            {sorted.length >= 3 && (
              <View style={s.podium}>
                {/* 2nd */}
                <View style={[s.podiumSlot, { marginTop: 30 }]}>
                  <Text style={s.podiumMedal}>{MEDAL[1]}</Text>
                  <View style={[s.podiumAvatar, { backgroundColor: getAvatarColor(sorted[1]?.name) }, isMe(sorted[1]) && s.podiumAvatarMe]}>
                    <Text style={s.podiumInitial}>{(sorted[1]?.name || '?')[0].toUpperCase()}</Text>
                  </View>
                  <Text style={s.podiumName} numberOfLines={1}>{sorted[1]?.name || 'User'}</Text>
                  <Text style={[s.podiumVal, { color: getValColor() }]}>{getVal(sorted[1])}</Text>
                  <View style={[s.podiumBar, { height: 50, backgroundColor: COLORS.textMuted }]} />
                </View>
                {/* 1st */}
                <View style={s.podiumSlot}>
                  <Text style={s.podiumMedal}>{MEDAL[0]}</Text>
                  <View style={[s.podiumAvatar, s.podiumAvatarFirst, { backgroundColor: getAvatarColor(sorted[0]?.name) }, isMe(sorted[0]) && s.podiumAvatarMe]}>
                    <Text style={[s.podiumInitial, { fontSize: 22 }]}>{(sorted[0]?.name || '?')[0].toUpperCase()}</Text>
                  </View>
                  <Text style={[s.podiumName, { fontWeight: '700' }]} numberOfLines={1}>{sorted[0]?.name || 'User'}</Text>
                  <Text style={[s.podiumVal, { color: getValColor(), fontSize: 15 }]}>{getVal(sorted[0])}</Text>
                  <View style={[s.podiumBar, { height: 70, backgroundColor: COLORS.primary }]} />
                </View>
                {/* 3rd */}
                <View style={[s.podiumSlot, { marginTop: 48 }]}>
                  <Text style={s.podiumMedal}>{MEDAL[2]}</Text>
                  <View style={[s.podiumAvatar, { backgroundColor: getAvatarColor(sorted[2]?.name) }, isMe(sorted[2]) && s.podiumAvatarMe]}>
                    <Text style={s.podiumInitial}>{(sorted[2]?.name || '?')[0].toUpperCase()}</Text>
                  </View>
                  <Text style={s.podiumName} numberOfLines={1}>{sorted[2]?.name || 'User'}</Text>
                  <Text style={[s.podiumVal, { color: getValColor() }]}>{getVal(sorted[2])}</Text>
                  <View style={[s.podiumBar, { height: 35, backgroundColor: '#2a2a3a' }]} />
                </View>
              </View>
            )}

            {/* ── Search ── */}
            <TextInput
              style={s.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search users..."
              placeholderTextColor={COLORS.textMuted}
              fontSize={14}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {/* ── Ranked list ── */}
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
                        <Text style={[s.listName, me && { color: COLORS.primary }]} numberOfLines={1}>
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

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.bg },
  center:  { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 120, paddingTop: 16 },

  navbar:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
              borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.bg },
  navBrand: { fontSize: 20, fontWeight: '800', color: COLORS.primary },
  navDate:  { fontSize: 11, color: COLORS.textMuted },

  title:   { color: COLORS.textPrimary, fontSize: 22, fontWeight: '700' },
  subtitle:{ color: COLORS.textMuted, fontSize: 13, marginTop: 4, marginBottom: 20 },

  tabRow:       { flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: 12,
                  padding: 4, marginBottom: 16 },
  tab:          { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabActive:    { backgroundColor: COLORS.primary },
  tabTxt:       { color: COLORS.textMuted, fontSize: 13, fontWeight: '600' },
  tabTxtActive: { color: COLORS.textPrimary },

  userCount: { color: COLORS.textMuted, fontSize: 12, textAlign: 'center', marginBottom: 16 },

  empty:      { alignItems: 'center', marginTop: 40 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 16 },
  emptySub:   { color: COLORS.textMuted, fontSize: 14, marginTop: 8, textAlign: 'center' },

  podium:           { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', marginBottom: 28, gap: 8 },
  podiumSlot:       { flex: 1, alignItems: 'center' },
  podiumMedal:      { fontSize: 24, marginBottom: 6 },
  podiumAvatar:     { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  podiumAvatarFirst:{ width: 60, height: 60, borderRadius: 30 },
  podiumAvatarMe:   { borderWidth: 3, borderColor: COLORS.primary },
  podiumInitial:    { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },
  podiumName:       { color: COLORS.textPrimary, fontSize: 12, textAlign: 'center', marginBottom: 2 },
  podiumVal:        { fontSize: 13, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  podiumBar:        { width: '80%', borderTopLeftRadius: 8, borderTopRightRadius: 8 },

  searchInput: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: COLORS.textPrimary, fontSize: 14, marginBottom: 14 },

  listRow:      { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 8 },
  listRowMe:    { backgroundColor: COLORS.primary + '1a', borderColor: COLORS.primary + '4d' },
  listRank:     { width: 30, color: COLORS.textMuted, fontSize: 13, fontWeight: '600' },
  listAvatar:   { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginLeft: 10, marginRight: 12 },
  listAvatarTxt:{ color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
  listNameCol:  { flex: 1 },
  listNameRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  listName:     { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  listEmail:    { color: COLORS.textMuted, fontSize: 11, marginTop: 1 },
  youBadge:     { backgroundColor: COLORS.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  youBadgeTxt:  { color: COLORS.textPrimary, fontSize: 10, fontWeight: '700' },
  listValCol:   { alignItems: 'flex-end' },
  listValNum:   { fontSize: 16, fontWeight: '700' },
  listValLbl:   { color: COLORS.textMuted, fontSize: 10 },
});
