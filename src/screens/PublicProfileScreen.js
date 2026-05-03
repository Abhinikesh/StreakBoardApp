import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  StatusBar, Animated, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { getLevelIcon } from '../lib/xpLevels';
import api from '../lib/axios';
import { useTheme } from '../context/ThemeContext';
import { WEB_BASE } from '../config/api';

// ── Helpers ───────────────────────────────────────────────────────────────────
function getAvatarBg(name) {
  const p = ['#7c3aed','#10b981','#ef4444','#f59e0b','#3b82f6','#ec4899'];
  return p[(name?.charCodeAt(0) || 0) % p.length];
}

function getRingColor(streak) {
  if (!streak) return '#6B7280';
  if (streak < 7)  return '#3B82F6';
  if (streak < 30) return '#7C3AED';
  return '#F59E0B';
}

// Integer count-up hook
function useCountUp(target, active, ms = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) { setVal(0); return; }
    let raf, t0;
    const step = (ts) => {
      if (!t0) t0 = ts;
      const p = Math.min((ts - t0) / ms, 1);
      setVal(Math.round(p * (target || 0)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, active]);
  return val;
}

// Pulsing skeleton block
function Skel({ w = '100%', h = 18, r = 8, style }) {
  const a = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 0.7, duration: 650, useNativeDriver: true }),
      Animated.timing(a, { toValue: 0.35, duration: 650, useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <Animated.View style={[
      { width: w, height: h, borderRadius: r, backgroundColor: '#6B7280', opacity: a },
      style,
    ]} />
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PublicProfileScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { shareCode, userName, currentStreak: paramStreak } = route.params || {};

  const [profile,  setProfile]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [ready,    setReady]    = useState(false);
  const [toast,    setToast]    = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!shareCode) { setError('No share code provided.'); setLoading(false); return; }
    try {
      const res = await api.get(`/api/social/u/${shareCode}`);
      setProfile(res.data);
      setTimeout(() => setReady(true), 80);
    } catch (e) {
      setError(e.response?.status === 404
        ? "This profile is private or doesn't exist."
        : 'Could not load profile. Check your connection.');
    } finally { setLoading(false); }
  }, [shareCode]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  // Derived stats
  const p  = profile || {};
  const st = p.stats || {};
  const currentStreak  = paramStreak ?? p.currentStreak ?? st.currentStreak ?? 0;
  const bestStreak     = st.longestStreak ?? st.bestStreak ?? p.bestStreak ?? p.longestStreak ?? 0;
  const totalDone      = st.totalDone ?? st.done ?? p.totalDone ?? 0;
  const completionRate = Math.round(st.overallRate ?? st.completionRate ?? p.completionRate ?? 0);

  // Count-up values
  const cStreak = useCountUp(currentStreak,  ready);
  const cBest   = useCountUp(bestStreak,     ready);
  const cTotal  = useCountUp(totalDone,      ready);
  const cRate   = useCountUp(completionRate, ready);

  // Gold glow for streak 30+
  const goldGlow = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (currentStreak >= 30) {
      Animated.loop(Animated.sequence([
        Animated.timing(goldGlow, { toValue: 1.04, duration: 1100, easing: Easing.inOut(Easing.sine), useNativeDriver: true }),
        Animated.timing(goldGlow, { toValue: 0.97, duration: 1100, easing: Easing.inOut(Easing.sine), useNativeDriver: true }),
      ])).start();
    }
  }, [currentStreak]);

  const ringColor   = getRingColor(currentStreak);
  const avatarBg    = getAvatarBg(p.name);
  const memberSince = p.createdAt
    ? new Date(p.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : null;

  const shareProfile = async () => {
    await Clipboard.setStringAsync(`${WEB_BASE}/u/${shareCode}`);
    setToast(true);
    setTimeout(() => setToast(false), 2600);
  };

  const AvatarInner = () => p.avatar
    ? <Image source={{ uri: p.avatar }} style={{ width: 96, height: 96, borderRadius: 48 }} />
    : <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: avatarBg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 38, fontWeight: '700' }}>{(p.name || '?')[0].toUpperCase()}</Text>
      </View>;

  // ── Error screen ──────────────────────────────────────────────────────────────
  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
        <StatusBar barStyle="light-content" />
        <TouchableOpacity onPress={() => navigation.goBack()}
          style={{ margin: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.primary, fontSize: 20, fontWeight: '700' }}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>🔒</Text>
          <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '700', marginBottom: 8 }}>Profile Unavailable</Text>
          <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 }}>{error}</Text>
          <TouchableOpacity onPress={fetchProfile}
            style={{ marginTop: 20, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28 }}>
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#3b0764" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>

        {/* ── Gradient banner (purple→blue simulation) ── */}
        <View style={{ height: 148, backgroundColor: '#3b0764', overflow: 'hidden' }}>
          <View style={{ position: 'absolute', right: 0, top: 0, width: '55%', height: '100%', backgroundColor: 'rgba(59,130,246,0.38)' }} />
          <View style={{ position: 'absolute', top: -40, right: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(139,92,246,0.3)' }} />
          <View style={{ position: 'absolute', bottom: -25, left: -25, width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(59,130,246,0.22)' }} />
          {/* Back button over banner */}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{ position: 'absolute', top: 14, left: 16, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.32)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>←</Text>
          </TouchableOpacity>
        </View>

        {/* ── Avatar overlapping banner ── */}
        <View style={{ alignItems: 'center', marginTop: -52 }}>
          {loading ? (
            <Skel w={104} h={104} r={52} />
          ) : currentStreak >= 30 ? (
            <Animated.View style={{
              borderRadius: 56, borderWidth: 4, borderColor: '#F59E0B',
              shadowColor: '#F59E0B', shadowOpacity: 0.7, shadowRadius: 14, elevation: 12,
              transform: [{ scale: goldGlow }],
            }}>
              <AvatarInner />
            </Animated.View>
          ) : (
            <View style={{ borderRadius: 56, borderWidth: 4, borderColor: ringColor,
              shadowColor: ringColor, shadowOpacity: 0.55, shadowRadius: 10, elevation: 8 }}>
              <AvatarInner />
            </View>
          )}

          {/* Name / member since */}
          <View style={{ alignItems: 'center', marginTop: 12, paddingHorizontal: 24 }}>
            {loading ? (
              <>
                <Skel w={150} h={24} r={8} style={{ marginBottom: 8 }} />
                <Skel w={110} h={14} r={6} />
              </>
            ) : (
              <>
                <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '800', textAlign: 'center' }}>
                  {p.name || userName || 'StreakBoard User'}
                </Text>
                {memberSince && (
                  <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>Member since {memberSince}</Text>
                )}
                {shareCode && (
                  <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, marginTop: 10 }}>
                    <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '500' }}>#{shareCode}</Text>
                  </View>
                )}
                {/* Level badge */}
                {p.currentLevel && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#7c3aed22', borderWidth: 1, borderColor: '#7c3aed44', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, marginTop: 10, gap: 6 }}>
                    <Text style={{ fontSize: 16 }}>{getLevelIcon(p.currentLevel)}</Text>
                    <Text style={{ color: '#a78bfa', fontSize: 12, fontWeight: '700' }}>Lv.{p.currentLevel} {p.levelName}</Text>
                  </View>
                )}
              </>
            )}
          </View>
        </View>

        {/* ── Stats cards ── */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, marginTop: 22, gap: 10 }}>
          {loading
            ? [0,1,2,3].map((i) => (
                <View key={i} style={{ width: '47%', backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, alignItems: 'center' }}>
                  <Skel w={36} h={36} r={18} style={{ marginBottom: 10 }} />
                  <Skel w={54} h={28} r={6} style={{ marginBottom: 8 }} />
                  <Skel w={82} h={12} r={4} />
                </View>
              ))
            : (
              [
                { icon: '🔥', label: 'Current Streak', val: cStreak, suf: ' days' },
                { icon: '⭐', label: 'Best Streak',    val: cBest,   suf: ' days' },
                { icon: '✅', label: 'Total Done',     val: cTotal,  suf: ''      },
                { icon: '📊', label: 'Completion',     val: cRate,   suf: '%'     },
              ].map((stat) => (
                <View key={stat.label} style={{
                  width: '47%', backgroundColor: colors.card, borderRadius: 16,
                  borderWidth: 1, borderColor: colors.border, padding: 16, alignItems: 'center',
                  shadowColor: colors.primary, shadowOpacity: 0.09, shadowRadius: 8, elevation: 3,
                }}>
                  <Text style={{ fontSize: 28, marginBottom: 6 }}>{stat.icon}</Text>
                  <Text style={{ color: colors.primary, fontSize: 28, fontWeight: '900', letterSpacing: -0.5 }}>
                    {stat.val}{stat.suf}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4, fontWeight: '600', textAlign: 'center' }}>
                    {stat.label}
                  </Text>
                </View>
              ))
            )
          }
        </View>

        {/* ── Active habits ── */}
        <View style={{ marginHorizontal: 16, marginTop: 10 }}>
          {loading ? (
            <View style={{ backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16 }}>
              <Skel w={130} h={18} r={6} style={{ marginBottom: 16 }} />
              {[0,1,2].map((i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                  <Skel w={38} h={38} r={10} style={{ marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Skel w="65%" h={14} r={5} style={{ marginBottom: 8 }} />
                    <Skel w="100%" h={6} r={3} />
                  </View>
                </View>
              ))}
            </View>
          ) : Array.isArray(p.habits) && p.habits.length > 0 ? (
            <View style={{ backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 14 }}>
                Active Habits ({p.habits.length})
              </Text>
              {p.habits.map((habit, i) => {
                const rate = Math.min(Math.max(habit.completionRate ?? habit.weekRate ?? 0, 0), 100);
                return (
                  <View key={habit._id || i} style={{ marginBottom: i < p.habits.length - 1 ? 16 : 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 7 }}>
                      <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                        <Text style={{ fontSize: 20 }}>{habit.icon || '🎯'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
                          {habit.name}
                        </Text>
                        <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 1 }}>
                          {habit.currentStreak != null ? `🔥 ${habit.currentStreak} day streak` : `${habit.trackingPeriod ?? 30}-day goal`}
                        </Text>
                      </View>
                      {habit.todayStatus === 'done' && (
                        <View style={{ backgroundColor: '#22C55E22', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 }}>
                          <Text style={{ color: '#22C55E', fontSize: 13, fontWeight: '700' }}>✓</Text>
                        </View>
                      )}
                    </View>
                    {/* 7-day progress bar */}
                    <View style={{ height: 5, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' }}>
                      <View style={{ height: 5, width: `${rate}%`, backgroundColor: colors.primary, borderRadius: 3 }} />
                    </View>
                    <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 3 }}>{rate}% completion rate</Text>
                  </View>
                );
              })}
            </View>
          ) : !loading && (
            <View style={{ backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 6 }}>Habit Stats</Text>
              <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 10 }}>
                {`${st.totalHabits ?? 0} habit${(st.totalHabits ?? 0) !== 1 ? 's' : ''} tracked  ·  ${st.activeDays ?? 0} active day${(st.activeDays ?? 0) !== 1 ? 's' : ''}`}
              </Text>
            </View>
          )}
        </View>

        {/* ── Share button ── */}
        {!loading && shareCode && (
          <TouchableOpacity
            onPress={shareProfile}
            activeOpacity={0.78}
            style={{
              marginHorizontal: 16, marginTop: 14,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              borderWidth: 1.5, borderColor: colors.primary, borderRadius: 14,
              paddingVertical: 14, backgroundColor: colors.card,
            }}>
            <Text style={{ color: colors.primary, fontSize: 15, fontWeight: '700' }}>Share Profile 🔗</Text>
          </TouchableOpacity>
        )}

        {/* ── Footer watermark ── */}
        <View style={{ alignItems: 'center', marginTop: 24 }}>
          <Text style={{ color: colors.textMuted, fontSize: 11 }}>🔥 StreakBoard · Track what you do. Not what you plan.</Text>
        </View>
      </ScrollView>

      {/* ── Clipboard toast ── */}
      {toast && (
        <View style={{
          position: 'absolute', bottom: 36, left: 20, right: 20,
          backgroundColor: '#111827', borderRadius: 14,
          paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center',
          shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 14, elevation: 12,
        }}>
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>✅ Profile link copied!</Text>
        </View>
      )}
    </SafeAreaView>
  );
}
