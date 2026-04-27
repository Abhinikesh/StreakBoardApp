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

function toDateStr(d) { return d.toISOString().split('T')[0]; }

function computeStreak(logs) {
  const today = new Date();
  const todayS = toDateStr(today);
  const yest = new Date(today);
  yest.setDate(yest.getDate() - 1);
  const yesterdayS = toDateStr(yest);
  const loggedDates = new Set(logs.map((l) => l.date));
  if (!loggedDates.has(todayS) && !loggedDates.has(yesterdayS)) return 0;
  const startStr = loggedDates.has(todayS) ? todayS : yesterdayS;
  let streak = 0;
  const cur = new Date(startStr);
  while (true) {
    const ds = toDateStr(cur);
    if (loggedDates.has(ds)) { streak++; cur.setDate(cur.getDate() - 1); }
    else break;
  }
  return streak;
}

function computeBestStreak(logs) {
  if (!logs.length) return 0;
  const dates = [...new Set(logs.map((l) => l.date))].sort();
  let best = 1, cur = 1;
  for (let i = 1; i < dates.length; i++) {
    const diff = (new Date(dates[i]) - new Date(dates[i - 1])) / 86400000;
    if (diff === 1) { cur++; if (cur > best) best = cur; } else cur = 1;
  }
  return best;
}

function Bar({ value, max, color }) {
  const pct = max > 0 ? Math.min(value / max, 1) * 100 : 0;
  return (
    <View style={barSt.track}>
      <View style={[barSt.fill, { width: `${Math.round(pct)}%`, backgroundColor: color }]} />
    </View>
  );
}
const barSt = StyleSheet.create({
  track: { height: 6, borderRadius: 3, backgroundColor: '#1e1e2e', overflow: 'hidden', flex: 1 },
  fill:  { height: 6, borderRadius: 3 },
});

