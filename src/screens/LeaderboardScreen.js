import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, SafeAreaView,
  StatusBar, RefreshControl,
} from 'react-native';
import api from '../lib/axios';

const COLORS = {
  bg: '#0d0d1a', card: '#111120', border: '#1e1e2e',
  primary: '#7c3aed', textPrimary: '#ffffff',
  textSecondary: '#888888', textMuted: '#555555',
  success: '#10b981', danger: '#ef4444',
};

const MEDAL = ['🥇', '🥈', '🥉'];

export default function LeaderboardScreen() {
  const [entries,    setEntries]    = useState([]);
  const [myId,       setMyId]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab,        setTab]        = useState('streak'); // 'streak' | 'done'

  const fetchAll = useCallback(async () => {
    try {
      const [lbRes, meRes] = await Promise.all([
        api.get('/api/leaderboard'),
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

  const sorted = [...entries].sort((a, b) =>
    tab === 'streak'
      ? (b.currentStreak || 0) - (a.currentStreak || 0)
      : (b.totalDone || 0) - (a.totalDone || 0),
  );

  if (loading) {
    return (
      <View style={s.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh}
          tintColor={COLORS.primary} colors={[COLORS.primary]} />}
      >
        <Text style={s.title}>🏆 Leaderboard</Text>
        <Text style={s.subtitle}>See how you rank against others</Text>

        {/* Tab toggle */}
        <View style={s.tabRow}>
          {[['streak', '🔥 Streak'], ['done', '✅ Total Done']].map(([key, label]) => (
            <TouchableOpacity key={key} style={[s.tab, tab === key && s.tabActive]}
              onPress={() => setTab(key)} activeOpacity={0.75}>
              <Text style={[s.tabTxt, tab === key && s.tabTxtActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {sorted.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyEmoji}>🏆</Text>
            <Text style={s.emptyTitle}>No data yet</Text>
            <Text style={s.emptySub}>Start logging habits to appear on the leaderboard!</Text>
          </View>
        ) : (
          <>
            {/* Top 3 podium */}
            {sorted.length >= 3 && (
              <View style={s.podium}>
                {/* 2nd */}
                <View style={[s.podiumCol, { marginTop: 24 }]}>
                  <Text style={s.podiumEmoji}>{MEDAL[1]}</Text>
                  <View style={[s.podiumAvatar, { backgroundColor: '#c0c0c0' + '33' }]}>
                    <Text style={s.podiumInitial}>{(sorted[1]?.name || '?')[0].toUpperCase()}</Text>
                  </View>
                  <Text style={s.podiumName} numberOfLines={1}>{sorted[1]?.name || 'User'}</Text>
                  <Text style={s.podiumVal}>
                    {tab === 'streak' ? sorted[1]?.currentStreak || 0 : sorted[1]?.totalDone || 0}
                    {tab === 'streak' ? ' 🔥' : ''}
                  </Text>
                </View>
                {/* 1st */}
                <View style={s.podiumCol}>
                  <Text style={s.podiumEmoji}>{MEDAL[0]}</Text>
                  <View style={[s.podiumAvatar, { backgroundColor: COLORS.primary + '33', borderWidth: 2, borderColor: COLORS.primary }]}>
                    <Text style={[s.podiumInitial, { fontSize: 20 }]}>{(sorted[0]?.name || '?')[0].toUpperCase()}</Text>
                  </View>
                  <Text style={[s.podiumName, { fontWeight: '700' }]} numberOfLines={1}>{sorted[0]?.name || 'User'}</Text>
                  <Text style={[s.podiumVal, { color: COLORS.primary, fontSize: 16 }]}>
                    {tab === 'streak' ? sorted[0]?.currentStreak || 0 : sorted[0]?.totalDone || 0}
                    {tab === 'streak' ? ' 🔥' : ''}
                  </Text>
                </View>
                {/* 3rd */}
                <View style={[s.podiumCol, { marginTop: 36 }]}>
                  <Text style={s.podiumEmoji}>{MEDAL[2]}</Text>
                  <View style={[s.podiumAvatar, { backgroundColor: '#cd7f32' + '33' }]}>
                    <Text style={s.podiumInitial}>{(sorted[2]?.name || '?')[0].toUpperCase()}</Text>
                  </View>
                  <Text style={s.podiumName} numberOfLines={1}>{sorted[2]?.name || 'User'}</Text>
                  <Text style={s.podiumVal}>
                    {tab === 'streak' ? sorted[2]?.currentStreak || 0 : sorted[2]?.totalDone || 0}
                    {tab === 'streak' ? ' 🔥' : ''}
                  </Text>
                </View>
              </View>
            )}

            {/* Full ranked list */}
            <View style={s.listCard}>
              {sorted.map((entry, idx) => {
                const isMe = entry._id === myId || entry.id === myId;
                const val  = tab === 'streak' ? entry.currentStreak || 0 : entry.totalDone || 0;
                const initial = (entry.name || '?')[0].toUpperCase();

                return (
                  <View key={entry._id || idx} style={[s.row, isMe && s.rowHighlight, idx < sorted.length - 1 && s.rowBorder]}>
                    {/* Rank */}
                    <Text style={s.rank}>
                      {idx < 3 ? MEDAL[idx] : `#${idx + 1}`}
                    </Text>
                    {/* Avatar */}
                    <View style={[s.avatar, { backgroundColor: isMe ? COLORS.primary : COLORS.borderHover }]}>
                      <Text style={s.avatarTxt}>{initial}</Text>
                    </View>
                    {/* Name */}
                    <View style={s.nameCol}>
                      <Text style={[s.name, isMe && { color: COLORS.primary }]} numberOfLines={1}>
                        {entry.name || 'User'}{isMe ? ' (You)' : ''}
                      </Text>
                      {entry.email ? <Text style={s.email} numberOfLines={1}>{entry.email}</Text> : null}
                    </View>
                    {/* Value */}
                    <View style={s.valCol}>
                      <Text style={[s.valNum, idx === 0 && { color: COLORS.primary }]}>{val}</Text>
                      <Text style={s.valLbl}>{tab === 'streak' ? 'streak' : 'done'}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
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
  content: { paddingHorizontal: 20, paddingBottom: 100, paddingTop: 16 },
  title:   { color: COLORS.textPrimary, fontSize: 22, fontWeight: '700' },
  subtitle:{ color: COLORS.textMuted, fontSize: 13, marginTop: 4, marginBottom: 20 },

  tabRow:      { flexDirection: 'row', gap: 10, marginBottom: 20 },
  tab:         { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  tabActive:   { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabTxt:      { color: COLORS.textSecondary, fontSize: 13, fontWeight: '500' },
  tabTxtActive:{ color: COLORS.textPrimary, fontWeight: '600' },

  empty:    { alignItems: 'center', marginTop: 60 },
  emptyEmoji:{ fontSize: 48 },
  emptyTitle:{ color: COLORS.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 16 },
  emptySub: { color: COLORS.textMuted, fontSize: 14, marginTop: 8, textAlign: 'center' },

  podium:      { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', marginBottom: 24, gap: 12 },
  podiumCol:   { alignItems: 'center', flex: 1 },
  podiumEmoji: { fontSize: 24, marginBottom: 6 },
  podiumAvatar:{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  podiumInitial:{ color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },
  podiumName:  { color: COLORS.textPrimary, fontSize: 12, textAlign: 'center', marginBottom: 2 },
  podiumVal:   { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },

  listCard:    { backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  row:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  rowHighlight:{ backgroundColor: COLORS.primary + '14' },
  rowBorder:   { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rank:        { width: 32, fontSize: 16, textAlign: 'center' },
  avatar:      { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginHorizontal: 10, backgroundColor: '#2a2a3a' },
  avatarTxt:   { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
  nameCol:     { flex: 1 },
  name:        { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
  email:       { color: COLORS.textMuted, fontSize: 11, marginTop: 1 },
  valCol:      { alignItems: 'flex-end' },
  valNum:      { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
  valLbl:      { color: COLORS.textMuted, fontSize: 10 },
});
