import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import api from '../lib/axios';

// ─── Colors ───────────────────────────────────────────────────────────────────
const COLORS = {
  bg:           '#0d0d1a',
  card:         '#111120',
  border:       '#1e1e2e',
  borderHover:  '#2a2a3a',
  primary:      '#7c3aed',
  textPrimary:  '#ffffff',
  textSecondary:'#888888',
  textMuted:    '#555555',
  success:      '#10b981',
  danger:       '#ef4444',
};

const DAYS_HEADER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

// ─── Helpers (outside component) ─────────────────────────────────────────────

function toDateStr(d) {
  return d.toISOString().split('T')[0];
}

function computeStreak(logs) {
  const today        = new Date();
  const todayS       = toDateStr(today);
  const yest         = new Date(today);
  yest.setDate(yest.getDate() - 1);
  const yesterdayS   = toDateStr(yest);
  const loggedDates  = new Set(logs.map((l) => l.date));

  if (!loggedDates.has(todayS) && !loggedDates.has(yesterdayS)) return 0;

  const startStr = loggedDates.has(todayS) ? todayS : yesterdayS;
  let streak = 0;
  const cur = new Date(startStr);
  while (true) {
    const ds = toDateStr(cur);
    if (loggedDates.has(ds)) {
      streak++;
      cur.setDate(cur.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function computeBestStreak(logs) {
  if (!logs.length) return 0;
  const dates = [...new Set(logs.map((l) => l.date))].sort();
  let best = 1, current = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);
    const diff = (curr - prev) / (1000 * 60 * 60 * 24);
    if (diff === 1) {
      current++;
      if (current > best) best = current;
    } else {
      current = 1;
    }
  }
  return best;
}

function buildCalendarDays(year, month, logs) {
  const logMap = {};
  logs.forEach((l) => { logMap[l.date] = l; });

  const firstDay = new Date(year, month, 1);
  let startOffset = firstDay.getDay() - 1; // Mon = 0
  if (startOffset < 0) startOffset = 6;   // Sunday edge-case

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayS = toDateStr(new Date());

  const cells = [];
  for (let i = 0; i < startOffset; i++) {
    cells.push({ empty: true, key: `e${i}` });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const mm  = String(month + 1).padStart(2, '0');
    const dd  = String(d).padStart(2, '0');
    const dateStr = `${year}-${mm}-${dd}`;
    cells.push({
      empty:    false,
      day:      d,
      dateStr,
      log:      logMap[dateStr] || null,
      isToday:  dateStr === todayS,
      isFuture: dateStr > todayS,
      key:      dateStr,
    });
  }
  return cells;
}

function chunkArray(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

function formatDayLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function CalendarScreen() {
  const [habits,          setHabits]          = useState([]);
  const [selectedHabitId, setSelectedHabitId] = useState(null);
  const [logs,            setLogs]            = useState([]);
  const [currentMonth,    setCurrentMonth]    = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [loading,         setLoading]         = useState(true);
  const [logsLoading,     setLogsLoading]     = useState(false);
  const [selectedDay,     setSelectedDay]     = useState(null); // dateStr
  const [showDayModal,    setShowDayModal]    = useState(false);
  const [actionLoading,   setActionLoading]   = useState(false);

  // Today's month/year for future-lock
  const now          = new Date();
  const todayYear    = now.getFullYear();
  const todayMonth   = now.getMonth();
  const curYear      = currentMonth.getFullYear();
  const curMonthIdx  = currentMonth.getMonth();
  const isCurrentMonth = curYear === todayYear && curMonthIdx === todayMonth;

  // ── Fetch habits on mount ──────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await api.get('/api/habits');
        const active = (res.data || []).filter((h) => h.isActive);
        setHabits(active);
        if (active.length > 0) setSelectedHabitId(active[0]._id);
      } catch (_) {}
      setLoading(false);
    })();
  }, []);

  // ── Fetch logs when selectedHabitId changes ────────────────────────────────
  const fetchLogs = useCallback(async (habitId) => {
    if (!habitId) return;
    setLogsLoading(true);
    try {
      const res = await api.get(`/api/logs/${habitId}`);
      setLogs(res.data || []);
    } catch (_) {
      setLogs([]);
    }
    setLogsLoading(false);
  }, []);

  useEffect(() => {
    fetchLogs(selectedHabitId);
  }, [selectedHabitId, fetchLogs]);

  // ── Month navigation ────────────────────────────────────────────────────────
  const goToPrevMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() - 1);
      return d;
    });
  }, []);

  const goToNextMonth = useCallback(() => {
    if (isCurrentMonth) return;
    setCurrentMonth((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + 1);
      return d;
    });
  }, [isCurrentMonth]);

  // ── Day tap ─────────────────────────────────────────────────────────────────
  const handleDayPress = useCallback((cell) => {
    if (cell.isFuture) return;
    setSelectedDay(cell.dateStr);
    setShowDayModal(true);
  }, []);

  // ── Log actions ─────────────────────────────────────────────────────────────
  const selectedDayLog = logs.find((l) => l.date === selectedDay) || null;

  const handleLogAction = useCallback(async (status) => {
    if (!selectedHabitId || !selectedDay) return;
    setActionLoading(true);
    try {
      if (selectedDayLog) {
        if (selectedDayLog.status === status) {
          // Toggle off
          await api.delete(`/api/logs/${selectedDayLog._id}`);
        } else {
          // Switch status
          await api.delete(`/api/logs/${selectedDayLog._id}`);
          await api.post('/api/logs', {
            habitId: selectedHabitId,
            date:    selectedDay,
            status,
          });
        }
      } else {
        await api.post('/api/logs', {
          habitId: selectedHabitId,
          date:    selectedDay,
          status,
        });
      }
      setShowDayModal(false);
      await fetchLogs(selectedHabitId);
    } catch (_) {}
    setActionLoading(false);
  }, [selectedHabitId, selectedDay, selectedDayLog, fetchLogs]);

  // ── Derived data ────────────────────────────────────────────────────────────
  const cells       = buildCalendarDays(curYear, curMonthIdx, logs);
  const rows        = chunkArray(cells, 7);
  const currentStreak  = computeStreak(logs);
  const bestStreak     = computeBestStreak(logs);
  const doneLogs       = logs.filter((l) => l.status === 'done');
  const totalLogged    = logs.length;
  const completionRate = totalLogged > 0
    ? Math.round((doneLogs.length / totalLogged) * 100)
    : 0;

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Section 1: Habit selector ── */}
        <Text style={styles.sectionLabel}>Select Habit</Text>
        {habits.length === 0 ? (
          <Text style={styles.noHabitsText}>
            No habits yet. Add from Dashboard.
          </Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.pillScroll}
            contentContainerStyle={styles.pillContainer}
          >
            {habits.map((h) => {
              const selected = h._id === selectedHabitId;
              return (
                <TouchableOpacity
                  key={h._id}
                  style={[styles.pill, selected && styles.pillSelected]}
                  activeOpacity={0.75}
                  onPress={() => setSelectedHabitId(h._id)}
                >
                  <Text style={[styles.pillText, selected && styles.pillTextSelected]}>
                    {h.icon} {h.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {selectedHabitId && (
          <>
            {/* ── Section 2: Month navigator ── */}
            <View style={styles.monthNav}>
              <TouchableOpacity
                onPress={goToPrevMonth}
                style={styles.monthArrow}
                activeOpacity={0.7}
              >
                <Text style={styles.monthArrowText}>{'<'}</Text>
              </TouchableOpacity>

              <Text style={styles.monthTitle}>
                {MONTH_NAMES[curMonthIdx]} {curYear}
              </Text>

              <TouchableOpacity
                onPress={goToNextMonth}
                style={[styles.monthArrow, isCurrentMonth && styles.monthArrowDisabled]}
                activeOpacity={isCurrentMonth ? 1 : 0.7}
                disabled={isCurrentMonth}
              >
                <Text style={[styles.monthArrowText, isCurrentMonth && styles.monthArrowTextDisabled]}>
                  {'>'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* ── Section 3: Calendar grid ── */}
            {logsLoading ? (
              <View style={styles.logsLoadingBox}>
                <ActivityIndicator color={COLORS.primary} />
              </View>
            ) : (
              <View style={styles.calendarBox}>
                {/* Day headers */}
                <View style={styles.dayHeaderRow}>
                  {DAYS_HEADER.map((d) => (
                    <Text key={d} style={styles.dayHeader}>{d}</Text>
                  ))}
                </View>

                {/* Day rows */}
                {rows.map((row, rowIdx) => (
                  <View key={rowIdx} style={styles.calRow}>
                    {row.map((cell) => {
                      if (cell.empty) {
                        return <View key={cell.key} style={styles.cellEmpty} />;
                      }

                      const { day, log, isToday, isFuture, dateStr } = cell;
                      const isDone   = log?.status === 'done';
                      const isMissed = log?.status === 'missed';

                      // Cell background
                      let cellBg = 'transparent';
                      if (isDone)           cellBg = COLORS.success;
                      else if (isMissed)    cellBg = COLORS.danger;
                      else if (!isFuture)   cellBg = COLORS.border; // past / today no log

                      // Border for today with no log
                      const todayBorder = isToday && !log;

                      // Text color
                      let textCol = COLORS.borderHover; // future — very dim
                      if (isDone || isMissed)  textCol = COLORS.textPrimary;
                      else if (isToday)         textCol = COLORS.primary;
                      else if (!isFuture)       textCol = COLORS.textMuted;

                      return (
                        <TouchableOpacity
                          key={cell.key}
                          style={[
                            styles.cell,
                            { backgroundColor: cellBg },
                            todayBorder && styles.cellTodayBorder,
                            (isToday && (isDone || isMissed)) && styles.cellTodayRing,
                          ]}
                          activeOpacity={isFuture ? 1 : 0.7}
                          onPress={() => !isFuture && handleDayPress(cell)}
                          disabled={isFuture}
                        >
                          <Text style={[styles.cellText, { color: textCol }]}>
                            {day}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                    {/* Pad row to 7 if last row is short */}
                    {row.length < 7 &&
                      Array(7 - row.length)
                        .fill(null)
                        .map((_, i) => (
                          <View key={`pad${i}`} style={styles.cellEmpty} />
                        ))}
                  </View>
                ))}
              </View>
            )}

            {/* ── Section 4: Stats row ── */}
            <View style={styles.statsBox}>
              {/* Top-left */}
              <View style={[styles.statCell, styles.statBorderRight, styles.statBorderBottom]}>
                <Text style={styles.statNumber}>{currentStreak}</Text>
                <Text style={styles.statLabel}>🔥 Current Streak</Text>
              </View>
              {/* Top-right */}
              <View style={[styles.statCell, styles.statBorderBottom]}>
                <Text style={styles.statNumber}>{bestStreak}</Text>
                <Text style={styles.statLabel}>⭐ Best Streak</Text>
              </View>
              {/* Bottom-left */}
              <View style={[styles.statCell, styles.statBorderRight]}>
                <Text style={styles.statNumber}>{completionRate}%</Text>
                <Text style={styles.statLabel}>✅ Completion</Text>
              </View>
              {/* Bottom-right */}
              <View style={styles.statCell}>
                <Text style={styles.statNumber}>{doneLogs.length}</Text>
                <Text style={styles.statLabel}>📅 Total Done</Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* ── Day Log Modal ── */}
      <Modal
        visible={showDayModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDayModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalDateTitle}>
                {selectedDay ? formatDayLabel(selectedDay) : ''}
              </Text>
              <TouchableOpacity
                onPress={() => setShowDayModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Current status */}
            {selectedDayLog && (
              <Text style={[
                styles.currentStatus,
                { color: selectedDayLog.status === 'done' ? COLORS.success : COLORS.danger },
              ]}>
                Currently:{' '}
                {selectedDayLog.status === 'done' ? '✓ Done' : '✗ Missed'}
              </Text>
            )}

            {/* Action buttons */}
            <View style={styles.modalActions}>
              {/* Done */}
              <TouchableOpacity
                style={[
                  styles.modalActionBtn,
                  selectedDayLog?.status === 'done'
                    ? styles.modalBtnDoneFilled
                    : styles.modalBtnDoneOutline,
                ]}
                activeOpacity={0.8}
                onPress={() => handleLogAction('done')}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color={COLORS.textPrimary} />
                ) : (
                  <Text style={[
                    styles.modalActionText,
                    { color: selectedDayLog?.status === 'done' ? COLORS.textPrimary : COLORS.success },
                  ]}>
                    ✓ Done
                  </Text>
                )}
              </TouchableOpacity>

              {/* Missed */}
              <TouchableOpacity
                style={[
                  styles.modalActionBtn,
                  selectedDayLog?.status === 'missed'
                    ? styles.modalBtnMissedFilled
                    : styles.modalBtnMissedOutline,
                ]}
                activeOpacity={0.8}
                onPress={() => handleLogAction('missed')}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color={COLORS.textPrimary} />
                ) : (
                  <Text style={[
                    styles.modalActionText,
                    { color: selectedDayLog?.status === 'missed' ? COLORS.textPrimary : COLORS.danger },
                  ]}>
                    ✗ Missed
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    paddingTop: 16,
  },

  // ── Habit selector ──
  sectionLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 8,
  },
  noHabitsText: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 40,
  },
  pillScroll: {
    flexGrow: 0,
  },
  pillContainer: {
    paddingBottom: 4,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pillSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  pillText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  pillTextSelected: {
    color: COLORS.textPrimary,
    fontWeight: '600',
  },

  // ── Month navigator ──
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  monthArrow: {
    padding: 8,
  },
  monthArrowDisabled: {
    opacity: 0.3,
  },
  monthArrowText: {
    color: COLORS.primary,
    fontSize: 22,
    fontWeight: '700',
  },
  monthArrowTextDisabled: {
    color: COLORS.primary,
  },
  monthTitle: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },

  // ── Calendar ──
  calendarBox: {
    marginBottom: 4,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dayHeader: {
    flex: 1,
    color: COLORS.textMuted,
    fontSize: 11,
    textAlign: 'center',
    paddingVertical: 4,
  },
  calRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    margin: 2,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellEmpty: {
    flex: 1,
    aspectRatio: 1,
    margin: 2,
  },
  cellTodayBorder: {
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: 'transparent',
  },
  cellTodayRing: {
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  cellText: {
    fontSize: 13,
    fontWeight: '500',
  },
  logsLoadingBox: {
    paddingVertical: 48,
    alignItems: 'center',
  },

  // ── Stats ──
  statsBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    marginTop: 20,
    overflow: 'hidden',
  },
  statCell: {
    width: '50%',
    paddingVertical: 16,
    alignItems: 'center',
  },
  statBorderRight: {
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  statBorderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statNumber: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '700',
  },
  statLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },

  // ── Day Modal ──
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalDateTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  modalClose: {
    color: COLORS.textMuted,
    fontSize: 20,
  },
  currentStatus: {
    fontSize: 13,
    marginTop: 12,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalActionBtn: {
    flex: 1,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnDoneFilled: {
    backgroundColor: COLORS.success,
  },
  modalBtnDoneOutline: {
    borderWidth: 1.5,
    borderColor: COLORS.success,
    backgroundColor: 'transparent',
  },
  modalBtnMissedFilled: {
    backgroundColor: COLORS.danger,
  },
  modalBtnMissedOutline: {
    borderWidth: 1.5,
    borderColor: COLORS.danger,
    backgroundColor: 'transparent',
  },
  modalActionText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
