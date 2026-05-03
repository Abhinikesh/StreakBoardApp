import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, ScrollView, FlatList, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Image, Animated, Easing,
  StatusBar, RefreshControl, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../lib/axios';
import { useTheme } from '../context/ThemeContext';
import { getComebackStatus } from '../lib/comeback';

// ── Snapshot helpers for "Most Improved" ─────────────────────────────────────
const SNAP_KEY = 'lb_streak_snapshots_v1';
async function saveSnapshot(entries) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const raw = await AsyncStorage.getItem(SNAP_KEY);
    const snaps = raw ? JSON.parse(raw) : {};
    if (snaps[today]) return snaps; // already saved today
    snaps[today] = {};
    for (const e of entries) {
      const id = e._id || e.id;
      if (id) snaps[today][id] = e.currentStreak;
    }
    // Keep only last 14 days
    const keys = Object.keys(snaps).sort();
    if (keys.length > 14) keys.slice(0, keys.length - 14).forEach(k => delete snaps[k]);
    await AsyncStorage.setItem(SNAP_KEY, JSON.stringify(snaps));
    return snaps;
  } catch (_) { return {}; }
}
async function loadSnapshots() {
  try { const r = await AsyncStorage.getItem(SNAP_KEY); return r ? JSON.parse(r) : {}; }
  catch (_) { return {}; }
}
function calcMostImproved(entries, snaps) {
  const today = new Date();
  let old = null;
  for (let i = 7; i >= 4; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const k = d.toISOString().split('T')[0];
    if (snaps[k]) { old = snaps[k]; break; }
  }
  if (!old) return null;
  let best = null;
  for (const e of entries) {
    const id = e._id || e.id; if (!id) continue;
    const prev = old[id]; if (prev === undefined) continue;
    const gain = e.currentStreak - prev;
    if (gain <= 0) continue;
    if (!best || gain > best.gain || (gain === best.gain && e.currentStreak > best.entry.currentStreak))
      best = { entry: e, gain };
  }
  return best;
}

// ── Podium visual constants ───────────────────────────────────────────────────
// 2-tone gradient simulation: [base, highlight overlay colour]
const PODIUM_GRAD = [
  { base: '#B8860B', top: 'rgba(255,220,60,0.35)'  }, // gold
  { base: '#708090', top: 'rgba(255,255,255,0.20)'  }, // silver
  { base: '#8B4513', top: 'rgba(220,160,80,0.25)'  }, // bronze
];
const SPARKLE_POS = [
  { x: -32, y: -28 }, { x: 32, y: -28 }, { x: -18, y: -46 }, { x: 18, y: -46 }, { x: 0, y: -50 },
];

const MEDAL       = ['🥇', '🥈', '🥉'];
const MEDAL_COLOR = ['#FFD700', '#C0C0C0', '#CD7F32'];
const PODIUM_H    = [90, 60, 50];

// A user is considered "inactive" when their current streak is 0
const isInactive = (entry) => (entry?.currentStreak ?? 0) === 0;

// ── Rank badge helper ─────────────────────────────────────────────────────────
function RankBadge({ rank, colors }) {
  if (rank <= 3) return null; // podium ranks not shown in list
  if (rank <= 10) return (
    <View style={{
      backgroundColor: colors.primary, borderRadius: 8,
      paddingHorizontal: 7, paddingVertical: 3, minWidth: 34, alignItems: 'center',
    }}>
      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>#{rank}</Text>
    </View>
  );
  if (rank <= 25) return (
    <View style={{
      backgroundColor: colors.border, borderRadius: 8,
      paddingHorizontal: 7, paddingVertical: 3, minWidth: 34, alignItems: 'center',
    }}>
      <Text style={{ color: colors.textPrimary, fontSize: 11, fontWeight: '700' }}>#{rank}</Text>
    </View>
  );
  return (
    <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '500', minWidth: 34, textAlign: 'center' }}>
      #{rank}
    </Text>
  );
}

