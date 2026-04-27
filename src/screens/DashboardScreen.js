import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  RefreshControl,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Animated,
} from 'react-native';
import api from '../lib/axios';

// ─── Color constants ──────────────────────────────────────────────────────────
const COLORS = {
  bg:            '#0d0d1a',
  card:          '#111120',
  border:        '#1e1e2e',
  borderHover:   '#2a2a3a',
  primary:       '#7c3aed',
  textPrimary:   '#ffffff',
  textSecondary: '#888888',
  textMuted:     '#555555',
  success:       '#10b981',
  danger:        '#ef4444',
};

// ─── Emoji / color pickers ────────────────────────────────────────────────────
const EMOJI_OPTIONS = [
  '💧','🏃','📚','🧘','💪','🥗',
  '😴','☀️','✍️','🎯','🎨','🚫',
];
const COLOR_OPTIONS = [
  '#10b981','#7c3aed','#ef4444','#f59e0b',
  '#3b82f6','#ec4899','#14b8a6','#f97316',
];
const PERIOD_OPTIONS = [30, 60, 90];

// ─── Helper: streak calculation ───────────────────────────────────────────────
function computeStreak(logs) {
  const today = new Date();
  const toDateStr = (d) => d.toISOString().split('T')[0];
  const todayStr     = toDateStr(today);
  const yest         = new Date(today);
  yest.setDate(yest.getDate() - 1);
  const yesterdayStr = toDateStr(yest);

  const loggedDates = new Set(logs.map((l) => l.date));

  if (!loggedDates.has(todayStr) && !loggedDates.has(yesterdayStr)) return 0;

  const startDateStr = loggedDates.has(todayStr) ? todayStr : yesterdayStr;

  let streak = 0;
  const cur = new Date(startDateStr);
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

// ─── Helper: greeting ─────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ─── Helper: today YYYY-MM-DD ─────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// ─── Helper: formatted date "Tuesday, 27 April" ───────────────────────────────
function formattedDate() {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function DashboardScreen({ navigation }) {
  const [habits,      setHabits]      = useState([]);
  const [habitLogs,   setHabitLogs]   = useState({}); // { [habitId]: { allLogs, todayLog } }
  const [profile,     setProfile]     = useState({ name: '', email: '' });
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [showAddModal,setShowAddModal]= useState(false);
  const [newHabit,    setNewHabit]    = useState({
    name: '', icon: '💧', colorHex: '#10b981', trackingPeriod: 30,
  });
  const [creating,    setCreating]    = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;

  // ── Fetch all data ──────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      const [habitsRes, profileRes] = await Promise.all([
        api.get('/api/habits'),
        api.get('/api/user/profile'),
      ]);

      const activeHabits = (habitsRes.data || []).filter((h) => h.isActive);
      setHabits(activeHabits);
      setProfile(profileRes.data || { name: '', email: '' });

      // Fetch all logs in parallel
      const logResults = await Promise.all(
        activeHabits.map((h) =>
          api.get(`/api/logs/${h._id}`).then((r) => ({
            habitId: h._id,
            logs: r.data || [],
          })),
        ),
      );

      const logsMap = {};
      const today   = todayStr();
      for (const { habitId, logs } of logResults) {
        const todayLog = logs.find((l) => l.date === today) || null;
        logsMap[habitId] = { allLogs: logs, todayLog };
      }
      setHabitLogs(logsMap);
    } catch (err) {
      Alert.alert('Error', 'Failed to load dashboard. Please refresh.');
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchAll();
      setLoading(false);
    })();
  }, [fetchAll]);

  // Animate progress bar when habits/logs change
  useEffect(() => {
    if (!habits.length) { progressAnim.setValue(0); return; }
    const done = habits.filter((h) => habitLogs[h._id]?.todayLog?.status === 'done').length;
    Animated.timing(progressAnim, {
      toValue: done / habits.length,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [habits, habitLogs, progressAnim]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [fetchAll]);

  // ── Refresh single habit's logs ─────────────────────────────────────────────
  const refreshHabitLogs = useCallback(async (habitId) => {
    try {
      const res  = await api.get(`/api/logs/${habitId}`);
      const logs = res.data || [];
      const today = todayStr();
      const todayLog = logs.find((l) => l.date === today) || null;
      setHabitLogs((prev) => ({
        ...prev,
        [habitId]: { allLogs: logs, todayLog },
      }));
    } catch (_) {}
  }, []);

  // ── Log action ──────────────────────────────────────────────────────────────
  const handleLogAction = useCallback(
    async (habit, status) => {
      const entry    = habitLogs[habit._id] || { allLogs: [], todayLog: null };
      const todayLog = entry.todayLog;

      try {
        if (todayLog) {
          if (todayLog.status === status) {
            // Toggle off → DELETE
            await api.delete(`/api/logs/${todayLog._id}`);
          } else {
            // Switch status → DELETE old + POST new
            await api.delete(`/api/logs/${todayLog._id}`);
            await api.post('/api/logs', {
              habitId: habit._id,
              date:    todayStr(),
              status,
            });
          }
        } else {
          // No log yet → POST
          await api.post('/api/logs', {
            habitId: habit._id,
            date:    todayStr(),
            status,
          });
        }
        await refreshHabitLogs(habit._id);
      } catch (err) {
        Alert.alert('Error', 'Failed to update log. Please try again.');
      }
    },
    [habitLogs, refreshHabitLogs],
  );

  // ── Create habit ────────────────────────────────────────────────────────────
  const handleCreateHabit = useCallback(async () => {
    if (!newHabit.name.trim()) {
      Alert.alert('Required', 'Please enter a habit name.');
      return;
    }
    setCreating(true);
    try {
      await api.post('/api/habits', {
        name:           newHabit.name.trim(),
        icon:           newHabit.icon,
        colorHex:       newHabit.colorHex,
        trackingPeriod: newHabit.trackingPeriod,
      });
      setShowAddModal(false);
      setNewHabit({ name: '', icon: '💧', colorHex: '#10b981', trackingPeriod: 30 });
      await fetchAll();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to create habit.');
    } finally {
      setCreating(false);
    }
  }, [newHabit, fetchAll]);

  // ── Derived stats ───────────────────────────────────────────────────────────
  const statsDone   = habits.filter((h) => habitLogs[h._id]?.todayLog?.status === 'done').length;
  const statsMissed = habits.filter((h) => habitLogs[h._id]?.todayLog?.status === 'missed').length;
  const firstName   = profile.name ? profile.name.split(' ')[0] : 'there';
  const initial     = profile.name ? profile.name[0].toUpperCase() : '?';

  // ── Week data ───────────────────────────────────────────────────────────────
  const MONTH_S = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DAY_LABELS = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
  const nowDate = new Date();
  const dow = nowDate.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(nowDate);
  monday.setDate(nowDate.getDate() + mondayOffset);
  const todayISO = todayStr();
  const weekData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const ds = d.toISOString().split('T')[0];
    const isToday = ds === todayISO;
    const isFuture = ds > todayISO;
    const habitStatuses = habits.map((h) => {
      const logs = habitLogs[h._id]?.allLogs || [];
      const log = logs.find((l) => l.date === ds);
      return { habitId: h._id, colorHex: h.colorHex || COLORS.primary, status: log?.status || null };
    });
    return { date: ds, dayLabel: DAY_LABELS[i], dayNum: d.getDate(), isToday, isFuture, habitStatuses };
  });
  const todayDay = weekData.find((d) => d.isToday);
  const weekDoneToday    = todayDay?.habitStatuses.filter((s) => s.status === 'done').length || 0;
  const weekMissedToday  = todayDay?.habitStatuses.filter((s) => s.status === 'missed').length || 0;
  const weekPendingToday = habits.length - weekDoneToday - weekMissedToday;
  const bestDayIdx = weekData.reduce((bi, day, idx) => {
    const cnt = day.habitStatuses.filter((s) => s.status === 'done').length;
    const best = weekData[bi].habitStatuses.filter((s) => s.status === 'done').length;
    return cnt > best ? idx : bi;
  }, 0);
  const bestDayLabel = DAY_LABELS[bestDayIdx];
  const lastDay = new Date(monday); lastDay.setDate(monday.getDate() + 6);
  const weekRange = `${MONTH_S[monday.getMonth()]} ${monday.getDate()} — ${MONTH_S[lastDay.getMonth()]} ${lastDay.getDate()}`;

  // ─── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* ── Section 1: Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.dateText}>{formattedDate()}</Text>
            <Text style={styles.greetingText}>
              {getGreeting()}, {firstName} 🔥
            </Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
        </View>

        {/* ── Section 2: Stats bar ── */}
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{habits.length}</Text>
            <Text style={styles.statLabel}>Today</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: COLORS.success }]}>
              {statsDone}
            </Text>
            <Text style={styles.statLabel}>Done</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: COLORS.danger }]}>
              {statsMissed}
            </Text>
            <Text style={styles.statLabel}>Missed</Text>
          </View>
        </View>

        {/* ── Progress bar ── */}
        {habits.length > 0 && (
          <View style={styles.progressSection}>
            <View style={styles.progressHeaderRow}>
              <Text style={styles.progressLabel}>DAILY PROGRESS</Text>
              <Text style={styles.progressCount}>{statsDone}/{habits.length} done</Text>
            </View>
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, {
                width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
              }]} />
            </View>
          </View>
        )}

        {/* ── This Week ── */}
        {habits.length > 0 && (
          <View style={styles.weekSection}>
            <View style={styles.weekHeader}>
              <Text style={styles.weekTitle}>This Week</Text>
              <Text style={styles.weekRange}>{weekRange}</Text>
            </View>
            <View style={styles.weekCard}>
              <View style={styles.weekGrid}>
                {weekData.map((day) => (
                  <View key={day.date} style={styles.weekCol}>
                    <Text style={styles.weekDayLabel}>{day.dayLabel}</Text>
                    <Text style={[styles.weekDayNum, day.isToday && styles.weekDayNumToday]}>
                      {day.dayNum}
                    </Text>
                    <View style={styles.weekDots}>
                      {day.habitStatuses.map((hs) => (
                        <View
                          key={hs.habitId}
                          style={[styles.weekDot, {
                            backgroundColor: day.isFuture
                              ? COLORS.border
                              : hs.status === 'done'
                              ? hs.colorHex
                              : hs.status === 'missed'
                              ? COLORS.danger
                              : '#2a2a3a',
                            opacity: day.isFuture ? 0.3 : 1,
                          }]}
                        />
                      ))}
                    </View>
                  </View>
                ))}
              </View>
              <View style={styles.weekSummaryRow}>
                <Text style={styles.weekSumDone}>✓ {weekDoneToday} done</Text>
                <Text style={styles.weekSumMissed}>  ✗ {weekMissedToday} missed</Text>
                <Text style={styles.weekSumPending}>  ○ {weekPendingToday} pending</Text>
              </View>
              {weekDoneToday > 0 && (
                <Text style={styles.weekBestDay}>🔥 Best day this week: {bestDayLabel}</Text>
              )}
            </View>
          </View>
        )}

        {/* ── Habit cards or empty state ── */}
        {habits.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyTitle}>No habits yet</Text>
            <Text style={styles.emptySub}>
              Add your first habit to start your streak
            </Text>
            <TouchableOpacity
              style={styles.emptyAddBtn}
              activeOpacity={0.85}
              onPress={() => setShowAddModal(true)}
            >
              <Text style={styles.emptyAddBtnText}>＋ Add your first habit</Text>
            </TouchableOpacity>
          </View>
        ) : (
          habits.map((habit) => {
            const entry    = habitLogs[habit._id] || { allLogs: [], todayLog: null };
            const todayLog = entry.todayLog;
            const streak   = computeStreak(entry.allLogs);
            const isDone   = todayLog?.status === 'done';
            const isMissed = todayLog?.status === 'missed';

            return (
              <View key={habit._id} style={styles.habitCard}>
                {/* Color accent bar */}
                <View
                  style={[
                    styles.accentBar,
                    { backgroundColor: habit.colorHex || COLORS.primary },
                  ]}
                />

                {/* Middle content */}
                <View style={styles.habitMiddle}>
                  <View style={styles.habitNameRow}>
                    <Text style={styles.habitIcon}>{habit.icon}</Text>
                    <Text style={styles.habitName} numberOfLines={1}>
                      {habit.name}
                    </Text>
                  </View>
                  <View style={styles.habitStreakRow}>
                    {streak > 0 ? (
                      <>
                        <Text style={styles.streakFire}>🔥</Text>
                        <Text style={styles.streakText}>
                          {streak} day streak
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.streakZero}>
                        Start your streak today
                      </Text>
                    )}
                  </View>
                </View>

                {/* Action buttons */}
                <View style={styles.habitActions}>
                  {/* Done */}
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      isDone && styles.actionBtnDone,
                    ]}
                    activeOpacity={0.75}
                    onPress={() => handleLogAction(habit, 'done')}
                  >
                    <Text
                      style={[
                        styles.actionBtnText,
                        isDone && styles.actionBtnTextActive,
                      ]}
                    >
                      ✓
                    </Text>
                  </TouchableOpacity>

                  {/* Missed */}
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      isMissed && styles.actionBtnMissed,
                    ]}
                    activeOpacity={0.75}
                    onPress={() => handleLogAction(habit, 'missed')}
                  >
                    <Text
                      style={[
                        styles.actionBtnText,
                        isMissed && styles.actionBtnTextActive,
                      ]}
                    >
                      ✗
                    </Text>
                  </TouchableOpacity>

                  {/* Note */}
                  <TouchableOpacity
                    style={styles.iconBtn}
                    activeOpacity={0.75}
                    onPress={() => Alert.alert('Coming Soon', 'Journal coming soon')}
                  >
                    <Text style={styles.iconBtnText}>📝</Text>
                  </TouchableOpacity>

                  {/* Calendar */}
                  <TouchableOpacity
                    style={styles.iconBtn}
                    activeOpacity={0.75}
                    onPress={() => navigation.navigate('Calendar')}
                  >
                    <Text style={styles.iconBtnText}>📅</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ── Section 5: Floating add button ── */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => setShowAddModal(true)}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* ── Add Habit Modal ── */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            {/* Sheet header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Habit</Text>
              <TouchableOpacity
                onPress={() => setShowAddModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* 1. Habit name */}
              <Text style={styles.fieldLabel}>What habit?</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="e.g. Cold shower"
                placeholderTextColor={COLORS.textMuted}
                value={newHabit.name}
                onChangeText={(v) => setNewHabit((p) => ({ ...p, name: v }))}
                fontSize={16}
              />

              {/* 2. Emoji picker */}
              <Text style={styles.fieldLabel}>Pick an icon</Text>
              <View style={styles.emojiGrid}>
                {EMOJI_OPTIONS.map((em) => (
                  <TouchableOpacity
                    key={em}
                    style={[
                      styles.emojiOption,
                      newHabit.icon === em && styles.emojiOptionSelected,
                    ]}
                    activeOpacity={0.7}
                    onPress={() => setNewHabit((p) => ({ ...p, icon: em }))}
                  >
                    <Text style={styles.emojiOptionText}>{em}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* 3. Color picker */}
              <Text style={styles.fieldLabel}>Choose color</Text>
              <View style={styles.colorRow}>
                {COLOR_OPTIONS.map((hex) => (
                  <TouchableOpacity
                    key={hex}
                    style={[
                      styles.colorCircle,
                      { backgroundColor: hex },
                      newHabit.colorHex === hex && styles.colorCircleSelected,
                    ]}
                    activeOpacity={0.8}
                    onPress={() => setNewHabit((p) => ({ ...p, colorHex: hex }))}
                  />
                ))}
              </View>

              {/* 4. Tracking period */}
              <Text style={styles.fieldLabel}>Track for</Text>
              <View style={styles.periodRow}>
                {PERIOD_OPTIONS.map((days) => (
                  <TouchableOpacity
                    key={days}
                    style={[
                      styles.periodPill,
                      newHabit.trackingPeriod === days && styles.periodPillSelected,
                    ]}
                    activeOpacity={0.75}
                    onPress={() =>
                      setNewHabit((p) => ({ ...p, trackingPeriod: days }))
                    }
                  >
                    <Text
                      style={[
                        styles.periodPillText,
                        newHabit.trackingPeriod === days &&
                          styles.periodPillTextSelected,
                      ]}
                    >
                      {days} days
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* 5. Create button */}
              <TouchableOpacity
                style={[styles.createBtn, creating && { opacity: 0.6 }]}
                activeOpacity={0.85}
                onPress={handleCreateHabit}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color={COLORS.textPrimary} />
                ) : (
                  <Text style={styles.createBtnText}>Create Habit 🔥</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
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

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    paddingTop: 16,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  dateText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  greetingText: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    marginTop: 2,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },

  // ── Stats bar ──
  statsBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: COLORS.border,
    marginHorizontal: 4,
  },

  // ── Habit card ──
  habitCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
    overflow: 'hidden',
    alignItems: 'center',
  },
  accentBar: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 2,
    marginRight: 14,
  },
  habitMiddle: {
    flex: 1,
    paddingVertical: 16,
  },
  habitNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  habitIcon: {
    fontSize: 22,
  },
  habitName: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 10,
    flexShrink: 1,
  },
  habitStreakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  streakFire: {
    fontSize: 12,
  },
  streakText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  streakZero: {
    color: COLORS.textMuted,
    fontSize: 12,
  },

  // Action buttons
  habitActions: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 14,
    paddingVertical: 16,
  },
  actionBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnDone: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  actionBtnMissed: {
    backgroundColor: COLORS.danger,
    borderColor: COLORS.danger,
  },
  actionBtnText: {
    color: COLORS.textMuted,
    fontSize: 16,
    fontWeight: '700',
  },
  actionBtnTextActive: {
    color: COLORS.textPrimary,
  },

  // ── Empty state ──
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyEmoji: {
    fontSize: 48,
    textAlign: 'center',
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },
  emptySub: {
    color: COLORS.textMuted,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  emptyAddBtn: {
    marginTop: 24,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  emptyAddBtnText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },

  // ── FAB ──
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 8,
  },
  fabText: {
    color: COLORS.textPrimary,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '400',
  },

  // ── Modal ──
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
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  modalClose: {
    color: COLORS.textSecondary,
    fontSize: 18,
  },

  // Form fields
  fieldLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 8,
    marginTop: 16,
  },
  fieldInput: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    height: 50,
    paddingHorizontal: 16,
    color: COLORS.textPrimary,
    fontSize: 16,
  },

  // Emoji grid
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  emojiOption: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(124,58,237,0.2)',
  },
  emojiOptionText: {
    fontSize: 22,
  },

  // Color row
  colorRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  colorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  colorCircleSelected: {
    borderWidth: 2.5,
    borderColor: COLORS.textPrimary,
    transform: [{ scale: 1.15 }],
  },

  // Period pills
  periodRow: {
    flexDirection: 'row',
    gap: 10,
  },
  periodPill: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodPillSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  periodPillText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  periodPillTextSelected: {
    color: COLORS.textPrimary,
    fontWeight: '600',
  },

  // Create button
  createBtn: {
    width: '100%',
    height: 52,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  createBtnText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },

  // ── Progress bar ──
  progressSection: {
    marginBottom: 20,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
  },
  progressCount: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },

  // ── This Week ──
  weekSection: {
    marginBottom: 20,
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  weekTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  weekRange: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  weekCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },
  weekGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  weekCol: {
    flex: 1,
    alignItems: 'center',
  },
  weekDayLabel: {
    color: COLORS.textMuted,
    fontSize: 9,
    textAlign: 'center',
    marginBottom: 4,
  },
  weekDayNum: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 6,
  },
  weekDayNumToday: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  weekDots: {
    alignItems: 'center',
  },
  weekDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 2,
  },
  weekSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
    marginTop: 4,
  },
  weekSumDone: {
    color: COLORS.success,
    fontSize: 11,
    fontWeight: '500',
  },
  weekSumMissed: {
    color: COLORS.danger,
    fontSize: 11,
    fontWeight: '500',
  },
  weekSumPending: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  weekBestDay: {
    color: COLORS.textMuted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 6,
  },

  // ── Icon buttons (📝 📅) ──
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: {
    fontSize: 16,
    textAlign: 'center',
  },
});
