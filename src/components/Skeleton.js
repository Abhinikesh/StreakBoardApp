/**
 * src/components/Skeleton.js
 *
 * Animated shimmer placeholder shown while network data is loading.
 * Rule: NEVER show "0" values or blank screens while real data is loading.
 *
 * Usage:
 *   import { Skeleton, HabitCardSkeleton, StatCardSkeleton } from '../components/Skeleton';
 *   {loading && <HabitCardSkeleton />}
 */
import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';

// ── Base shimmer bar ──────────────────────────────────────────────────────────
export function Skeleton({ width = '100%', height = 16, borderRadius = 8, style }) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue:  0.9,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue:  0.4,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: '#6B7280', opacity },
        style,
      ]}
    />
  );
}

// ── Habit row skeleton (matches habit card layout) ────────────────────────────
export function HabitCardSkeleton() {
  return (
    <View style={s.habitCard}>
      {/* Icon circle */}
      <Skeleton width={44} height={44} borderRadius={22} />
      {/* Text block */}
      <View style={s.habitTextBlock}>
        <Skeleton width="65%" height={14} borderRadius={6} />
        <View style={{ height: 6 }} />
        <Skeleton width="42%" height={11} borderRadius={6} />
      </View>
      {/* Action button */}
      <Skeleton width={52} height={32} borderRadius={8} />
    </View>
  );
}

// ── Stat card skeleton (matches the XP / streak card) ─────────────────────────
export function StatCardSkeleton() {
  return (
    <View style={s.statCard}>
      <Skeleton width={40} height={11} borderRadius={6} />
      <View style={{ height: 8 }} />
      <Skeleton width={64} height={28} borderRadius={6} />
    </View>
  );
}

// ── Full-page skeleton for dashboard loading state ────────────────────────────
export function DashboardSkeleton() {
  return (
    <View style={s.dashWrapper}>
      {/* Greeting row */}
      <View style={s.greetingRow}>
        <View>
          <Skeleton width={120} height={14} borderRadius={6} />
          <View style={{ height: 8 }} />
          <Skeleton width={180} height={22} borderRadius={6} />
        </View>
        <Skeleton width={44} height={44} borderRadius={22} />
      </View>

      {/* Stat chips */}
      <View style={s.statRow}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={s.statChip}>
            <Skeleton width={36} height={11} borderRadius={4} />
            <View style={{ height: 6 }} />
            <Skeleton width={52} height={22} borderRadius={4} />
          </View>
        ))}
      </View>

      {/* Habit cards */}
      {[1, 2, 3, 4].map((i) => (
        <HabitCardSkeleton key={i} />
      ))}
    </View>
  );
}

// ── Friend-row skeleton ───────────────────────────────────────────────────────
export function FriendRowSkeleton() {
  return (
    <View style={s.habitCard}>
      <Skeleton width={44} height={44} borderRadius={22} />
      <View style={s.habitTextBlock}>
        <Skeleton width="55%" height={14} borderRadius={6} />
        <View style={{ height: 6 }} />
        <Skeleton width="35%" height={11} borderRadius={6} />
      </View>
    </View>
  );
}

// ── Leaderboard row skeleton ──────────────────────────────────────────────────
export function LeaderRowSkeleton() {
  return (
    <View style={s.habitCard}>
      <Skeleton width={28} height={28} borderRadius={14} />
      <Skeleton width={36} height={36} borderRadius={18} style={{ marginLeft: 8 }} />
      <View style={s.habitTextBlock}>
        <Skeleton width="50%" height={14} borderRadius={6} />
        <View style={{ height: 6 }} />
        <Skeleton width="30%" height={11} borderRadius={6} />
      </View>
      <Skeleton width={44} height={20} borderRadius={6} />
    </View>
  );
}

const s = StyleSheet.create({
  dashWrapper:    { paddingHorizontal: 16, paddingTop: 16 },
  greetingRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  statRow:        { flexDirection: 'row', gap: 8, marginBottom: 24 },
  statChip:       { flex: 1, backgroundColor: 'rgba(107,114,128,0.08)', borderRadius: 12, padding: 12 },
  habitCard:      {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(107,114,128,0.06)',
    borderRadius: 16, padding: 16, marginBottom: 8, gap: 12,
  },
  habitTextBlock: { flex: 1 },
});
