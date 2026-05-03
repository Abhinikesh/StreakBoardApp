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
  StatusBar,
  Animated,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import api from '../lib/axios';
import { playTickSound, playCrossSound } from '../lib/sound';
import { useTheme } from '../context/ThemeContext';



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

const HABIT_SUGGESTIONS = [
  { name: 'DSA Practice',    icon: '💻' },
  { name: 'Morning Run',     icon: '🏃' },
  { name: 'Read Books',      icon: '📚' },
  { name: 'Meditation',      icon: '🧘' },
  { name: 'Gym Workout',     icon: '💪' },
  { name: 'Cold Shower',     icon: '🚿' },
  { name: 'No Junk Food',    icon: '🥗' },
  { name: 'Sleep by 11',     icon: '😴' },
  { name: 'LeetCode',        icon: '🎯' },
  { name: 'GitHub Commit',   icon: '👨‍💻' },
  { name: 'No Social Media', icon: '🚫' },
  { name: 'Drink Water',     icon: '💧' },
  { name: 'Journal',         icon: '✍️' },
  { name: 'Learn Skills',    icon: '🎨' },
];

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

// ─── Helper: short date "Tue, 28 Apr" ────────────────────────────────────────
function shortDate() {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

// ─── Retry helper ───────────────────────────────────────────────────────────
async function apiWithRetry(fn, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); }
    catch (err) {
      if (i === retries) throw err;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function DashboardScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [habits,      setHabits]      = useState([]);
  const [habitLogs,   setHabitLogs]   = useState({}); // { [habitId]: { allLogs, todayLog } }
  const [profile,     setProfile]     = useState({ name: '', email: '' });
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [showAddModal,setShowAddModal]= useState(false);
  const [newHabit,    setNewHabit]    = useState({
    name: '', icon: '💧', colorHex: '#10b981', trackingPeriod: 30,
  });
  const [creating,          setCreating]          = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);
  const [showNoteModal,      setShowNoteModal]      = useState(false);
  const [noteModalHabit,     setNoteModalHabit]     = useState(null);
  const [noteText,           setNoteText]           = useState('');
  const [noteSaving,         setNoteSaving]         = useState(false);
  const [noteFocused,        setNoteFocused]        = useState(false);
  const [customDays,         setCustomDays]         = useState('');
  const [showCustomInput,    setShowCustomInput]    = useState(false);
  const [soundEnabled,       setSoundEnabled]       = useState(true);
  const [userAvatar,         setUserAvatar]         = useState(null);
  const [showNoteSuccess,    setShowNoteSuccess]    = useState(false);
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

  // Reload avatar and sound preference every time this screen is focused
  useFocusEffect(useCallback(() => {
    // Re-read soundEnabled so toggling it in ProfileScreen takes effect immediately
    AsyncStorage.getItem('soundEnabled').then((val) => {
      setSoundEnabled(val !== 'false'); // default true
    }).catch(() => {});

    SecureStore.getItemAsync('user_cache').then((raw) => {
      if (raw) {
        try { setUserAvatar(JSON.parse(raw).avatar || null); } catch (_) {}
      }
    }).catch(() => {});
  }, []));

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
            await apiWithRetry(() => api.delete(`/api/logs/${todayLog._id}`));
          } else {
            // Switch status → DELETE old + POST new
            await apiWithRetry(() => api.delete(`/api/logs/${todayLog._id}`));
            await apiWithRetry(() => api.post('/api/logs', {
              habitId: habit._id,
              date:    todayStr(),
              status,
            }));
          }
        } else {
          // No log yet → POST
          await apiWithRetry(() => api.post('/api/logs', {
            habitId: habit._id,
            date:    todayStr(),
            status,
          }));
        }
        await refreshHabitLogs(habit._id);
        // Play sound after successful log
        if (status === 'done')   playTickSound(soundEnabled).catch(() => {});
        if (status === 'missed') playCrossSound(soundEnabled).catch(() => {});
      } catch (err) {
        Alert.alert('Error', 'Failed to update log. Please try again.');
      }
    },
    [habitLogs, refreshHabitLogs, soundEnabled],
  );

  // ── Create habit ────────────────────────────────────────────────────────────
  const handleCreateHabit = useCallback(async () => {
    if (!newHabit.name.trim()) {
      Alert.alert('Required', 'Please enter a habit name.');
      return;
    }
    const finalDays = showCustomInput ? (parseInt(customDays) || 0) : newHabit.trackingPeriod;
    if (!finalDays || isNaN(finalDays) || finalDays < 1 || finalDays > 365) {
      Alert.alert('Invalid', 'Please enter valid days (1–365)');
      return;
    }
    setCreating(true);
    try {
      await api.post('/api/habits', {
        name:           newHabit.name.trim(),
        icon:           newHabit.icon,
        colorHex:       newHabit.colorHex,
        trackingPeriod: finalDays,
      });
      setShowAddModal(false);
      setSelectedSuggestion(null);
      setNewHabit({ name: '', icon: '💧', colorHex: '#10b981', trackingPeriod: 30 });
      setCustomDays('');
      setShowCustomInput(false);
      await fetchAll();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to create habit.');
    } finally {
      setCreating(false);
    }
  }, [newHabit, fetchAll, showCustomInput, customDays]);

  // ── Save note ──────────────────────────────────────────────────────────────
  const handleSaveNote = useCallback(async () => {
    if (!noteModalHabit) return;
    const todayLog = habitLogs[noteModalHabit._id]?.todayLog;
    const noteKey  = `note_${noteModalHabit._id}_${todayStr()}`;
    setNoteSaving(true);
    try {
      // Try API first (requires a log to exist)
      if (todayLog) {
        await api.put(`/api/logs/${todayLog._id}/note`, { note: noteText.trim() });
        await refreshHabitLogs(noteModalHabit._id);
      } else {
        // No log yet → save locally so note isn't lost
        await AsyncStorage.setItem(noteKey, noteText.trim());
      }
      setShowNoteModal(false);
      setNoteText('');
      setNoteModalHabit(null);
    } catch (_) {
      // API failed → fall back to AsyncStorage silently
      try {
        await AsyncStorage.setItem(noteKey, noteText.trim());
        setShowNoteModal(false);
        setNoteText('');
        setNoteModalHabit(null);
        setShowNoteSuccess(true);
        setTimeout(() => setShowNoteSuccess(false), 2000);
      } catch (__) {
        Alert.alert('Error', 'Could not save note.');
      }
    } finally {
      setNoteSaving(false);
    }
  }, [habitLogs, noteModalHabit, noteText, refreshHabitLogs]);

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
      return { habitId: h._id, colorHex: h.colorHex || colors.primary, status: log?.status || null };
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
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      {/* ── Navbar — pinned outside ScrollView ── */}
      <View style={styles.navbar}>
        <Text style={styles.navbarBrand}>🔥 StreakBoard</Text>
        <Text style={styles.navbarDate}>{shortDate()}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
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
          <TouchableOpacity
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.85}
          >
            {userAvatar ? (
              <Image
                source={{ uri: userAvatar }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Section 2: Stats bar ── */}
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{habits.length}</Text>
            <Text style={styles.statLabel}>Today</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: colors.success }]}>
              {statsDone}
            </Text>
            <Text style={styles.statLabel}>Done</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: colors.danger }]}>
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
                              ? colors.border
                              : hs.status === 'done'
                              ? hs.colorHex
                              : hs.status === 'missed'
                              ? colors.danger
                              : colors.borderHover,
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
                    { backgroundColor: habit.colorHex || colors.primary },
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
                    onPress={async () => {
                      const todayLog = habitLogs[habit._id]?.todayLog;
                      // Load note: prefer today's log note, fall back to AsyncStorage
                      let savedNote = todayLog?.note || '';
                      if (!savedNote) {
                        try {
                          const local = await AsyncStorage.getItem(`note_${habit._id}_${todayStr()}`);
                          if (local) savedNote = local;
                        } catch (_) {}
                      }
                      setNoteText(savedNote);
                      setNoteModalHabit(habit);
                      setShowNoteModal(true);
                    }}
                  >
                    <Text style={styles.iconBtnText}>📝</Text>
                  </TouchableOpacity>

                  {/* Calendar */}
                  <TouchableOpacity
                    style={styles.iconBtn}
                    activeOpacity={0.75}
                    onPress={() => navigation.navigate('Calendar', { habitId: habit._id })}
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
        onRequestClose={() => { setShowAddModal(false); setSelectedSuggestion(null); setCustomDays(''); setShowCustomInput(false); }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            {/* Sheet header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Habit</Text>
              <TouchableOpacity
                onPress={() => { setShowAddModal(false); setSelectedSuggestion(null); setCustomDays(''); setShowCustomInput(false); }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* 1. Habit name */}
              <Text style={styles.fieldLabel}>What habit?</Text>
              <Text style={styles.suggestionsLabel}>Quick add:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                style={styles.suggestionsScroll} contentContainerStyle={{ paddingBottom: 8 }}>
                {HABIT_SUGGESTIONS.map((s) => {
                  const isSelected = selectedSuggestion === s.name;
                  return (
                    <TouchableOpacity
                      key={s.name}
                      style={[styles.suggestionChip, isSelected && styles.suggestionChipSelected]}
                      onPress={() => {
                        setSelectedSuggestion(s.name);
                        setNewHabit((p) => ({ ...p, name: s.name, icon: s.icon }));
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.suggestionChipText, isSelected && styles.suggestionChipTextSelected]}>
                        {s.icon} {s.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <TextInput
                style={styles.fieldInput}
                placeholder="e.g. Cold shower"
                placeholderTextColor={colors.textMuted}
                value={newHabit.name}
                onChangeText={(v) => setNewHabit((p) => ({ ...p, name: v }))}
                fontSize={16}
                maxLength={60}
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
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {[30, 60, 90].map((days) => (
                  <TouchableOpacity
                    key={days}
                    onPress={() => { setNewHabit((p) => ({ ...p, trackingPeriod: days })); setShowCustomInput(false); setCustomDays(''); }}
                    style={{
                      paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20,
                      backgroundColor: newHabit.trackingPeriod === days && !showCustomInput
                        ? '#7C3AED' : 'transparent',
                      borderWidth: 1.5,
                      borderColor: newHabit.trackingPeriod === days && !showCustomInput
                        ? '#7C3AED' : '#D1D5DB',
                    }}
                  >
                    <Text style={{
                      color: newHabit.trackingPeriod === days && !showCustomInput ? 'white' : '#6B7280',
                      fontWeight: '600',
                    }}>{days} days</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  onPress={() => { setShowCustomInput(true); setNewHabit((p) => ({ ...p, trackingPeriod: 0 })); }}
                  style={{
                    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20,
                    backgroundColor: showCustomInput ? '#7C3AED' : 'transparent',
                    borderWidth: 1.5,
                    borderColor: showCustomInput ? '#7C3AED' : '#D1D5DB',
                  }}
                >
                  <Text style={{ color: showCustomInput ? 'white' : '#6B7280', fontWeight: '600' }}>Custom</Text>
                </TouchableOpacity>
              </View>

              {showCustomInput && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <TextInput
                    keyboardType="number-pad"
                    placeholder="Enter days (e.g. 45)"
                    placeholderTextColor="#9CA3AF"
                    value={customDays}
                    onChangeText={(val) => {
                      setCustomDays(val);
                      const num = parseInt(val);
                      if (num > 0 && num <= 365) setNewHabit((p) => ({ ...p, trackingPeriod: num }));
                    }}
                    style={{
                      flex: 1, borderWidth: 1.5, borderColor: '#7C3AED',
                      borderRadius: 12, padding: 12, fontSize: 15,
                      color: colors.textPrimary,
                      backgroundColor: colors.bg,
                    }}
                    maxLength={3}
                  />
                  <Text style={{ color: '#6B7280', fontSize: 13 }}>days (max 365)</Text>
                </View>
              )}

              {/* 5. Create button */}
              <TouchableOpacity
                style={[styles.createBtn, creating && { opacity: 0.6 }]}
                activeOpacity={0.85}
                onPress={handleCreateHabit}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color={colors.textPrimary} />
                ) : (
                  <Text style={styles.createBtnText}>Create Habit 🔥</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Note Modal ── */}
      <Modal
        visible={showNoteModal}
        animationType="slide"
        transparent
        onRequestClose={() => { setShowNoteModal(false); setNoteText(''); setNoteModalHabit(null); }}
      >
        <View style={styles.noteModalBackdrop}>
          <View style={styles.noteModalSheet}>
            <TouchableOpacity
              style={styles.noteModalCloseBtn}
              onPress={() => { setShowNoteModal(false); setNoteText(''); setNoteModalHabit(null); }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.noteModalCloseTxt}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.noteModalTitle}>{noteModalHabit?.icon} {noteModalHabit?.name}</Text>
            <Text style={styles.noteModalSub}>Note for today</Text>
            <TextInput
              style={[styles.noteInput, noteFocused && styles.noteInputFocused]}
              value={noteText}
              onChangeText={setNoteText}
              placeholder="How did it go today?"
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
              fontSize={15}
              maxLength={500}
              onFocus={() => setNoteFocused(true)}
              onBlur={() => setNoteFocused(false)}
            />
            <TouchableOpacity
              style={[styles.noteSaveBtn, noteSaving && { opacity: 0.6 }]}
              onPress={handleSaveNote}
              disabled={noteSaving}
              activeOpacity={0.85}
            >
              {noteSaving
                ? <ActivityIndicator color={colors.textPrimary} />
                : <Text style={styles.noteSaveBtnTxt}>Save Note</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Note saved toast ── */}
      {showNoteSuccess && (
        <View style={{
          position: 'absolute', bottom: 110, alignSelf: 'center',
          backgroundColor: '#22C55E', paddingHorizontal: 24,
          paddingVertical: 12, borderRadius: 24, zIndex: 999,
          elevation: 10,
          shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6,
        }}>
          <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>✓ Note saved</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const makeStyles = (colors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
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
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  greetingText: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    marginTop: 2,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },

  // ── Stats bar ──
  statsBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
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
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
    marginHorizontal: 4,
  },

  // ── Habit card ──
  habitCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.textPrimary,
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
    color: colors.primary,
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  streakZero: {
    color: colors.textMuted,
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
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  actionBtnMissed: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  actionBtnText: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '700',
  },
  actionBtnTextActive: {
    color: colors.textPrimary,
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
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },
  emptySub: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  emptyAddBtn: {
    marginTop: 24,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  emptyAddBtnText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },

  // ── FAB ──
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 8,
  },
  fabText: {
    color: colors.textPrimary,
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
    backgroundColor: colors.card,
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
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  modalClose: {
    color: colors.textSecondary,
    fontSize: 18,
  },

  // Form fields
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 8,
    marginTop: 16,
  },
  fieldInput: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    height: 50,
    paddingHorizontal: 16,
    color: colors.textPrimary,
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
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiOptionSelected: {
    borderColor: colors.primary,
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
    borderColor: colors.textPrimary,
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
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodPillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  periodPillText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  periodPillTextSelected: {
    color: colors.textPrimary,
    fontWeight: '600',
  },

  // Create button
  createBtn: {
    width: '100%',
    height: 52,
    backgroundColor: colors.primary,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  createBtnText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },

  // ── Navbar ──
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: 12,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  navbarBrand: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: '800',
  },
  navbarDate: {
    color: colors.textMuted,
    fontSize: 11,
  },

  // ── Suggestion chips ──
  suggestionsLabel: {
    color: colors.textMuted,
    fontSize: 11,
    marginBottom: 6,
    marginTop: 10,
  },
  suggestionsScroll: {
    marginBottom: 10,
  },
  suggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: colors.border,
    borderWidth: 1,
    borderColor: colors.borderHover,
  },
  suggestionChipText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  suggestionChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  suggestionChipTextSelected: {
    color: colors.textPrimary,
    fontWeight: '700',
  },

  // ── Note Modal ──
  noteModalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  noteModalSheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36 },
  noteModalCloseBtn: { position: 'absolute', top: 16, right: 20 },
  noteModalCloseTxt: { color: colors.textMuted, fontSize: 20 },
  noteModalTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 4, marginTop: 8 },
  noteModalSub: { color: colors.textMuted, fontSize: 12, marginBottom: 14 },
  noteInput: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, color: colors.textPrimary, minHeight: 100, marginBottom: 16 },
  noteInputFocused: { borderColor: colors.primary },
  noteSaveBtn: { width: '100%', height: 50, backgroundColor: colors.primary, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  noteSaveBtnTxt: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },

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
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
  },
  progressCount: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
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
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  weekRange: {
    color: colors.textMuted,
    fontSize: 11,
  },
  weekCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.textMuted,
    fontSize: 9,
    textAlign: 'center',
    marginBottom: 4,
  },
  weekDayNum: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 6,
  },
  weekDayNumToday: {
    color: colors.primary,
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
    borderTopColor: colors.border,
    paddingTop: 10,
    marginTop: 4,
  },
  weekSumDone: {
    color: colors.success,
    fontSize: 11,
    fontWeight: '500',
  },
  weekSumMissed: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: '500',
  },
  weekSumPending: {
    color: colors.textMuted,
    fontSize: 11,
  },
  weekBestDay: {
    color: colors.textMuted,
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
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: {
    fontSize: 16,
    textAlign: 'center',
  },
});