// ── Active dot indicator ──────────────────────────────────────────────────────
function ActiveDot({ active }) {
  return (
    <View style={{
      width: 10, height: 10, borderRadius: 5,
      backgroundColor: active ? '#22C55E' : '#6B7280',
      position: 'absolute', bottom: 1, right: 1,
      borderWidth: 1.5, borderColor: '#fff',
    }} />
  );
}

// ── Memoized list row (avoids re-render on parent scroll) ─────────────────────
const LeaderboardRow = memo(function LeaderboardRow({
  entry, rank, globalIdx, me, inactive, filter, tab,
  comebackActive, colors, onPress,
}) {
  const pressAnim = useRef(new Animated.Value(1)).current;

  const onPressIn = () => Animated.timing(pressAnim, {
    toValue: 0.97, duration: 80, useNativeDriver: true,
  }).start();
  const onPressOut = () => Animated.timing(pressAnim, {
    toValue: 1, duration: 120, useNativeDriver: true,
  }).start();

  const isActive = !inactive;

  // Value display
  let valText, valColor;
  if (tab === 'streak') {
    if (isActive) {
      valText = `${entry.currentStreak} 🔥`;
      valColor = '#22C55E';
    } else {
      valText = `0 💤`;
      valColor = colors.textMuted;
    }
  } else if (tab === 'rate') {
    valText = `${Math.round(entry.completionRate ?? 0)}%`;
    valColor = '#f59e0b';
  } else {
    valText = `${entry.totalDone ?? 0} ✅`;
    valColor = '#22C55E';
  }
  if (inactive && filter === 'all') valColor = colors.textMuted;

  // Row left-border accent
  const borderColor = inactive
    ? colors.border
    : globalIdx < 3 ? MEDAL_COLOR[globalIdx]
    : rank <= 10 ? colors.primary
    : colors.border;

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View style={[
        {
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: me ? colors.primary + '1a' : colors.card,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: me ? colors.primary + '55' : colors.border,
          borderLeftWidth: 4, borderLeftColor: borderColor,
          paddingHorizontal: 12, paddingVertical: 11, marginBottom: 8,
          opacity: inactive && filter === 'all' ? 0.62 : 1,
        },
        { transform: [{ scale: pressAnim }] },
      ]}>
        {/* Rank badge */}
        <View style={{ width: 38, alignItems: 'center' }}>
          {globalIdx < 3
            ? <Text style={{ fontSize: 18 }}>{MEDAL[globalIdx]}</Text>
            : <RankBadge rank={rank} colors={colors} />}
        </View>

        {/* Avatar + active dot */}
        <View style={{ marginHorizontal: 10, position: 'relative' }}>
          {renderAvatar(entry, 42, me ? colors.primary : null, inactive && filter === 'all')}
          <ActiveDot active={isActive} />
        </View>

        {/* Name + badges */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text
              style={[
                { color: colors.textPrimary, fontSize: 14, fontWeight: '600', flexShrink: 1 },
                me && { color: colors.primary },
                inactive && filter === 'all' && { color: colors.textMuted },
              ]}
              numberOfLines={1}
            >
              {entry.name || 'User'}
            </Text>
            {/* Level badge */}
            {entry.currentLevel > 0 && (
              <View style={{ backgroundColor: '#7c3aed22', borderWidth: 1, borderColor: '#7c3aed44', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                <Text style={{ color: '#a78bfa', fontSize: 10, fontWeight: '700' }}>Lv.{entry.currentLevel}</Text>
              </View>
            )}
            {me && (
              <View style={{ backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>You</Text>
              </View>
            )}
            {inactive && filter === 'all' && !me && (
              <View style={{ backgroundColor: colors.border, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 }}>
                <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '600' }}>Inactive</Text>
              </View>
            )}
          </View>
          {entry.email ? (
            <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 1 }} numberOfLines={1}>
              {entry.email}
            </Text>
          ) : null}
        </View>

        {/* Value + comeback badge */}
        <View style={{ alignItems: 'flex-end', minWidth: 64 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: valColor }}>
            {valText}
          </Text>
          {me && comebackActive && (
            <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '700', marginTop: 3 }}>
              🔄 Comeback
            </Text>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
});


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

// ── Podium card component (animated) ─────────────────────────────────────────
function PodiumCard({ user, rankIdx, onPress, colors, entranceAnim, glowAnim, fireAnim, crownAnim, sparkleAnims }) {
  const rank       = rankIdx + 1;
  const avatarSize = rank === 1 ? 72 : 60;
  const cardFlex   = rank === 1 ? 1.2 : 1;
  const isFirst    = rank === 1;
  const grad       = PODIUM_GRAD[rankIdx];

  // Guard: entranceAnim may be undefined if not passed by caller
  const cardStyle = entranceAnim ? {
    opacity:   entranceAnim,
    transform: [{ translateY: entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [80, 0] }) }],
  } : {};

  // #1 crown bounce
  const crownStyle = isFirst && crownAnim ? {
    transform: [{ translateY: crownAnim }],
  } : {};

  // #1 glow ring (Animated.View behind avatar)
  const glowRingStyle = isFirst && glowAnim ? {
    position: 'absolute',
    width: avatarSize + 20, height: avatarSize + 20,
    borderRadius: (avatarSize + 20) / 2,
    top: -10, left: -10,
    backgroundColor: '#FFD700',
    opacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.55] }),
    transform: [{ scale: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1.08] }) }],
  } : null;

  // #1 fire scale
  const fireStyle = isFirst && fireAnim ? {
    transform: [{ scale: fireAnim }],
  } : {};

  return (
    <Animated.View style={[{ alignItems: 'center', flex: cardFlex, paddingHorizontal: 4 }, cardStyle]}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={{ alignItems: 'center' }}>

        {/* Crown / medal — bounces for #1 */}
        <Animated.Text style={[{ fontSize: 22, marginBottom: 6 }, crownStyle]}>
          {MEDAL[rankIdx]}
        </Animated.Text>

        {/* Avatar container — sparkles + glow ring only for #1 */}
        <View style={{ position: 'relative', marginBottom: 8 }}>
          {/* Glow ring */}
          {glowRingStyle && <Animated.View style={glowRingStyle} />}

          {/* Sparkle particles — rendered only for #1 */}
          {isFirst && sparkleAnims && SPARKLE_POS.map((pos, pi) => (
            <Animated.Text
              key={pi}
              style={{
                position: 'absolute',
                left: avatarSize / 2 + pos.x - 8,
                top: avatarSize / 2 + pos.y - 8,
                fontSize: 14,
                opacity: sparkleAnims[pi].opacity,
                transform: [
                  { scale: sparkleAnims[pi].scale },
                  { translateX: sparkleAnims[pi].tx },
                  { translateY: sparkleAnims[pi].ty },
                ],
                zIndex: 10,
              }}
            >✨</Animated.Text>
          ))}

          {/* Shadow shell */}
          <View style={{
            shadowColor: MEDAL_COLOR[rankIdx], shadowOpacity: 0.7,
            shadowRadius: 10, elevation: 8,
            borderRadius: avatarSize / 2,
          }}>
            {renderAvatar(user, avatarSize, MEDAL_COLOR[rankIdx])}
          </View>
        </View>

        <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 12,
                       textAlign: 'center', maxWidth: 90, marginBottom: 2 }}
              numberOfLines={1}>
          {user?.name || '—'}
        </Text>

        {/* Streak row — fire flickers for #1 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ color: MEDAL_COLOR[rankIdx], fontWeight: '800', fontSize: 15 }}>
            {user?.currentStreak ?? 0}{' '}
          </Text>
          <Animated.Text style={[{ fontSize: 15 }, fireStyle]}>🔥</Animated.Text>
        </View>

        {/* Podium block — 2-tone gradient simulation */}
        <View style={{
          width: rank === 1 ? 80 : 66, height: PODIUM_H[rankIdx],
          backgroundColor: grad.base,
          borderTopLeftRadius: 8, borderTopRightRadius: 8, overflow: 'hidden',
        }}>
          {/* Lighter top band for gradient look */}
          <View style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '45%',
            backgroundColor: grad.top,
            borderTopLeftRadius: 8, borderTopRightRadius: 8,
          }} />
          {/* Rank label inside block */}
          <Text style={{ color: 'rgba(255,255,255,0.9)', fontWeight: '800', fontSize: 13,
                         textAlign: 'center', marginTop: 6 }}>
            #{rank}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
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
  const [filter,     setFilter]     = useState('active');
  const [mostImproved, setMostImproved] = useState(null); // { entry, gain }
  const [comebackStatus, setComebackStatus] = useState({ active: false, daysIn: 0 });
  // ── Season state ─────────────────────────────────────────────────────────
  const [viewMode,       setViewMode]       = useState('season');   // 'season' | 'alltime'
  const [currentSeason,  setCurrentSeason]  = useState(null);
  const [seasonEntries,  setSeasonEntries]  = useState([]);
  const [mySeasonRank,   setMySeasonRank]   = useState(null);

  // ── Animation refs ─────────────────────────────────────────────────────
  // podiumEntr[0]=3rd, [1]=1st, [2]=2nd (stagger order per spec)
  const podiumEntr = useRef([0,1,2].map(() => new Animated.Value(0))).current;
  const glowAnim   = useRef(new Animated.Value(0)).current;
  const fireAnim   = useRef(new Animated.Value(1)).current;
  const crownAnim  = useRef(new Animated.Value(0)).current;
  const arrowAnim  = useRef(new Animated.Value(0)).current;
  // Sparkle: each has opacity, scale, tx, ty
  const sparkles   = useRef(SPARKLE_POS.map(() => ({
    opacity: new Animated.Value(0),
    scale:   new Animated.Value(0),
    tx:      new Animated.Value(0),
    ty:      new Animated.Value(0),
  }))).current;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [lbRes, meRes, seasonRes, seasonLbRes, myRankRes] = await Promise.all([
        api.get('/api/social/leaderboard'),
        api.get('/api/user/profile'),
        api.get('/api/seasons/current').catch(() => ({ data: null })),
        api.get('/api/seasons/leaderboard').catch(() => ({ data: [] })),
        api.get('/api/seasons/my-rank').catch(() => ({ data: null })),
      ]);
      const raw = Array.isArray(lbRes.data) ? lbRes.data : [];
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
      if (seasonRes.data)  setCurrentSeason(seasonRes.data);
      setSeasonEntries(Array.isArray(seasonLbRes.data) ? seasonLbRes.data : []);
      if (myRankRes.data)  setMySeasonRank(myRankRes.data);
    } catch (err) {
      console.error('[Leaderboard] fetchAll error:', err.message);
      setEntries([]);
      setSeasonEntries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // ── Snapshot + Most Improved: load old snap, save today's, compute winner ─
  useEffect(() => {
    if (!entries.length) return;
    (async () => {
      const snaps = await loadSnapshots();
      const mi = calcMostImproved(entries, snaps);
      setMostImproved(mi);
      await saveSnapshot(entries); // idempotent (once per day)
    })();
  }, [entries]);

  // ── Load comeback status for current user's badge ───────────────────────
  useFocusEffect(useCallback(() => {
    getComebackStatus().then(setComebackStatus).catch(() => {});
  }, []));

  // ── Podium entrance: staggered spring (3rd → 1st → 2nd) ────────────────────
  useEffect(() => {
    if (loading) { podiumEntr.forEach(a => a.setValue(0)); return; }
    Animated.stagger(200, podiumEntr.map(a =>
      Animated.spring(a, { toValue: 1, tension: 55, friction: 8, useNativeDriver: true })
    )).start();
  }, [loading]);

  // ── Sparkle particles: one-shot burst on load, no loop ─────────────────
  useEffect(() => {
    if (loading) return;
    const anims = sparkles.map((sp, i) =>
      Animated.sequence([
        Animated.delay(300 + i * 80),
        Animated.parallel([
          Animated.timing(sp.opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.timing(sp.scale,   { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.timing(sp.tx, { toValue: SPARKLE_POS[i].x * 0.4, duration: 400, useNativeDriver: true }),
          Animated.timing(sp.ty, { toValue: SPARKLE_POS[i].y * 0.4, duration: 400, useNativeDriver: true }),
        ]),
        Animated.timing(sp.opacity, { toValue: 0, duration: 600, delay: 600, useNativeDriver: true }),
      ])
    );
    Animated.parallel(anims).start();
  }, [loading]);

  // ── Continuous loops: glow, fire, crown, arrow ─────────────────────────
  useEffect(() => {
    const glow = Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.sine), useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.sine), useNativeDriver: true }),
    ]));
    const fire = Animated.loop(Animated.sequence([
      Animated.timing(fireAnim, { toValue: 1.18, duration: 400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(fireAnim, { toValue: 1.0,  duration: 400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    const crown = Animated.loop(Animated.sequence([
      Animated.timing(crownAnim, { toValue: -6, duration: 900, easing: Easing.inOut(Easing.sine), useNativeDriver: true }),
      Animated.timing(crownAnim, { toValue: 0,  duration: 900, easing: Easing.inOut(Easing.sine), useNativeDriver: true }),
    ]));
    const arrow = Animated.loop(Animated.sequence([
      Animated.timing(arrowAnim, { toValue: -5, duration: 400, useNativeDriver: true }),
      Animated.timing(arrowAnim, { toValue: 0,  duration: 400, useNativeDriver: true }),
    ]));
    glow.start(); fire.start(); crown.start(); arrow.start();
    return () => { glow.stop(); fire.stop(); crown.stop(); arrow.stop(); };
  }, []);

  useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));

  const onRefresh = useCallback(() => {
    setRefreshing(true); fetchAll();
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

  // Build flat list items (rows + inline dividers) for FlatList
  const listData = (() => {
    const base = search.trim()
      ? visibleSorted.filter((e) => (e.name || '').toLowerCase().includes(search.toLowerCase()))
      : visibleSorted.slice(3);
    if (!search.trim() && filter === 'all') {
      const items = [];
      let sepAdded = false;
      base.forEach((e) => {
        if (!sepAdded && isInactive(e)) {
          sepAdded = true;
          items.push({ type: 'divider', key: 'inactive-sep' });
        }
        items.push({ type: 'row', entry: e });
      });
      return items;
    }
    return base.map((e) => ({ type: 'row', entry: e }));
  })();

  const renderListItem = useCallback(({ item }) => {
    try {
      if (!item) return null;
      if (item.type === 'divider') {
        return (
          <View style={s.inactiveSep}>
            <View style={s.inactiveSepLine} />
            <Text style={s.inactiveSepTxt}>— Currently Inactive —</Text>
            <View style={s.inactiveSepLine} />
          </View>
        );
      }
      const entry = item.entry;
      if (!entry) return null;
      const id        = entry._id || entry.id;
      const globalIdx = visibleSorted.findIndex((e) => (e._id || e.id) === id);
      const rank      = globalIdx + 1;
      return (
        <LeaderboardRow
          entry={entry}
          rank={rank}
          globalIdx={globalIdx}
          me={isMe(entry)}
          inactive={isInactive(entry)}
          filter={filter}
          tab={tab}
          comebackActive={comebackStatus?.active ?? false}
          colors={colors}
          onPress={() => navigateToProfile(entry)}
        />
      );
    } catch (e) {
      console.error('[renderListItem] error:', e.message);
      return null;
    }
  }, [visibleSorted, filter, tab, comebackStatus, colors, myId]);

  const keyExtractor = useCallback((item) =>
    item.type === 'divider' ? 'inactive-sep' : (item.entry?._id || item.entry?.id || 'unknown'),
  []);


  const isMe = (entry) => entry?._id === myId || entry?.id === myId;

  const navigateToProfile = useCallback((user) => {
    if (!user) return;
    const id = user._id || user.id;
    if (!id) {
      console.warn('[LB] navigateToProfile: user has no id', user);
      return;
    }
    try {
      navigation.navigate('PublicProfile', {
        shareCode:     user.shareCode   ?? null,
        userName:      user.name        ?? 'User',
        userId:        id,
        currentStreak: user.currentStreak ?? 0,
      });
    } catch (err) {
      console.warn('[LB] navigation.navigate failed', err);
    }
  }, [navigation]);

  // Podium uses top-3 of the visible set
  const podiumEntries = visibleSorted.slice(0, 3);

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

      {/* ── Season / All Time view switcher ── */}
      <View style={s.viewSwitcher}>
        <TouchableOpacity
          style={[s.viewTab, viewMode === 'season'  && s.viewTabActive]}
          onPress={() => setViewMode('season')}
          activeOpacity={0.8}
        >
          <Text style={[s.viewTabTxt, viewMode === 'season'  && s.viewTabTxtActive]}>🌟 This Season</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.viewTab, viewMode === 'alltime' && s.viewTabActive]}
          onPress={() => setViewMode('alltime')}
          activeOpacity={0.8}
        >
          <Text style={[s.viewTabTxt, viewMode === 'alltime' && s.viewTabTxtActive]}>🏆 All Time</Text>
        </TouchableOpacity>
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
        {/* ───────────────────────────────────────── */}
        {/* SEASON VIEW */}
        {viewMode === 'season' && (
          <>
            {/* Season banner */}
            <TouchableOpacity
              onPress={() => navigation.navigate('SeasonDetail', { season: currentSeason })}
              activeOpacity={0.85}
              style={[s.seasonBanner, { backgroundColor: colors.primary + '14', borderColor: colors.primary + '44' }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[s.seasonBannerTitle, { color: colors.primary }]}>
                  🌟 {currentSeason?.name ?? 'Current Season'}
                </Text>
                {currentSeason?.daysRemaining != null && (
                  <Text style={[s.seasonBannerSub, { color: colors.textMuted }]}>
                    {currentSeason.daysRemaining} day{currentSeason.daysRemaining !== 1 ? 's' : ''} remaining · Tap for details
                  </Text>
                )}
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 20 }}>›</Text>
            </TouchableOpacity>

            {/* My rank card */}
            {mySeasonRank?.rank && (
              <View style={[s.myRankCard, { backgroundColor: colors.primary + '11', borderColor: colors.primary + '33' }]}>
                <Text style={[s.myRankNum, { color: colors.primary }]}>#{mySeasonRank.rank}</Text>
                <View style={{ marginLeft: 14 }}>
                  <Text style={[s.myRankLabel, { color: colors.textPrimary }]}>Your rank this season</Text>
                  <Text style={[s.myRankStreak, { color: colors.textMuted }]}>{mySeasonRank.bestStreak} 🔥 best streak</Text>
                </View>
              </View>
            )}

            {/* Season leaderboard list */}
            {seasonEntries.length === 0 ? (
              <View style={s.empty}>
                <Text style={{ fontSize: 48, textAlign: 'center', marginTop: 40 }}>🌟</Text>
                <Text style={s.emptyTitle}>Season just started!</Text>
                <Text style={s.emptySub}>Log your habits to claim the top spot.</Text>
              </View>
            ) : (
              seasonEntries.map((entry, i) => {
                const MEDALS = ['🥇', '🥈', '🥉'];
                const isMyEntry = entry._id === myId;
                return (
                  <TouchableOpacity
                    key={entry._id || i}
                    style={[s.seasonRow, {
                      backgroundColor: isMyEntry ? colors.primary + '12' : colors.card,
                      borderColor:     isMyEntry ? colors.primary + '55' : colors.border,
                    }]}
                    onPress={() => navigateToProfile(entry)}
                    activeOpacity={0.82}
                  >
                    <Text style={s.seasonRowRank}>{i < 3 ? MEDALS[i] : `#${i + 1}`}</Text>
                    {renderAvatar(entry, 40, isMyEntry ? colors.primary : null, false)}
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={[s.seasonRowName, { color: isMyEntry ? colors.primary : colors.textPrimary }]} numberOfLines={1}>
                        {entry.name}
                      </Text>
                      <Text style={[s.seasonRowSub, { color: colors.textMuted }]}>Lv.{entry.currentLevel || 1}</Text>
                    </View>
                    <View style={[s.streakBadge, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '33' }]}>
                      <Text style={[s.streakBadgeTxt, { color: colors.primary }]}>{entry.bestStreak} 🔥</Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </>
        )}

        {/* ───────────────────────────────────────── */}
        {/* ALL TIME VIEW */}
        {viewMode === 'alltime' && (
          <>
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
                {/* Order: 2nd, 1st, 3rd — pass animation refs so PodiumCard doesn't crash */}
                <PodiumCard
                  user={podiumEntries[1]} rankIdx={1}
                  onPress={() => navigateToProfile(podiumEntries[1])}
                  colors={colors}
                  entranceAnim={podiumEntr[0]}
                />
                <PodiumCard
                  user={podiumEntries[0]} rankIdx={0}
                  onPress={() => navigateToProfile(podiumEntries[0])}
                  colors={colors}
                  entranceAnim={podiumEntr[1]}
                  glowAnim={glowAnim}
                  fireAnim={fireAnim}
                  crownAnim={crownAnim}
                  sparkleAnims={sparkles}
                />
                <PodiumCard
                  user={podiumEntries[2]} rankIdx={2}
                  onPress={() => navigateToProfile(podiumEntries[2])}
                  colors={colors}
                  entranceAnim={podiumEntr[2]}
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

            {/* ── Search no-match state ── */}
            {listData.length === 0 && search.trim() && (
              <View style={s.empty}>
                <Text style={{ fontSize: 36, textAlign: 'center', marginBottom: 10 }}>🔍</Text>
                <Text style={s.emptySub}>No users match "{search}"</Text>
              </View>
            )}
            <FlatList
              data={listData}
              renderItem={renderListItem}
              keyExtractor={keyExtractor}
              scrollEnabled={false}
              removeClippedSubviews={false}
              initialNumToRender={15}
              maxToRenderPerBatch={10}
              windowSize={5}
              ListEmptyComponent={null}
            />

          </>
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
  comebackRowBadge: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 3,
  },

  // ── Season / All Time view switcher ────────────────────────────────────────────
  viewSwitcher:  { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 0,
                   borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 16 },
  viewTab:       { flex: 1, alignItems: 'center', paddingVertical: 12 },
  viewTabActive: { borderBottomWidth: 2.5, borderBottomColor: colors.primary },
  viewTabTxt:    { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  viewTabTxtActive: { color: colors.primary },

  // ── Season banner ─────────────────────────────────────────────────────
  seasonBanner:      { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1,
                       paddingHorizontal: 16, paddingVertical: 14, marginBottom: 12 },
  seasonBannerTitle: { fontSize: 15, fontWeight: '800' },
  seasonBannerSub:   { fontSize: 12, marginTop: 3 },

  // My rank card
  myRankCard:   { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1,
                  paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12 },
  myRankNum:    { fontSize: 28, fontWeight: '900', minWidth: 52 },
  myRankLabel:  { fontSize: 14, fontWeight: '700' },
  myRankStreak: { fontSize: 12, marginTop: 2 },

  // Season rows
  seasonRow:     { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1,
                   paddingHorizontal: 12, paddingVertical: 11, marginBottom: 8 },
  seasonRowRank: { fontSize: 20, width: 34, textAlign: 'center' },
  seasonRowName: { fontSize: 14, fontWeight: '700' },
  seasonRowSub:  { fontSize: 11, marginTop: 2 },
  streakBadge:   { borderRadius: 12, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  streakBadgeTxt:{ fontSize: 13, fontWeight: '800' },
});