export default function StatsScreen() {
  const [habits,     setHabits]     = useState([]);
  const [logsMap,    setLogsMap]    = useState({});
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab,        setTab]        = useState('overview');

  const fetchAll = useCallback(async () => {
    try {
      const res = await api.get('/api/habits');
      const active = (res.data || []).filter((h) => h.isActive);
      setHabits(active);
      const results = await Promise.all(
        active.map((h) => api.get(`/api/logs/${h._id}`).then((r) => ({ id: h._id, logs: r.data || [] }))),
      );
      const map = {};
      results.forEach(({ id, logs }) => { map[id] = logs; });
      setLogsMap(map);
    } catch (_) {}
  }, []);

  useEffect(() => {
    (async () => { setLoading(true); await fetchAll(); setLoading(false); })();
  }, [fetchAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await fetchAll(); setRefreshing(false);
  }, [fetchAll]);

  const allLogs    = Object.values(logsMap).flat();
  const totalDone  = allLogs.filter((l) => l.status === 'done').length;
  const totalMiss  = allLogs.filter((l) => l.status === 'missed').length;
  const totalLog   = allLogs.length;
  const overallPct = totalLog > 0 ? Math.round((totalDone / totalLog) * 100) : 0;
  const maxBest    = habits.reduce((m, h) => Math.max(m, computeBestStreak(logsMap[h._id] || [])), 1);

  const rateColor = (r) => r >= 70 ? COLORS.success : r >= 40 ? '#f59e0b' : COLORS.danger;

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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} colors={[COLORS.primary]} />}
      >
        <Text style={s.title}>📊 Stats</Text>
        <Text style={s.subtitle}>Your habit performance at a glance</Text>

        {/* Tab toggle */}
        <View style={s.tabRow}>
          {['overview', 'habits'].map((t) => (
            <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabActive]}
              onPress={() => setTab(t)} activeOpacity={0.75}>
              <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>
                {t === 'overview' ? 'Overview' : 'Per Habit'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {habits.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyEmoji}>📋</Text>
            <Text style={s.emptyTitle}>No data yet</Text>
            <Text style={s.emptySub}>Add habits from the Dashboard to see stats.</Text>
          </View>
        ) : tab === 'overview' ? (
          <>
            {/* Summary grid */}
            <View style={s.grid}>
              <View style={[s.cell, s.bRight, s.bBottom]}>
                <Text style={s.cellNum}>{totalDone}</Text>
                <Text style={s.cellLbl}>✅ Total Done</Text>
              </View>
              <View style={[s.cell, s.bBottom]}>
                <Text style={[s.cellNum, { color: COLORS.danger }]}>{totalMiss}</Text>
                <Text style={s.cellLbl}>❌ Total Missed</Text>
              </View>
              <View style={[s.cell, s.bRight]}>
                <Text style={[s.cellNum, { color: COLORS.success }]}>{overallPct}%</Text>
                <Text style={s.cellLbl}>🎯 Completion</Text>
              </View>
              <View style={s.cell}>
                <Text style={s.cellNum}>{habits.length}</Text>
                <Text style={s.cellLbl}>🏃 Active Habits</Text>
              </View>
            </View>

            {/* Overall completion bar */}
            <View style={s.card}>
              <View style={s.rowBetween}>
                <Text style={s.cardLbl}>Overall Completion</Text>
                <Text style={[s.bigPct, { color: rateColor(overallPct) }]}>{overallPct}%</Text>
              </View>
              <View style={s.barRow}><Bar value={overallPct} max={100} color={rateColor(overallPct)} /></View>
              <View style={s.rowBetween}>
                <Text style={s.dimTxt}>{totalDone} done</Text>
                <Text style={s.dimTxt}>{totalMiss} missed</Text>
              </View>
            </View>

            {/* Done vs Missed split */}
            <View style={s.card}>
              <Text style={s.cardLbl}>Done vs Missed</Text>
              <View style={s.splitTrack}>
                <View style={[s.splitFill, { flex: totalDone || 1, backgroundColor: COLORS.success, borderTopLeftRadius: 6, borderBottomLeftRadius: 6 }]} />
                {totalMiss > 0 && <View style={[s.splitFill, { flex: totalMiss, backgroundColor: COLORS.danger, borderTopRightRadius: 6, borderBottomRightRadius: 6 }]} />}
              </View>
              <View style={s.legendRow}>
                <View style={s.legendItem}><View style={[s.dot, { backgroundColor: COLORS.success }]} /><Text style={s.legendTxt}>Done ({totalDone})</Text></View>
                <View style={s.legendItem}><View style={[s.dot, { backgroundColor: COLORS.danger }]} /><Text style={s.legendTxt}>Missed ({totalMiss})</Text></View>
              </View>
            </View>
          </>
        ) : (
          habits.map((h) => {
            const logs   = logsMap[h._id] || [];
            const streak = computeStreak(logs);
            const best   = computeBestStreak(logs);
            const done   = logs.filter((l) => l.status === 'done').length;
            const missed = logs.filter((l) => l.status === 'missed').length;
            const rate   = logs.length > 0 ? Math.round((done / logs.length) * 100) : 0;
            const col    = h.colorHex || COLORS.primary;

            return (
              <View key={h._id} style={s.hCard}>
                <View style={[s.hAccent, { backgroundColor: col }]} />
                <View style={s.hBody}>
                  <View style={s.hHeader}>
                    <Text style={s.hIcon}>{h.icon}</Text>
                    <Text style={s.hName} numberOfLines={1}>{h.name}</Text>
                    <View style={[s.badge, { backgroundColor: rateColor(rate) + '26' }]}>
                      <Text style={[s.badgeTxt, { color: rateColor(rate) }]}>{rate}%</Text>
                    </View>
                  </View>
                  <View style={s.barRow}><Bar value={best} max={maxBest} color={col} /></View>
                  <View style={s.miniRow}>
                    {[['Streak', streak, null], ['Best', best, null], ['Done', done, COLORS.success], ['Missed', missed, COLORS.danger]].map(([lbl, val, clr], i, arr) => (
                      <React.Fragment key={lbl}>
                        <View style={s.mini}>
                          <Text style={[s.miniNum, clr && { color: clr }]}>{val}</Text>
                          <Text style={s.miniLbl}>{lbl}</Text>
                        </View>
                        {i < arr.length - 1 && <View style={s.miniDiv} />}
                      </React.Fragment>
                    ))}
                  </View>
                </View>
              </View>
            );
          })
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

  tabRow:     { flexDirection: 'row', gap: 10, marginBottom: 20 },
  tab:        { paddingHorizontal: 20, paddingVertical: 9, borderRadius: 20, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  tabActive:  { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabTxt:     { color: COLORS.textSecondary, fontSize: 13, fontWeight: '500' },
  tabTxtActive:{ color: COLORS.textPrimary, fontWeight: '600' },

  empty:     { alignItems: 'center', marginTop: 60 },
  emptyEmoji:{ fontSize: 48 },
  emptyTitle:{ color: COLORS.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 16 },
  emptySub:  { color: COLORS.textMuted, fontSize: 14, marginTop: 8, textAlign: 'center' },

  grid:    { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: COLORS.card, borderRadius: 16, marginBottom: 14, overflow: 'hidden' },
  cell:    { width: '50%', paddingVertical: 18, alignItems: 'center' },
  bRight:  { borderRightWidth: 1, borderRightColor: COLORS.border },
  bBottom: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  cellNum: { color: COLORS.textPrimary, fontSize: 24, fontWeight: '700' },
  cellLbl: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },

  card:       { backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, padding: 16, marginBottom: 14 },
  cardLbl:    { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  bigPct:     { fontSize: 14, fontWeight: '700' },
  barRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  dimTxt:     { color: COLORS.textMuted, fontSize: 11 },

  splitTrack: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', marginBottom: 12 },
  splitFill:  { height: 12 },
  legendRow:  { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot:        { width: 8, height: 8, borderRadius: 4 },
  legendTxt:  { color: COLORS.textMuted, fontSize: 12 },

  hCard:   { flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12, overflow: 'hidden' },
  hAccent: { width: 4, alignSelf: 'stretch' },
  hBody:   { flex: 1, padding: 14 },
  hHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  hIcon:   { fontSize: 20, marginRight: 8 },
  hName:   { flex: 1, color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
  badge:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeTxt:{ fontSize: 12, fontWeight: '700' },
  miniRow: { flexDirection: 'row', backgroundColor: COLORS.bg, borderRadius: 10, padding: 10, marginTop: 10 },
  mini:    { flex: 1, alignItems: 'center' },
  miniNum: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
  miniLbl: { color: COLORS.textMuted, fontSize: 10, marginTop: 2 },
  miniDiv: { width: 1, height: 28, backgroundColor: COLORS.border },
});
