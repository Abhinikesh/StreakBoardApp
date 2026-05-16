/**
 * src/screens/LeaderboardScreen.js
 *
 * Global & Friends leaderboards with:
 * - AsyncStorage caching (5 min weekly, 10 min monthly)
 * - Skeleton loading placeholders
 * - Profile photo support with initial-letter fallback
 * - Add Friend via userId (no shareCode)
 * - Last Month's Champion banner on Global tab
 * - Friends tab fetches real friend streak data
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  ActivityIndicator, RefreshControl, Alert, StatusBar,
  Animated, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import api from '../lib/axios';

// ── Cache helpers ──────────────────────────────────────────────────────────────
const CACHE_TTL = { weekly: 5 * 60 * 1000, monthly: 10 * 60 * 1000 };

async function readCache(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const { data, ts, ttl } = JSON.parse(raw);
    if (Date.now() - ts < ttl) return data;
    return null; // expired
  } catch (_) { return null; }
}

async function writeCache(key, data, ttl) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify({ data, ts: Date.now(), ttl }));
  } catch (_) {}
}

// ── Constants ──────────────────────────────────────────────────────────────────
const MEDAL      = ['🥇', '🥈', '🥉'];
const RANK_COLOR = ['#F59E0B', '#94A3B8', '#CD7F32'];
const PALETTE    = ['#7c3aed','#10b981','#ef4444','#f59e0b','#3b82f6','#ec4899','#14b8a6','#f97316'];

function avatarColor(name = '') {
  return PALETTE[(name.charCodeAt(0) || 0) % PALETTE.length];
}

// ── Avatar (photo or initial) ──────────────────────────────────────────────────
function Avatar({ name = '?', photoURL, size = 42 }) {
  const [imgErr, setImgErr] = useState(false);
  const bg  = avatarColor(name);
  const uri = photoURL && !imgErr ? photoURL : null;

  if (uri) {
    return (
      <Image
        source={{ uri, cache: 'force-cache' }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg + '28' }}
        onError={() => setImgErr(true)}
      />
    );
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: bg + '28', borderWidth: 2, borderColor: bg,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <Text style={{ color: bg, fontWeight: '800', fontSize: size * 0.42 }}>
        {(name[0] || '?').toUpperCase()}
      </Text>
    </View>
  );
}

// ── Skeleton card ──────────────────────────────────────────────────────────────
function SkeletonCard({ colors }) {
  const anim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1,   duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={[sk.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: anim }]}>
      <View style={[sk.circle, { backgroundColor: colors.border }]} />
      <View style={sk.lines}>
        <View style={[sk.lineW, { backgroundColor: colors.border }]} />
        <View style={[sk.lineN, { backgroundColor: colors.border }]} />
      </View>
    </Animated.View>
  );
}

const sk = StyleSheet.create({
  card:   { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 8, gap: 12 },
  circle: { width: 42, height: 42, borderRadius: 21 },
  lines:  { flex: 1, gap: 8 },
  lineW:  { height: 13, borderRadius: 6, width: '60%' },
  lineN:  { height: 10, borderRadius: 5, width: '35%' },
});

// ── Rank badge ─────────────────────────────────────────────────────────────────
function RankBadge({ rank }) {
  if (rank <= 3) return (
    <Text style={{ fontSize: 22, width: 36, textAlign: 'center' }}>{MEDAL[rank - 1]}</Text>
  );
  return (
    <Text style={{ color: '#6B7280', fontWeight: '700', fontSize: 14, width: 36, textAlign: 'center' }}>
      #{rank}
    </Text>
  );
}

// ── Champion banner ────────────────────────────────────────────────────────────
function ChampionBanner({ champion, colors }) {
  if (!champion) return null;
  return (
    <View style={[ch.wrap, { borderColor: '#F59E0B55', backgroundColor: '#F59E0B0D' }]}>
      <Text style={ch.crown}>🏆</Text>
      <View style={ch.left}>
        <Text style={[ch.label, { color: '#F59E0B' }]}>LAST MONTH'S CHAMPION</Text>
        <Text style={[ch.name, { color: colors.textPrimary }]} numberOfLines={1}>
          {champion.name}
        </Text>
        <Text style={[ch.streak, { color: '#F59E0B' }]}>🔥 {champion.currentStreak ?? champion.streak ?? 0} day streak</Text>
      </View>
      <Avatar name={champion.name} photoURL={champion.photoURL || champion.avatar} size={48} />
    </View>
  );
}
const ch = StyleSheet.create({
  wrap:   { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1.5, padding: 14, marginBottom: 16, gap: 12 },
  crown:  { fontSize: 28 },
  left:   { flex: 1 },
  label:  { fontSize: 9, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  name:   { fontSize: 16, fontWeight: '800', marginBottom: 2 },
  streak: { fontSize: 13, fontWeight: '700' },
});

// ── User card ──────────────────────────────────────────────────────────────────
function UserCard({ entry, rank, isMe, isFriend, onAddFriend, addingId, showAddBtn, colors }) {
  const rankCol = rank <= 3 ? RANK_COLOR[rank - 1] : null;
  const adding  = addingId === (entry._id || entry.id);
  const streak  = entry.currentStreak ?? entry.streak ?? 0;
  const photo   = entry.photoURL || entry.avatar || null;

  return (
    <View style={[
      cs.card,
      { backgroundColor: colors.card, borderColor: colors.border },
      isMe && { backgroundColor: colors.primary + '0D', borderColor: colors.primary + '55' },
      rank <= 3 && { borderColor: RANK_COLOR[rank - 1] + '55' },
    ]}>
      {rank <= 3 && <View style={[cs.accentBar, { backgroundColor: RANK_COLOR[rank - 1] }]} />}
      <RankBadge rank={rank} />
      <Avatar name={entry.name} photoURL={photo} size={42} />

      <View style={{ flex: 1, marginLeft: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text style={[cs.cardName, { color: isMe ? colors.primary : colors.textPrimary }]} numberOfLines={1}>
            {entry.name}
          </Text>
          {isMe && (
            <View style={[cs.youBadge, { backgroundColor: colors.primary }]}>
              <Text style={cs.youTxt}>You</Text>
            </View>
          )}
        </View>
        <Text style={[cs.streakTxt, { color: rankCol || colors.primary, marginTop: 2 }]}>
          🔥 {streak}{rank <= 3 ? ' day streak' : ''}
        </Text>
      </View>

      {showAddBtn && !isMe && (
        isFriend ? (
          <View style={[cs.friendedBtn, { borderColor: colors.border }]}>
            <Text style={{ color: colors.textMuted, fontSize: 16 }}>✓</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[cs.addBtn, { borderColor: colors.primary + '66', backgroundColor: colors.primary + '14' },
                    adding && { opacity: 0.6 }]}
            onPress={() => onAddFriend(entry)}
            disabled={adding}
            activeOpacity={0.75}
          >
            {adding
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Text style={[cs.addBtnTxt, { color: colors.primary }]}>+ Add</Text>}
          </TouchableOpacity>
        )
      )}
    </View>
  );
}

// ── Sub-tab pills ──────────────────────────────────────────────────────────────
function SubTabs({ value, onChange, colors }) {
  return (
    <View style={[cs.subRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {[['weekly', 'Weekly'], ['monthly', 'Monthly']].map(([k, l]) => (
        <TouchableOpacity
          key={k} onPress={() => onChange(k)} activeOpacity={0.8}
          style={[cs.subTab, value === k && { backgroundColor: colors.primary }]}
        >
          <Text style={[cs.subTxt, { color: value === k ? '#fff' : colors.textMuted }]}>{l}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Footer ─────────────────────────────────────────────────────────────────────
function Footer({ colors }) {
  return (
    <Text style={[cs.footer, { color: colors.textMuted }]}>
      Showing top 30 · Keep your streak alive to climb up 🔥
    </Text>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function LeaderboardScreen() {
  const { colors } = useTheme();

  const [mainTab,    setMainTab]    = useState('global');
  const [subTab,     setSubTab]     = useState('weekly');

  const [myId,       setMyId]       = useState(null);
  const [friendIds,  setFriendIds]  = useState(new Set());

  const [globalData,  setGlobalData]  = useState({ weekly: null, monthly: null });
  const [friendsData, setFriendsData] = useState({ weekly: null, monthly: null });
  const [champion,    setChampion]    = useState(null);

  const [skelLoading, setSkelLoading] = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [addingId,    setAddingId]    = useState(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ── Normalise API response into sorted array ───────────────────────────────
  const normalise = (raw = []) =>
    raw
      .slice(0, 30)
      .map(e => ({ ...e, currentStreak: Number(e.currentStreak ?? e.streak ?? e.bestStreak ?? 0) }))
      .sort((a, b) => b.currentStreak - a.currentStreak);

  // ── Fetch all data ─────────────────────────────────────────────────────────
  const fetchAll = useCallback(async ({ useCache = true } = {}) => {
    try {
      // Me
      const meRes = await api.get('/api/user/profile').catch(() => null);
      const me    = meRes?.data;
      const meId  = me?._id || me?.id || null;
      if (meId) setMyId(meId);

      // Friends list (for isFriend check)
      const frRes = await api.get('/api/social/friends').catch(() => ({ data: [] }));
      const frList = Array.isArray(frRes.data) ? frRes.data : [];
      const frIds  = new Set(frList.map(f => f._id || f.id).filter(Boolean));
      setFriendIds(frIds);

      // ── Global leaderboard (with cache) ───────────────────────────────────
      const fetchPeriod = async (period) => {
        const cacheKey = `lb_global_${period}_v2`;
        const ttl      = CACHE_TTL[period];
        if (useCache) {
          const cached = await readCache(cacheKey);
          if (cached) return cached;
        }
        const res = await api.get(`/api/social/leaderboard?period=${period}&limit=30`).catch(() => null);
        const data = normalise(Array.isArray(res?.data) ? res.data : []);
        await writeCache(cacheKey, data, ttl);
        return data;
      };

      const [gWeekly, gMonthly] = await Promise.all([
        fetchPeriod('weekly'),
        fetchPeriod('monthly'),
      ]);
      setGlobalData({ weekly: gWeekly, monthly: gMonthly });

      // ── Last month's champion ──────────────────────────────────────────────
      const champRes = await api.get('/api/social/leaderboard/champion/last-month').catch(() => null);
      if (champRes?.data && (champRes.data._id || champRes.data.id)) {
        setChampion(champRes.data);
      }

      // ── Friends leaderboard — build from friends list + self ───────────────
      const buildFriendsBoard = (period) => {
        // Use the friend list's streak data; augment with self
        const entries = frList.map(f => ({
          ...f,
          currentStreak: Number(f.currentStreak ?? f.streak ?? 0),
        }));
        if (me) {
          entries.push({
            _id: meId, id: meId, name: me.name || 'You',
            photoURL: me.photoURL || me.avatar,
            currentStreak: Number(me.currentStreak ?? me.streak ?? 0),
          });
        }
        return entries.sort((a, b) => b.currentStreak - a.currentStreak).slice(0, 30);
      };

      setFriendsData({
        weekly:  buildFriendsBoard('weekly'),
        monthly: buildFriendsBoard('monthly'),
      });

    } catch (_) {}
  }, []);

  useFocusEffect(useCallback(() => {
    setSkelLoading(true);
    fadeAnim.setValue(0);

    // Show cached data first
    fetchAll({ useCache: true }).finally(() => {
      setSkelLoading(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    });
  }, [fetchAll]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll({ useCache: false });
    setRefreshing(false);
  }, [fetchAll]);

  // ── Add friend using userId only (no shareCode) ───────────────────────────
  const handleAddFriend = useCallback(async (user) => {
    const id = user._id || user.id;
    if (!id) return;
    setAddingId(id);
    try {
      await api.post('/api/social/friends/add', { friendId: id });
      setFriendIds(prev => new Set([...prev, id]));
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Could not add friend.');
    } finally {
      setAddingId(null);
    }
  }, []);

  const isMe     = (e) => (e._id || e.id) === myId;
  const isFriend = (e) => friendIds.has(e._id || e.id);

  const currentList = mainTab === 'global'
    ? (globalData[subTab]  ?? [])
    : (friendsData[subTab] ?? []);

  const renderItem = useCallback(({ item, index }) => (
    <UserCard
      entry={item} rank={index + 1}
      isMe={isMe(item)} isFriend={isFriend(item)}
      onAddFriend={handleAddFriend} addingId={addingId}
      showAddBtn={mainTab === 'global'}
      colors={colors}
    />
  ), [mainTab, myId, friendIds, addingId, colors]);

  const keyExtractor = useCallback((item, i) => item._id || item.id || String(i), []);

  const showSkeleton = skelLoading && currentList.length === 0;

  return (
    <SafeAreaView style={[cs.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      {/* Navbar */}
      <View style={[cs.navbar, { borderBottomColor: colors.border }]}>
        <Text style={[cs.navBrand, { color: colors.primary }]}>🏆 Leaderboard</Text>
      </View>

      {/* Main tabs */}
      <View style={[cs.mainTabRow, { borderBottomColor: colors.border }]}>
        {[['global', '🌍 Global'], ['friends', '👥 Friends']].map(([k, l]) => (
          <TouchableOpacity key={k} style={[cs.mainTab,
            mainTab === k && { borderBottomColor: colors.primary, borderBottomWidth: 2.5 }]}
            onPress={() => setMainTab(k)} activeOpacity={0.8}>
            <Text style={[cs.mainTabTxt, { color: mainTab === k ? colors.primary : colors.textMuted }]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={showSkeleton ? Array(9).fill(null) : currentList}
        keyExtractor={(item, i) => item ? keyExtractor(item, i) : `skel-${i}`}
        renderItem={showSkeleton
          ? () => <SkeletonCard colors={colors} />
          : renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
            tintColor={colors.primary} colors={[colors.primary]} />
        }
        ListHeaderComponent={
          <View style={cs.listHeader}>
            {/* Champion banner — Global only */}
            {mainTab === 'global' && champion && (
              <ChampionBanner champion={champion} colors={colors} />
            )}
            <SubTabs value={subTab} onChange={setSubTab} colors={colors} />
          </View>
        }
        ListEmptyComponent={
          !showSkeleton ? (
            <View style={cs.empty}>
              <Text style={cs.emptyEmoji}>{mainTab === 'friends' ? '👥' : '🏆'}</Text>
              <Text style={[cs.emptyTitle, { color: colors.textPrimary }]}>
                {mainTab === 'friends' ? 'Add friends to compare streaks' : 'No entries yet'}
              </Text>
              <Text style={[cs.emptySub, { color: colors.textMuted }]}>
                {mainTab === 'friends'
                  ? 'Go to the Friends tab and add someone!'
                  : 'Start logging habits to appear here 🔥'}
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={!showSkeleton && currentList.length > 0 ? <Footer colors={colors} /> : null}
        contentContainerStyle={cs.list}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={false}
        initialNumToRender={15}
      />
    </SafeAreaView>
  );
}

const cs = StyleSheet.create({
  safe:   { flex: 1 },
  navbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, borderBottomWidth: 1 },
  navBrand: { fontSize: 20, fontWeight: '800' },

  mainTabRow: { flexDirection: 'row', borderBottomWidth: 1 },
  mainTab:    { flex: 1, alignItems: 'center', paddingVertical: 13 },
  mainTabTxt: { fontSize: 14, fontWeight: '700' },

  listHeader: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },

  subRow: { flexDirection: 'row', borderRadius: 12, padding: 4, borderWidth: 1, marginBottom: 8 },
  subTab: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  subTxt: { fontSize: 13, fontWeight: '600' },

  list: { paddingHorizontal: 20, paddingBottom: 120, paddingTop: 4 },

  card: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 16, borderWidth: 1.5,
    paddingHorizontal: 10, paddingVertical: 11,
    marginBottom: 8, overflow: 'hidden', gap: 4,
  },
  accentBar:  { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  cardName:   { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  streakTxt:  { fontSize: 15, fontWeight: '800' },
  youBadge:   { paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 8 },
  youTxt:     { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  addBtn:     { borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 7,
                minWidth: 60, alignItems: 'center' },
  addBtnTxt:  { fontSize: 13, fontWeight: '700' },
  friendedBtn:{ width: 34, height: 34, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  footer: { textAlign: 'center', fontSize: 12, marginTop: 10, marginBottom: 8, lineHeight: 18 },

  empty:      { alignItems: 'center', marginTop: 60, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 14 },
  emptyTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  emptySub:   { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
