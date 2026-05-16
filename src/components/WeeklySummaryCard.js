import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../lib/axios';

function isSundayOrMonday() {
  const day = new Date().getDay(); // 0=Sun, 1=Mon
  return day === 0 || day === 1;
}

/** Returns the current ISO week's Monday date string "YYYY-MM-DD" for the dismiss key. */
function thisWeekMondayKey() {
  const now = new Date();
  const day = now.getDay();
  const daysFromMon = day === 0 ? 6 : day - 1;
  const mon = new Date(now);
  mon.setDate(now.getDate() - daysFromMon);
  const pad = n => String(n).padStart(2, '0');
  return `weekly_summary_dismissed_${mon.getFullYear()}-${pad(mon.getMonth()+1)}-${pad(mon.getDate())}`;
}

function vsLabel(n) {
  if (n > 0) return `+${n} day${n !== 1 ? 's' : ''}`;
  if (n < 0) return `${n} day${Math.abs(n) !== 1 ? 's' : ''}`;
  return 'Same as last week';
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WeeklySummaryCard({ colors }) {
  const [visible,  setVisible]  = useState(false);
  const [loading,  setLoading]  = useState(true);
  const [stats,    setStats]    = useState(null);
  const fadeAnim = useState(() => new Animated.Value(0))[0];

  const dismissKey = thisWeekMondayKey();

  const load = useCallback(async () => {
    // Only show on Sunday / Monday
    if (!isSundayOrMonday()) { setLoading(false); return; }

    // Already dismissed this week?
    const dismissed = await AsyncStorage.getItem(dismissKey).catch(() => null);
    if (dismissed === 'true') { setLoading(false); return; }

    // Fetch from backend
    try {
      const res = await api.get('/api/weekly-summary');
      if (res.data?.available) {
        setStats(res.data);
        setVisible(true);
        Animated.timing(fadeAnim, {
          toValue: 1, duration: 350, useNativeDriver: true,
        }).start();
      }
    } catch (_) {
      // Non-critical — silently skip if offline or server error
    } finally {
      setLoading(false);
    }
  }, [dismissKey, fadeAnim]);

  useEffect(() => { load(); }, [load]);

  const dismiss = useCallback(async () => {
    Animated.timing(fadeAnim, {
      toValue: 0, duration: 200, useNativeDriver: true,
    }).start(() => setVisible(false));
    await AsyncStorage.setItem(dismissKey, 'true').catch(() => {});
  }, [dismissKey, fadeAnim]);

  if (loading || !visible || !stats) return null;

  const {
    weekLabel, daysLogged, totalLogs,
    bestStreak, vsLastWeek, xpEarned,
  } = stats;

  const vsColor = vsLastWeek > 0
    ? '#10b981'
    : vsLastWeek < 0 ? '#ef4444'
    : (colors?.textMuted || '#9CA3AF');

  const s = makeStyles(colors);

  return (
    <Animated.View style={[s.card, { opacity: fadeAnim }]}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.pill}>WEEK IN REVIEW</Text>
          <Text style={s.weekLabel}>{weekLabel}</Text>
        </View>
        <TouchableOpacity onPress={dismiss} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={s.closeBtn}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Stats rows */}
      <View style={s.table}>
        <Row label="Days logged"       value={`${daysLogged} / 7`}            colors={colors} />
        <Row label="Habits completed"  value={String(totalLogs)}               colors={colors} />
        <Row label="Best streak"       value={`${bestStreak} day${bestStreak !== 1 ? 's' : ''}`} colors={colors} />
        <Row label="XP earned"         value={`+${xpEarned} XP`}              colors={colors} valueColor="#a78bfa" />
        <Row label="vs last week"      value={vsLabel(vsLastWeek)}             colors={colors} valueColor={vsColor} last />
      </View>
    </Animated.View>
  );
}

function Row({ label, value, colors, valueColor, last }) {
  const s = makeStyles(colors);
  return (
    <View style={[s.row, last && s.rowLast]}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={[s.rowValue, valueColor && { color: valueColor }]}>{value}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(colors) {
  const bg      = colors?.surface          || '#111120';
  const border  = colors?.border           || '#1e1e2e';
  const primary = colors?.primary          || '#7c3aed';
  const text    = colors?.textPrimary      || '#ffffff';
  const muted   = colors?.textMuted        || '#9CA3AF';
  const rowBg   = colors?.surfaceSecondary || '#1c1c2e';

  return StyleSheet.create({
    card: {
      marginHorizontal: 16,
      marginBottom: 14,
      backgroundColor: bg,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: border,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      padding: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: border,
    },
    pill: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.2,
      color: primary,
      marginBottom: 4,
    },
    weekLabel: {
      fontSize: 15,
      fontWeight: '700',
      color: text,
    },
    closeBtn: {
      fontSize: 14,
      color: muted,
      paddingTop: 2,
    },
    table: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: border,
    },
    rowLast: {
      borderBottomWidth: 0,
    },
    rowLabel: {
      fontSize: 13,
      color: muted,
    },
    rowValue: {
      fontSize: 13,
      fontWeight: '600',
      color: text,
    },
  });
}
