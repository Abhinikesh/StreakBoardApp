import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Modal, Alert, ActivityIndicator, StyleSheet,
  SafeAreaView, StatusBar,
} from 'react-native';
import api from '../lib/axios';
import { useTheme } from '../context/ThemeContext';

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function toStr(d) { return d.toISOString().split('T')[0]; }

function buildCalendarDays(year, month, logs) {
  const logMap = {};
  logs.forEach((l) => { logMap[l.date] = l; });
  const firstDay = new Date(year, month, 1);
  let offset = firstDay.getDay() - 1;
  if (offset < 0) offset = 6;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayS = toStr(new Date());
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push({ empty: true, key: `e${i}` });
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    const dateStr = `${year}-${mm}-${dd}`;
    cells.push({
      empty: false, day: d, dateStr,
      log: logMap[dateStr] || null,
      isToday: dateStr === todayS,
      isFuture: dateStr > todayS,
      key: dateStr,
    });
  }
  return cells;
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  if (chunks.length) {
    const last = chunks[chunks.length - 1];
    while (last.length < size) last.push({ empty: true, key: `pad${last.length}` });
  }
  return chunks;
}

function computeStreak(logs) {
  const todayS = toStr(new Date());
  const yest = new Date(); yest.setDate(yest.getDate() - 1);
  const yesterS = toStr(yest);
  const set = new Set(logs.map((l) => l.date));
  if (!set.has(todayS) && !set.has(yesterS)) return 0;
  const start = set.has(todayS) ? todayS : yesterS;
  let streak = 0;
  const cur = new Date(start);
  while (true) {
    const ds = toStr(cur);
    if (set.has(ds)) { streak++; cur.setDate(cur.getDate() - 1); } else break;
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

function formatDayLabel(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

export default function CalendarScreen({ navigation, route }) {
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const routeParams = (route && route.params) || {};
  const preselectedId = routeParams.habitId || null;

  const [habits,          setHabits]          = useState([]);
  const [selectedHabitId, setSelectedHabitId] = useState(null);
  const [logs,            setLogs]            = useState([]);
  const [currentMonth,    setCurrentMonth]    = useState(new Date());
  const [loading,         setLoading]         = useState(true);
  const [logsLoading,     setLogsLoading]     = useState(false);
  const [selectedDay,     setSelectedDay]     = useState(null);
  const [showDayModal,    setShowDayModal]    = useState(false);
  const [actionLoading,   setActionLoading]   = useState(false);

  const fetchHabits = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/habits');
      const active = (res.data || []).filter((h) => h.isActive !== false);
      setHabits(active);
    } catch (e) {
      console.error('CalendarScreen: habits fetch error', e?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHabits(); }, [fetchHabits]);

  useEffect(() => {
    if (!habits.length) return;
    const target =
      preselectedId && habits.some((h) => h._id === preselectedId)
        ? preselectedId
        : habits[0]._id;
    setSelectedHabitId(target);
  }, [habits, preselectedId]);

  const fetchLogs = useCallback(async (habitId) => {
    if (!habitId) return;
    setLogsLoading(true);
    try {
      const res = await api.get(`/api/logs/${habitId}`);
      setLogs(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedHabitId) fetchLogs(selectedHabitId);
  }, [selectedHabitId, fetchLogs]);

  const today = new Date();
  const isCurrentMonth =
    currentMonth.getFullYear() === today.getFullYear() &&
    currentMonth.getMonth() === today.getMonth();

  const goPrev = useCallback(() => {
    setCurrentMonth((m) => { const n = new Date(m); n.setMonth(n.getMonth() - 1); return n; });
  }, []);
  const goNext = useCallback(() => {
    if (isCurrentMonth) return;
    setCurrentMonth((m) => { const n = new Date(m); n.setMonth(n.getMonth() + 1); return n; });
  }, [isCurrentMonth]);

  const selectedDayLog = logs.find((l) => l.date === selectedDay) || null;

  const handleDayLog = useCallback(async (status) => {
    if (!selectedHabitId || !selectedDay) return;
    setActionLoading(true);
    try {
      if (selectedDayLog) {
        await api.delete(`/api/logs/${selectedDayLog._id}`);
        if (selectedDayLog.status !== status) {
          await api.post('/api/logs', { habitId: selectedHabitId, date: selectedDay, status });
        }
      } else {
        await api.post('/api/logs', { habitId: selectedHabitId, date: selectedDay, status });
      }
      await fetchLogs(selectedHabitId);
      setShowDayModal(false);
    } catch (_) {
      Alert.alert('Error', 'Could not save log. Try again.');
    } finally {
      setActionLoading(false);
    }
  }, [selectedHabitId, selectedDay, selectedDayLog, fetchLogs]);

  const year      = currentMonth.getFullYear();
  const monthIdx  = currentMonth.getMonth();
  const cells     = buildCalendarDays(year, monthIdx, logs);
  const rows      = chunkArray(cells, 7);
  const doneLogs  = logs.filter((l) => l.status === 'done');
  const totalLogged = logs.length;
  const completionRate = totalLogged > 0 ? Math.round((doneLogs.length / totalLogged) * 100) : 0;
  const curStreak  = computeStreak(logs);
  const bestStreak = computeBestStreak(logs);
  const monthTitle = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      <View style={s.navbar}>
        <Text style={s.navbarBrand}>📅 Calendar</Text>
        <Text style={s.navbarDate}>{monthTitle}</Text>
      </View>

      {loading ? (
        <View style={s.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : habits.length === 0 ? (
        <View style={s.centered}>
          <Text style={s.emptyTitle}>No habits found</Text>
          <Text style={s.emptySub}>Add habits from the Home tab</Text>
        </View>
      ) : (
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.pillScroll}>
            {habits.map((h) => {
              const sel = h._id === selectedHabitId;
              return (
                <TouchableOpacity
                  key={h._id}
                  style={[s.pill, sel && s.pillSel]}
                  activeOpacity={0.7}
                  onPress={() => setSelectedHabitId(h._id)}
                >
                  <Text style={[s.pillTxt, sel && s.pillTxtSel]}>{h.icon} {h.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={s.monthNav}>
            <TouchableOpacity onPress={goPrev} style={s.monthBtn} activeOpacity={0.7}>
              <Text style={s.monthArrow}>{'<'}</Text>
            </TouchableOpacity>
            <Text style={s.monthTitle}>{monthTitle}</Text>
            <TouchableOpacity
              onPress={goNext}
              style={[s.monthBtn, isCurrentMonth && s.monthBtnDisabled]}
              activeOpacity={isCurrentMonth ? 1 : 0.7}
              disabled={isCurrentMonth}
            >
              <Text style={[s.monthArrow, isCurrentMonth && s.monthArrowDim]}>{'>'}</Text>
            </TouchableOpacity>
          </View>

          {logsLoading ? (
            <View style={s.gridLoading}><ActivityIndicator color={colors.primary} /></View>
          ) : (
            <View style={s.calBox}>
              <View style={s.dayHeaderRow}>
                {DAY_HEADERS.map((d) => (
                  <Text key={d} style={s.dayHeader}>{d}</Text>
                ))}
              </View>
              {rows.map((row, ri) => (
                <View key={ri} style={s.calRow}>
                  {row.map((cell) => {
                    if (cell.empty) return <View key={cell.key} style={s.cellEmpty} />;
                    const { day, log, isToday, isFuture, dateStr } = cell;
                    const isDone   = log?.status === 'done';
                    const isMissed = log?.status === 'missed';
                    let bg = 'transparent';
                    if (isDone)        bg = colors.success;
                    else if (isMissed) bg = colors.danger;
                    else if (!isFuture) bg = colors.border;
                    const todayBorder = isToday && !log;
                    const todayRing   = isToday && (isDone || isMissed);
                    let txtColor = colors.borderHover;
                    if (isDone || isMissed)  txtColor = colors.textPrimary;
                    else if (isToday)        txtColor = colors.primary;
                    else if (!isFuture)      txtColor = colors.textMuted;
                    return (
                      <TouchableOpacity
                        key={cell.key}
                        style={[
                          s.cell,
                          { backgroundColor: bg },
                          todayBorder && s.cellTodayBorder,
                          todayRing   && s.cellTodayRing,
                        ]}
                        activeOpacity={isFuture ? 1 : 0.7}
                        disabled={isFuture}
                        onPress={() => { setSelectedDay(dateStr); setShowDayModal(true); }}
                      >
                        <Text style={[s.cellTxt, { color: txtColor },
                          (isToday || isDone || isMissed) && s.cellTxtBold]}>
                          {day}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          )}

          <View style={s.statsBox}>
            <View style={[s.statCell, s.bRight, s.bBottom]}>
              <Text style={s.statNum}>{curStreak}</Text>
              <Text style={s.statLbl}>🔥 Current Streak</Text>
            </View>
            <View style={[s.statCell, s.bBottom]}>
              <Text style={s.statNum}>{bestStreak}</Text>
              <Text style={s.statLbl}>⭐ Best Streak</Text>
            </View>
            <View style={[s.statCell, s.bRight]}>
              <Text style={s.statNum}>{completionRate}%</Text>
              <Text style={s.statLbl}>✅ Completion</Text>
            </View>
            <View style={s.statCell}>
              <Text style={s.statNum}>{doneLogs.length}</Text>
              <Text style={s.statLbl}>📅 Total Done</Text>
            </View>
          </View>
        </ScrollView>
      )}

      <Modal
        visible={showDayModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDayModal(false)}
      >
        <View style={s.modalBg}>
          <View style={s.modalSheet}>
            <View style={s.modalHead}>
              <Text style={s.modalDate}>{selectedDay ? formatDayLabel(selectedDay) : ''}</Text>
              <TouchableOpacity onPress={() => setShowDayModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={s.modalX}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedDayLog && (
              <Text style={[s.currentStatus,
                { color: selectedDayLog.status === 'done' ? colors.success : colors.danger }]}>
                Currently: {selectedDayLog.status === 'done' ? '✓ Done' : '✗ Missed'}
              </Text>
            )}

            <View style={s.modalActions}>
              <TouchableOpacity
                style={[s.actionBtn, selectedDayLog?.status === 'done' ? s.btnDoneFill : s.btnDoneOut]}
                onPress={() => handleDayLog('done')}
                disabled={actionLoading}
                activeOpacity={0.8}
              >
                {actionLoading
                  ? <ActivityIndicator color={colors.textPrimary} />
                  : <Text style={[s.actionTxt,
                      { color: selectedDayLog?.status === 'done' ? colors.textPrimary : colors.success }]}>
                      ✓ Done
                    </Text>}
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.actionBtn, selectedDayLog?.status === 'missed' ? s.btnMissedFill : s.btnMissedOut]}
                onPress={() => handleDayLog('missed')}
                disabled={actionLoading}
                activeOpacity={0.8}
              >
                {actionLoading
                  ? <ActivityIndicator color={colors.textPrimary} />
                  : <Text style={[s.actionTxt,
                      { color: selectedDayLog?.status === 'missed' ? colors.textPrimary : colors.danger }]}>
                      ✗ Missed
                    </Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  safe:          { flex: 1, backgroundColor: colors.bg },
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120, paddingTop: 16 },
  centered:      { flex: 1, alignItems: 'center', justifyContent: 'center' },

  navbar:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                 paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
                 borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.bg },
  navbarBrand: { color: colors.primary, fontSize: 20, fontWeight: '800' },
  navbarDate:  { color: colors.textMuted, fontSize: 12 },

  emptyTitle:  { color: colors.textMuted, fontSize: 14, marginTop: 60 },
  emptySub:    { color: colors.borderHover, fontSize: 12, marginTop: 8 },

  pillScroll:  { flexGrow: 0, marginBottom: 4 },
  pill:        { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 10,
                 backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  pillSel:     { backgroundColor: colors.primary, borderColor: colors.primary },
  pillTxt:     { color: colors.textSecondary, fontSize: 13 },
  pillTxtSel:  { color: colors.textPrimary, fontWeight: '600' },

  monthNav:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                 marginTop: 20, marginBottom: 12 },
  monthBtn:    { paddingHorizontal: 8, paddingVertical: 4 },
  monthBtnDisabled: { opacity: 0.3 },
  monthArrow:  { color: colors.primary, fontSize: 22, fontWeight: '700' },
  monthArrowDim: { color: colors.primary },
  monthTitle:  { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },

  calBox:      { marginBottom: 4 },
  dayHeaderRow:{ flexDirection: 'row', marginBottom: 4 },
  dayHeader:   { flex: 1, color: colors.textMuted, fontSize: 11, fontWeight: '500',
                 textAlign: 'center', paddingBottom: 8 },
  calRow:      { flexDirection: 'row', marginBottom: 4 },
  cell:        { flex: 1, aspectRatio: 1, margin: 2, borderRadius: 8,
                 alignItems: 'center', justifyContent: 'center' },
  cellEmpty:   { flex: 1, aspectRatio: 1, margin: 2 },
  cellTodayBorder: { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: 'transparent' },
  cellTodayRing:   { borderWidth: 2, borderColor: colors.primary },
  cellTxt:     { fontSize: 13 },
  cellTxtBold: { fontWeight: '700' },
  gridLoading: { paddingVertical: 48, alignItems: 'center' },

  statsBox:    { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: colors.card,
                 borderRadius: 16, marginTop: 16, overflow: 'hidden' },
  statCell:    { width: '50%', paddingVertical: 16, alignItems: 'center' },
  bRight:      { borderRightWidth: 1, borderRightColor: colors.border },
  bBottom:     { borderBottomWidth: 1, borderBottomColor: colors.border },
  statNum:     { color: colors.textPrimary, fontSize: 22, fontWeight: '700' },
  statLbl:     { color: colors.textMuted, fontSize: 11, marginTop: 2 },

  modalBg:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet:  { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
                 paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
  modalHead:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalDate:   { color: colors.textPrimary, fontSize: 16, fontWeight: '700', flex: 1, marginRight: 8 },
  modalX:      { color: colors.textMuted, fontSize: 22 },
  currentStatus: { fontSize: 13, marginTop: 12, marginBottom: 4 },
  modalActions:  { flexDirection: 'row', gap: 12, marginTop: 20 },
  actionBtn:   { flex: 1, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  btnDoneFill: { backgroundColor: colors.success },
  btnDoneOut:  { borderWidth: 1.5, borderColor: colors.success, backgroundColor: 'transparent' },
  btnMissedFill: { backgroundColor: colors.danger },
  btnMissedOut:  { borderWidth: 1.5, borderColor: colors.danger, backgroundColor: 'transparent' },
  actionTxt:   { fontSize: 15, fontWeight: '600' },
});
