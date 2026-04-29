import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, SafeAreaView,
  StatusBar, RefreshControl,
} from 'react-native';
import api from '../lib/axios';
import { useTheme } from '../context/ThemeContext';

function toDateStr(d) { return d.toISOString().split('T')[0]; }

function computeStreak(logs) {
  const today = new Date();
  const todayS = toDateStr(today);
  const yest = new Date(today); yest.setDate(yest.getDate() - 1);
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

function buildHeatmap(allLogs) {
  const today = new Date();
  const result = [];
  for (let i = 83; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = toDateStr(d);
    const count = allLogs.filter((l) => l.date === dateStr && l.status === 'done').length;
    result.push({ dateStr, count, dayOfWeek: d.getDay() });
  }
  return result;
}

function heatmapColor(count, colors) {
  if (count === 0) return colors.border;
  if (count <= 2)  return colors.primary + '66';
  if (count <= 4)  return colors.primary + 'b3';
  return colors.primary;
}

function Bar({ value, max, color, trackColor }) {
  const pct = max > 0 ? Math.min(value / max, 1) * 100 : 0;
  return (
    <View style={[barSt.track, { backgroundColor: trackColor }]}>
      <View style={[barSt.fill, { width: `${Math.round(pct)}%`, backgroundColor: color }]} />
    </View>
  );
}
const barSt = StyleSheet.create({
  track: { height: 6, borderRadius: 3, overflow: 'hidden', flex: 1 },
  fill:  { height: 6, borderRadius: 3 },
});

export default function StatsScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);

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
  const globalBest = maxBest;

  const rateColor   = (r) => r >= 80 ? colors.success : r >= 50 ? '#f59e0b' : colors.danger;
  const rateBadgeBg = (r) => r >= 80
    ? colors.success + '33'
    : r >= 50 ? '#f59e0b33' : colors.danger + '33';

  const heatmapData = buildHeatmap(allLogs);

  const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const ds = toDateStr(d);
    const count = allLogs.filter((l) => l.date === ds && l.status === 'done').length;
    return { label: DAY_SHORT[d.getDay()], count };
  });
  const maxDay = Math.max(...last7.map((d) => d.count), 1);
  const currentMonth = new Date().toISOString().slice(0, 7);

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      <View style={s.navbar}>
        <Text style={s.navBrand}>📊 Stats</Text>
        <Text style={s.navDate}>
          {new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
        </Text>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
      >
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
            <View style={s.grid}>
              <View style={[s.cell, s.bRight, s.bBottom]}>
                <Text style={s.cellNum}>{totalDone}</Text>
                <Text style={s.cellLbl}>✅ Total Done</Text>
              </View>
              <View style={[s.cell, s.bBottom]}>
                <Text style={[s.cellNum, { color: colors.danger }]}>{totalMiss}</Text>
                <Text style={s.cellLbl}>❌ Total Missed</Text>
              </View>
              <View style={[s.cell, s.bRight]}>
                <Text style={[s.cellNum, { color: colors.success }]}>{overallPct}%</Text>
                <Text style={s.cellLbl}>🎯 Completion</Text>
              </View>
              <View style={s.cell}>
                <Text style={s.cellNum}>{habits.length}</Text>
                <Text style={s.cellLbl}>🏃 Active Habits</Text>
              </View>
            </View>

            <Text style={s.sectionLabel}>Achievements</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.badgesScroll}>
              {[
                { milestone: 7,   emoji: '🔥', label: '7 Day' },
                { milestone: 30,  emoji: '⚡', label: '30 Day' },
                { milestone: 100, emoji: '💎', label: '100 Day' },
              ].map(({ milestone, emoji, label }) => {
                const achieved = globalBest >= milestone;
                return (
                  <View key={milestone} style={[s.badgeCard, achieved && s.badgeCardAchieved]}>
                    <Text style={[s.badgeEmoji, !achieved && { opacity: 0.4 }]}>{emoji}</Text>
                    <Text style={[s.badgeLabel, { color: achieved ? colors.primary : colors.textMuted }]}>
                      {label}
                    </Text>
                    <Text style={[s.badgeStatus, { color: achieved ? colors.success : colors.textMuted }]}>
                      {achieved ? 'Achieved!' : `${milestone - globalBest} more days`}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>

            <View style={s.card}>
              <View style={s.rowBetween}>
                <Text style={s.cardLbl}>Overall Completion</Text>
                <Text style={[s.bigPct, { color: rateColor(overallPct) }]}>{overallPct}%</Text>
              </View>
              <View style={s.barRow}>
                <Bar value={overallPct} max={100} color={rateColor(overallPct)} trackColor={colors.border} />
              </View>
              <View style={s.rowBetween}>
                <Text style={s.dimTxt}>{totalDone} done</Text>
                <Text style={s.dimTxt}>{totalMiss} missed</Text>
              </View>
            </View>

            <View style={s.card}>
              <Text style={s.cardLbl}>Done vs Missed</Text>
              <View style={s.splitTrack}>
                <View style={[s.splitFill, { flex: totalDone || 1, backgroundColor: colors.success, borderTopLeftRadius: 6, borderBottomLeftRadius: 6 }]} />
                {totalMiss > 0 && <View style={[s.splitFill, { flex: totalMiss, backgroundColor: colors.danger, borderTopRightRadius: 6, borderBottomRightRadius: 6 }]} />}
              </View>
              <View style={s.legendRow}>
                <View style={s.legendItem}><View style={[s.dot, { backgroundColor: colors.success }]} /><Text style={s.legendTxt}>Done ({totalDone})</Text></View>
                <View style={s.legendItem}><View style={[s.dot, { backgroundColor: colors.danger }]} /><Text style={s.legendTxt}>Missed ({totalMiss})</Text></View>
              </View>
            </View>

            <Text style={s.sectionLabel}>Your best days</Text>
            <View style={s.card}>
              <View style={s.bestDaysRow}>
                {last7.map((day, i) => (
                  <View key={i} style={s.bestDayCol}>
                    {day.count > 0 && <Text style={s.bestDayCount}>{day.count}</Text>}
                    <View style={s.bestDayBarContainer}>
                      <View style={[s.bestDayBar, {
                        height: day.count > 0 ? Math.max(3, Math.round((day.count / maxDay) * 80)) : 3,
                        backgroundColor: day.count > 0 ? colors.primary : colors.border,
                      }]} />
                    </View>
                    <Text style={s.bestDayLabel}>{day.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            <Text style={s.sectionLabel}>Activity in last 12 weeks</Text>
            <View style={s.card}>
              <View style={s.heatmapOuter}>
                <View style={s.heatmapDayLabels}>
                  {['M', '', 'W', '', 'F', '', ''].map((lbl, i) => (
                    <Text key={i} style={s.heatmapDayLbl}>{lbl}</Text>
                  ))}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={s.heatmapGrid}>
                    {Array.from({ length: 12 }, (_, week) => (
                      <View key={week} style={s.heatmapWeekCol}>
                        {Array.from({ length: 7 }, (_, day) => {
                          const idx = week * 7 + day;
                          const cell = heatmapData[idx];
                          return (
                            <View
                              key={day}
                              style={[s.heatmapCell, { backgroundColor: cell ? heatmapColor(cell.count, colors) : colors.border }]}
                            />
                          );
                        })}
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
              <View style={s.heatmapLegend}>
                <Text style={s.heatmapLegendLbl}>Less</Text>
                {[0, 1, 3, 5].map((v) => (
                  <View key={v} style={[s.heatmapCell, { backgroundColor: heatmapColor(v, colors), marginHorizontal: 2 }]} />
                ))}
                <Text style={s.heatmapLegendLbl}>More</Text>
              </View>
            </View>
          </>
        ) : (
          habits.map((h) => {
            const logs       = logsMap[h._id] || [];
            const streak     = computeStreak(logs);
            const best       = computeBestStreak(logs);
            const col        = h.colorHex || colors.primary;
            const thisMonth  = logs.filter((l) => l.date.startsWith(currentMonth));
            const monthDone  = thisMonth.filter((l) => l.status === 'done').length;
            const monthTotal = thisMonth.length;
            const rate       = monthTotal > 0 ? Math.round((monthDone / monthTotal) * 100) : 0;
            const totalHDone = logs.filter((l) => l.status === 'done').length;
            return (
              <View key={h._id} style={s.hCard}>
                <View style={[s.hAccentBar, { backgroundColor: col }]} />
                <View style={s.hBody}>
                  <View style={s.hHeader}>
                    <Text style={s.hIcon}>{h.icon}</Text>
                    <Text style={s.hName} numberOfLines={1}>{h.name}</Text>
                    <View style={[s.rateBadge, { backgroundColor: rateBadgeBg(rate) }]}>
                      <Text style={[s.rateBadgeTxt, { color: rateColor(rate) }]}>{rate}%</Text>
                    </View>
                  </View>
                  <View style={s.hProgressSection}>
                    <Text style={s.hProgressLabel}>This month completion</Text>
                    <View style={s.hProgressTrack}>
                      <View style={[s.hProgressFill, { width: `${rate}%`, backgroundColor: col }]} />
                    </View>
                  </View>
                  <View style={s.miniRow}>
                    {[
                      ['🔥', streak, 'Current'],
                      ['⭐', best, 'Best'],
                      ['📅', monthDone, 'This Month'],
                      ['✅', totalHDone, 'Total Done'],
                    ].map(([icon, val, lbl], i, arr) => (
                      <React.Fragment key={lbl}>
                        <View style={s.mini}>
                          <Text style={s.miniNum}>{val}</Text>
                          <Text style={s.miniLbl}>{icon} {lbl}</Text>
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
  tabTxt:       { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  tabTxtActive: { color: colors.textPrimary },

  empty:     { alignItems: 'center', marginTop: 60 },
  emptyEmoji:{ fontSize: 48 },
  emptyTitle:{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 16 },
  emptySub:  { color: colors.textMuted, fontSize: 14, marginTop: 8, textAlign: 'center' },

  sectionLabel: { color: colors.textMuted, fontSize: 12, marginBottom: 8, marginTop: 4 },

  grid:    { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: colors.card, borderRadius: 16, marginBottom: 14, overflow: 'hidden' },
  cell:    { width: '50%', paddingVertical: 18, alignItems: 'center' },
  bRight:  { borderRightWidth: 1, borderRightColor: colors.border },
  bBottom: { borderBottomWidth: 1, borderBottomColor: colors.border },
  cellNum: { color: colors.textPrimary, fontSize: 24, fontWeight: '700' },
  cellLbl: { color: colors.textMuted, fontSize: 11, marginTop: 2 },

  badgesScroll:      { marginBottom: 14 },
  badgeCard:         { width: 80, alignItems: 'center', padding: 10, borderRadius: 12, marginRight: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, opacity: 0.6 },
  badgeCardAchieved: { backgroundColor: colors.primary + '33', borderColor: colors.primary + '66', opacity: 1 },
  badgeEmoji:        { fontSize: 24, marginBottom: 4 },
  badgeLabel:        { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  badgeStatus:       { fontSize: 9, marginTop: 2, textAlign: 'center' },

  card:       { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 14 },
  cardLbl:    { color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  bigPct:     { fontSize: 14, fontWeight: '700' },
  barRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  dimTxt:     { color: colors.textMuted, fontSize: 11 },

  splitTrack: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', marginBottom: 12 },
  splitFill:  { height: 12 },
  legendRow:  { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot:        { width: 8, height: 8, borderRadius: 4 },
  legendTxt:  { color: colors.textMuted, fontSize: 12 },

  bestDaysRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  bestDayCol:         { flex: 1, alignItems: 'center' },
  bestDayCount:       { color: colors.primary, fontSize: 10, fontWeight: '700', marginBottom: 2 },
  bestDayBarContainer:{ height: 80, justifyContent: 'flex-end', marginBottom: 4 },
  bestDayBar:         { width: 28, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  bestDayLabel:       { color: colors.textMuted, fontSize: 10 },

  heatmapOuter:     { flexDirection: 'row' },
  heatmapDayLabels: { justifyContent: 'space-between', marginRight: 4, paddingVertical: 1 },
  heatmapDayLbl:    { color: colors.textMuted, fontSize: 8, height: 14, lineHeight: 14 },
  heatmapGrid:      { flexDirection: 'row' },
  heatmapWeekCol:   { flexDirection: 'column', marginRight: 2 },
  heatmapCell:      { width: 12, height: 12, borderRadius: 2, margin: 1 },
  heatmapLegend:    { flexDirection: 'row', alignItems: 'center', marginTop: 10, justifyContent: 'flex-end' },
  heatmapLegendLbl: { color: colors.textMuted, fontSize: 9, marginHorizontal: 4 },

  hCard:           { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 12, overflow: 'hidden' },
  hAccentBar:      { width: 4, alignSelf: 'stretch' },
  hBody:           { flex: 1, padding: 14 },
  hHeader:         { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  hIcon:           { fontSize: 22, marginRight: 8 },
  hName:           { flex: 1, color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  rateBadge:       { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  rateBadgeTxt:    { fontSize: 12, fontWeight: '700' },
  hProgressSection:{ marginBottom: 12 },
  hProgressLabel:  { color: colors.textMuted, fontSize: 11, marginBottom: 6 },
  hProgressTrack:  { height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  hProgressFill:   { height: 6, borderRadius: 3 },
  miniRow:         { flexDirection: 'row', backgroundColor: colors.bg, borderRadius: 10, padding: 8 },
  mini:            { flex: 1, alignItems: 'center' },
  miniNum:         { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  miniLbl:         { color: colors.textMuted, fontSize: 9, marginTop: 2, textAlign: 'center' },
  miniDiv:         { width: 1, height: 32, backgroundColor: colors.border },
});
