import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Modal, Alert, ActivityIndicator, StyleSheet,
  StatusBar, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
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
  const calendarRef = useRef(null);

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
  const selectedHabit  = habits.find((h) => h._id === selectedHabitId) || null;

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

  // ── Share handler ─────────────────────────────────────────────────────────
  const handleShare = useCallback(async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      const uri = await calendarRef.current.capture();

      Alert.alert(
        'Share your streak 🔥',
        'What would you like to do?',
        [
          {
            text: '📱 Share to WhatsApp / Instagram',
            onPress: async () => {
              await Share.share({
                url: uri,
                message: `My ${selectedHabit?.name} streak on StreakBoard! 🔥 Track yours at streak-o.vercel.app`,
              });
            },
          },
          {
            text: '💾 Save to Gallery',
            onPress: async () => {
              if (status === 'granted') {
                await MediaLibrary.saveToLibraryAsync(uri);
                Alert.alert('✅ Saved!', 'Calendar saved to your gallery');
              } else {
                Alert.alert('Permission needed', 'Allow gallery access to save image');
              }
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
    } catch (e) {
      Alert.alert('Error', 'Could not capture calendar. Try again.');
      console.error('share error:', e);
    }
  }, [selectedHabit]);

  const year       = currentMonth.getFullYear();
  const monthIdx   = currentMonth.getMonth();
  const cells      = buildCalendarDays(year, monthIdx, logs);
  const rows       = chunkArray(cells, 7);

  // ── Stats calculations ───────────────────────────────────────────────────
  const habitDuration  = selectedHabit?.trackingPeriod || 30;
  const startDate      = selectedHabit?.createdAt ? new Date(selectedHabit.createdAt) : new Date();
  const todayDate      = new Date();
  const daysPassed     = Math.max(1, Math.floor((todayDate - startDate) / (1000 * 60 * 60 * 24)) + 1);
  const daysRemaining  = Math.max(0, habitDuration - daysPassed);
  const doneDays       = logs.filter((l) => l.status === 'done').length;
  const missedDays     = logs.filter((l) => l.status === 'missed').length;
  const doneLogs       = logs.filter((l) => l.status === 'done');
  const completionRate = daysPassed > 0 ? Math.round((doneDays / daysPassed) * 100) : 0;
  const curStreak      = computeStreak(logs);
  const bestStreak     = computeBestStreak(logs);
  const monthTitle     = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Render calendar cell
  const renderCell = (cell) => {
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
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
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

          {/* Habit pills */}
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

          {/* ViewShot wrapper — captures everything inside */}
          <ViewShot
            ref={calendarRef}
            options={{ format: 'jpg', quality: 0.95 }}
          >
            <View style={s.shareCard}>

              {/* Habit header inside share card */}
              <View style={s.shareHeader}>
                <Text style={s.shareHabitIcon}>{selectedHabit?.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.shareHabitName}>{selectedHabit?.name}</Text>
                  <Text style={s.shareHabitSub}>{`${selectedHabit?.trackingPeriod || 30}-day streak tracker`}</Text>
                </View>
                <View style={s.streakBadge}>
                  <Text style={s.streakBadgeText}>🔥 {curStreak} day streak</Text>
                </View>
                {daysRemaining > 0 && (
                  <View style={{
                    backgroundColor: '#EFF6FF', borderRadius: 12,
                    paddingHorizontal: 10, paddingVertical: 4, marginLeft: 6,
                  }}>
                    <Text style={{ color: '#3B82F6', fontSize: 12, fontWeight: '600' }}>
                      {daysRemaining}d left
                    </Text>
                  </View>
                )}
              </View>

              {/* Month navigator row with Share button */}
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
                <TouchableOpacity style={s.shareBtn} onPress={handleShare} activeOpacity={0.85}>
                  <Text style={s.shareBtnText}>Share 🚀</Text>
                </TouchableOpacity>
              </View>

              {/* Calendar grid */}
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
                      {row.map(renderCell)}
                    </View>
                  ))}
                </View>
              )}

              {/* 4-column stats row: DONE / MISSED / REMAIN / RATE */}
              <View style={{
                flexDirection: 'row', backgroundColor: colors.card,
                borderRadius: 12, marginTop: 12,
                borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
              }}>
                {[
                  { value: doneDays,           label: 'DONE',   color: '#22C55E' },
                  { value: missedDays,          label: 'MISSED', color: '#EF4444' },
                  { value: daysRemaining,       label: 'REMAIN', color: colors.textPrimary },
                  { value: `${completionRate}%`, label: 'RATE',   color: '#7C3AED' },
                ].map((item, index) => (
                  <View
                    key={item.label}
                    style={{
                      flex: 1, alignItems: 'center', paddingVertical: 14,
                      borderRightWidth: index < 3 ? 1 : 0,
                      borderRightColor: colors.border,
                    }}
                  >
                    <Text style={{ fontSize: 20, fontWeight: '800', color: item.color }}>
                      {item.value}
                    </Text>
                    <Text style={{
                      fontSize: 10, color: colors.textMuted, marginTop: 3,
                      fontWeight: '600', letterSpacing: 0.5,
                    }}>
                      {item.label}
                    </Text>
                  </View>
                ))}
              </View>

              {/* StreakBoard watermark */}
              <View style={s.watermark}>
                <Text style={s.watermarkText}>🔥 StreakBoard • streak-o.vercel.app</Text>
              </View>

            </View>
          </ViewShot>
        </ScrollView>
      )}

      {/* Day Log Modal */}
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

  pillScroll:  { flexGrow: 0, marginBottom: 8 },
  pill:        { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 10,
                 backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  pillSel:     { backgroundColor: colors.primary, borderColor: colors.primary },
  pillTxt:     { color: colors.textSecondary, fontSize: 13 },
  pillTxtSel:  { color: colors.textPrimary, fontWeight: '600' },

  // ViewShot container card
  shareCard:   { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12 },

  // Share header inside card
  shareHeader:     { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  shareHabitIcon:  { fontSize: 28 },
  shareHabitName:  { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  shareHabitSub:   { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  streakBadge:     { backgroundColor: 'rgba(124,58,237,0.15)', borderRadius: 20,
                     paddingHorizontal: 10, paddingVertical: 4 },
  streakBadgeText: { color: colors.primary, fontSize: 12, fontWeight: '600' },

  monthNav:        { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 6 },
  monthBtn:        { paddingHorizontal: 6, paddingVertical: 4 },
  monthBtnDisabled:{ opacity: 0.3 },
  monthArrow:      { color: colors.primary, fontSize: 20, fontWeight: '700' },
  monthArrowDim:   { color: colors.primary },
  monthTitle:      { color: colors.textPrimary, fontSize: 15, fontWeight: '700', flex: 1, textAlign: 'center' },
  shareBtn:        { backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 7,
                     borderRadius: 20, flexDirection: 'row', alignItems: 'center' },
  shareBtnText:    { color: '#ffffff', fontSize: 13, fontWeight: '600' },

  calBox:          { marginBottom: 8 },
  dayHeaderRow:    { flexDirection: 'row', marginBottom: 4 },
  dayHeader:       { flex: 1, color: colors.textMuted, fontSize: 11, fontWeight: '500',
                     textAlign: 'center', paddingBottom: 6 },
  calRow:          { flexDirection: 'row', marginBottom: 4 },
  cell:            { flex: 1, aspectRatio: 1, margin: 2, borderRadius: 8,
                     alignItems: 'center', justifyContent: 'center' },
  cellEmpty:       { flex: 1, aspectRatio: 1, margin: 2 },
  cellTodayBorder: { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: 'transparent' },
  cellTodayRing:   { borderWidth: 2, borderColor: colors.primary },
  cellTxt:         { fontSize: 13 },
  cellTxtBold:     { fontWeight: '700' },
  gridLoading:     { paddingVertical: 48, alignItems: 'center' },

  statsBox:  { flexDirection: 'row', flexWrap: 'wrap', borderRadius: 12,
               borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginTop: 4 },
  statCell:  { width: '50%', paddingVertical: 12, alignItems: 'center' },
  bRight:    { borderRightWidth: 1, borderRightColor: colors.border },
  bBottom:   { borderBottomWidth: 1, borderBottomColor: colors.border },
  statNum:   { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
  statLbl:   { color: colors.textMuted, fontSize: 10, marginTop: 2 },

  // Watermark
  watermark:     { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border, alignItems: 'center' },
  watermarkText: { color: colors.textMuted, fontSize: 10 },

  // Day modal
  modalBg:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet:    { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
                   paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
  modalHead:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalDate:     { color: colors.textPrimary, fontSize: 16, fontWeight: '700', flex: 1, marginRight: 8 },
  modalX:        { color: colors.textMuted, fontSize: 22 },
  currentStatus: { fontSize: 13, marginTop: 12, marginBottom: 4 },
  modalActions:  { flexDirection: 'row', gap: 12, marginTop: 20 },
  actionBtn:     { flex: 1, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  btnDoneFill:   { backgroundColor: colors.success },
  btnDoneOut:    { borderWidth: 1.5, borderColor: colors.success, backgroundColor: 'transparent' },
  btnMissedFill: { backgroundColor: colors.danger },
  btnMissedOut:  { borderWidth: 1.5, borderColor: colors.danger, backgroundColor: 'transparent' },
  actionTxt:     { fontSize: 15, fontWeight: '600' },
});
