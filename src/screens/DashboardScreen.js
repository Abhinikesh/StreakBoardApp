import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
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
import { playTickSound, playCrossSound, playStreakMilestoneSound } from '../lib/sound';
import { markUserActive } from '../lib/reengagement';
import { triggerComebackIfEligible, markComebackLoggedToday, recordPreviousStreak } from '../lib/comeback';
import { useTheme } from '../context/ThemeContext';
import { getLevelInfo, getLevelIcon } from '../lib/xpLevels';
import { useOffline } from '../context/OfflineContext';
import { OfflineBanner, SyncToast } from '../components/OfflineUI';
import {
  getCachedHabits, saveHabitsToCache,
  getCachedLogs, saveLogsToCache,
  getCachedProfile, saveProfileToCache,
  getPendingQueue, addToPendingQueue,
  applyLocalLog,
} from '../lib/offlineStore';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  scheduleHabitReminderNotif, cancelHabitReminderNotif,
  rescheduleAllHabitReminders, ensureNotificationPermission,
} from '../lib/habitReminders';
import WeeklySummaryCard from '../components/WeeklySummaryCard';
import { writeWidgetData } from '../lib/widgetData';
import WidgetTipCard from '../components/WidgetTipCard';


// ─── Emoji / color pickers ────────────────────────────────────────────────────
const EMOJI_OPTIONS = [
  // Health & Fitness
  '🏃', '🚴', '🧘', '💪', '🏋️', '🤸', '🏄', '🚶',
  // Mind & Learning
  '📚', '✍️', '🎯', '🧠', '📖', '🎨', '🎥', '🎭',
  // Health & Body
  '💧', '🥗', '😴', '☀️', '🚒', '📆', '💊', '🧪',
  // Lifestyle
  '☕', '🍎', '🥤', '🌿', '🍙', '🧹', '💻', '📝',
  // Finance & Habits
  '💰', '📱', '🚬', '🔥', '⭐', '❤️', '🙏', '🌙',
  // Classic
  '📌', '🌟', '🚀', '📸',
];
const COLOR_OPTIONS = [
  '#10b981', '#7c3aed', '#ef4444', '#f59e0b',
  '#3b82f6', '#ec4899', '#14b8a6', '#f97316',
];


const HABIT_SUGGESTIONS = [
  { name: 'DSA Practice', icon: '💻' },
  { name: 'Morning Run', icon: '🏃' },
  { name: 'Read Books', icon: '📚' },
  { name: 'Meditation', icon: '🧘' },
  { name: 'Gym Workout', icon: '💪' },
  { name: 'Cold Shower', icon: '🚿' },
  { name: 'No Junk Food', icon: '🥗' },
  { name: 'Sleep by 11', icon: '😴' },
  { name: 'LeetCode', icon: '🎯' },
  { name: 'GitHub Commit', icon: '👨‍💻' },
  { name: 'No Social Media', icon: '🚫' },
  { name: 'Drink Water', icon: '💧' },
  { name: 'Journal', icon: '✍️' },
  { name: 'Learn Skills', icon: '🎨' },
];

// ─── Helper: streak calculation ───────────────────────────────────────────────
function computeStreak(logs) {
  const today = new Date();
  const toDateStr = (d) => d.toISOString().split('T')[0];
  const todayStr = toDateStr(today);
  const yest = new Date(today);
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
  const [habits, setHabits] = useState([]);
  const [habitLogs, setHabitLogs] = useState({}); // { [habitId]: { allLogs, todayLog } }
  const [profile, setProfile] = useState({ name: '', email: '' });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newHabit, setNewHabit] = useState({
    name: '', icon: '💧', colorHex: '#10b981',
  });
  const [creating, setCreating] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);


  const [soundEnabled, setSoundEnabled] = useState(true);
  const [userAvatar, setUserAvatar] = useState(null);

  const [comebackBanner, setComebackBanner] = useState(null);
  // XP / Level state
  const [xpData, setXpData] = useState({ totalXp: 0, currentLevel: 1, levelName: 'Beginner', progress: 0, xpToNext: 200 });
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpInfo, setLevelUpInfo] = useState({ level: 1, name: 'Beginner' });
  const [shieldCount, setShieldCount] = useState(0);

  const levelUpAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const bannerAnim = useRef(new Animated.Value(0)).current;
  const bannerFireAnim = useRef(new Animated.Value(1)).current;

  // ── Offline context ─────────────────────────────────────────────────────────
  const { isOnline, refreshPendingCount } = useOffline();

  // ── Per-habit reminder state ────────────────────────────────────────────────
  const [reminderHabit, setReminderHabit] = useState(null);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [savingReminder, setSavingReminder] = useState(false);
  // ── Overflow ("...") menu state — shows ⏰/📅 so main card stays clean ───────
  const [overflowHabit, setOverflowHabit] = useState(null);
  const [noteModalHabit, setNoteModalHabit] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showNoteSuccess, setShowNoteSuccess] = useState(false);

  // ── Fetch all data (cache-first / stale-while-revalidate) ───────────────────
  const fetchAll = useCallback(async () => {
    // ── Step 1: load from cache instantly ──────────────────────────────────
    const [cachedHabits, cachedLogs, cachedProfile] = await Promise.all([
      getCachedHabits(), getCachedLogs(), getCachedProfile(),
    ]);
    if (cachedHabits) {
      setHabits(cachedHabits);
      setLoading(false); // fast path — user sees data immediately
    }
    if (cachedLogs) setHabitLogs(cachedLogs);
    if (cachedProfile) setProfile(cachedProfile);

    // ── Step 2: refresh from server (background if cache hit) ──────────────
    if (!isOnline) return; // no point trying if offline
    try {
      const [habitsRes, profileRes, xpRes, shieldRes] = await Promise.all([
        api.get('/api/habits'),
        api.get('/api/user/profile'),
        api.get('/api/xp/profile').catch(() => ({ data: null })),
        api.get('/api/shields/status').catch(() => ({ data: { shieldCount: 0 } })),
      ]);

      const activeHabits = (habitsRes.data || []).filter((h) => h.isActive);
      setHabits(activeHabits);
      await saveHabitsToCache(activeHabits);

      const profile = profileRes.data || { name: '', email: '' };
      setProfile(profile);
      await saveProfileToCache(profile);

      if (xpRes.data) setXpData(xpRes.data);
      if (shieldRes.data) setShieldCount(shieldRes.data.shieldCount || 0);

      // Write widget data in background (non-blocking)
      writeWidgetData({ habits: activeHabits, habitLogs }).catch(() => { });



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
      const today = todayStr();
      for (const { habitId, logs } of logResults) {
        const todayLog = logs.find((l) => l.date === today) || null;
        logsMap[habitId] = { allLogs: logs, todayLog };
      }
      setHabitLogs(logsMap);
      await saveLogsToCache(logsMap);
      // Reschedule per-habit reminders with fresh data
      rescheduleAllHabitReminders(activeHabits).catch(() => { });
    } catch (err) {
      // If server fetch fails but we had cache, don't alert — just keep cached data
      if (!cachedHabits) {
        Alert.alert('Error', 'Failed to load dashboard. Please refresh.');
      }
    }
  }, [isOnline]);

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
    }).catch(() => { });

    SecureStore.getItemAsync('user_cache').then((raw) => {
      if (raw) {
        try { setUserAvatar(JSON.parse(raw).avatar || null); } catch (_) { }
      }
    }).catch(() => { });
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
      const res = await api.get(`/api/logs/${habitId}`);
      const logs = res.data || [];
      const today = todayStr();
      const todayLog = logs.find((l) => l.date === today) || null;
      setHabitLogs((prev) => ({
        ...prev,
        [habitId]: { allLogs: logs, todayLog },
      }));
    } catch (_) { }
  }, []);

  // ── Log action ──────────────────────────────────────────────────────────────
  const handleLogAction = useCallback(
    async (habit, status) => {
      const entry = habitLogs[habit._id] || { allLogs: [], todayLog: null };
      const todayLog = entry.todayLog;

      // Capture streak BEFORE the API call so we can detect an increase after.
      const oldStreak = computeStreak(entry.allLogs);

      const wasFirstLogToday = !Object.values(habitLogs).some((l) => l.todayLog !== null);
      const wasAllZeroStreak = habits.every(
        (h) => computeStreak(habitLogs[h._id]?.allLogs || []) === 0
      );

      // ── OFFLINE path: queue locally, update UI optimistically ──────────────
      if (!isOnline) {
        const today = todayStr();
        let op = 'log';
        let newLogsMap;
        if (todayLog) {
          if (todayLog.status === status) {
            // toggling off → delete
            op = 'delete';
            newLogsMap = await applyLocalLog(habit._id, today, status, 'delete');
            await addToPendingQueue({
              id: `${habit._id}_${today}_delete`,
              op: 'delete', habitId: habit._id, date: today,
              logId: todayLog._id,
            });
          } else {
            // switching status
            newLogsMap = await applyLocalLog(habit._id, today, status, 'log');
            await addToPendingQueue({
              id: `${habit._id}_${today}_log`,
              op: 'log', habitId: habit._id, date: today, status,
            });
          }
        } else {
          newLogsMap = await applyLocalLog(habit._id, today, status, 'log');
          await addToPendingQueue({
            id: `${habit._id}_${today}_log`,
            op: 'log', habitId: habit._id, date: today, status,
          });
        }
        if (newLogsMap) setHabitLogs(newLogsMap);
        if (status === 'done') playTickSound(soundEnabled).catch(() => { });
        else playCrossSound(soundEnabled).catch(() => { });
        await refreshPendingCount();
        return; // skip server call
      }

      // ── ONLINE path (existing logic) ───────────────────────────────────────
      try {
        let logResponse = null;
        if (todayLog) {
          if (todayLog.status === status) {
            await apiWithRetry(() => api.delete(`/api/logs/${todayLog._id}`));
          } else {
            await apiWithRetry(() => api.delete(`/api/logs/${todayLog._id}`));
            const r = await apiWithRetry(() => api.post('/api/logs', {
              habitId: habit._id, date: todayStr(), status,
            }));
            logResponse = r?.data;
          }
        } else {
          const r = await apiWithRetry(() => api.post('/api/logs', {
            habitId: habit._id, date: todayStr(), status,
          }));
          logResponse = r?.data;
        }
        await refreshHabitLogs(habit._id);
        // Mark user active → cancels re-engagement notifications
        markUserActive().catch(() => { });

        // ── Comeback detection ───────────────────────────────────────────
        // Trigger only when: this is 'done', was the FIRST log today across all
        // habits, AND all computed streaks were 0 before this log.
        await recordPreviousStreak(oldStreak);
        if (status === 'done' && wasFirstLogToday && wasAllZeroStreak) {
          triggerComebackIfEligible().then((banner) => {
            if (banner) {
              setComebackBanner(banner);
              bannerAnim.setValue(0);
              bannerFireAnim.setValue(1);
              // Entrance animation
              Animated.spring(bannerAnim, {
                toValue: 1, tension: 60, friction: 9, useNativeDriver: true,
              }).start();
              // Fire flicker loop
              Animated.loop(Animated.sequence([
                Animated.timing(bannerFireAnim, { toValue: 1.2, duration: 350, useNativeDriver: true }),
                Animated.timing(bannerFireAnim, { toValue: 1.0, duration: 350, useNativeDriver: true }),
              ])).start();
              // Auto-dismiss after 6 seconds
              setTimeout(() => setComebackBanner(null), 6000);
            }
          }).catch(() => { });
        } else if (status === 'done') {
          markComebackLoggedToday().catch(() => { });
        }

        // ── Sounds after successful log ───────────────────────────────────
        if (status === 'done') playTickSound(soundEnabled).catch(() => { });
        if (status === 'missed') playCrossSound(soundEnabled).catch(() => { });

        if (status === 'done' && !todayLog && oldStreak > 0) {
          playStreakMilestoneSound(soundEnabled).catch(() => { });
        }

        // XP: update local xpData and trigger level-up modal if needed
        if (logResponse?.xp) {
          const xp = logResponse.xp;
          if (xp.newTotalXp !== undefined) {
            const { current, next, xpIntoLevel, xpNeeded, progress } = getLevelInfo(xp.newTotalXp);
            setXpData({
              totalXp: xp.newTotalXp, currentLevel: current.level, levelName: current.name,
              progress, xpToNext: next ? next.minXp - xp.newTotalXp : 0
            });
          }
          if (xp.leveledUp) {
            setLevelUpInfo({ level: xp.newLevel, name: xp.newLevelName });
            setShowLevelUp(true);
            levelUpAnim.setValue(0);
            Animated.timing(levelUpAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
            playStreakMilestoneSound(soundEnabled).catch(() => { });
            setTimeout(() => setShowLevelUp(false), 3000);
          }
        }
      } catch (err) {
        Alert.alert('Error', 'Failed to update log. Please try again.');
      }
    },
    [habitLogs, refreshHabitLogs, soundEnabled],
  );

  // ── Per-habit reminder handlers ────────────────────────────────────────────
  const handleOpenReminder = useCallback((habit) => {
    const base = new Date();
    if (habit.reminderTime) {
      const [h, m] = habit.reminderTime.split(':').map(Number);
      base.setHours(h, m, 0, 0);
    } else {
      base.setHours(20, 0, 0, 0);
    }
    setReminderHabit(habit);
    setReminderEnabled(!!habit.reminderEnabled);
    setReminderTime(base);
    setShowTimePicker(false);
  }, []);


  // Drag-to-reorder removed — reordering is now done from Profile > MY HABITS.

  const handleSaveReminder = useCallback(async () => {
    if (!reminderHabit) return;
    setSavingReminder(true);
    const hh = String(reminderTime.getHours()).padStart(2, '0');
    const mm = String(reminderTime.getMinutes()).padStart(2, '0');
    const timeStr = `${hh}:${mm}`;
    try {
      await ensureNotificationPermission();
      const res = await api.patch(`/api/habits/${reminderHabit._id}/reminder`, {
        reminderEnabled,
        reminderTime: reminderEnabled ? timeStr : null,
      });
      setHabits(prev => prev.map(h =>
        h._id === reminderHabit._id ? { ...h, ...res.data } : h
      ));
      const updated = { ...reminderHabit, reminderEnabled, reminderTime: reminderEnabled ? timeStr : null };
      if (reminderEnabled) await scheduleHabitReminderNotif(updated);
      else await cancelHabitReminderNotif(reminderHabit._id);
      setReminderHabit(null);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || 'Could not save reminder.');
    } finally { setSavingReminder(false); }
  }, [reminderHabit, reminderEnabled, reminderTime]);

  // ── Create habit ──────────────────────────────────────────────────────────
  const handleCreateHabit = useCallback(async () => {
    if (!newHabit.name.trim()) {
      Alert.alert('Required', 'Please enter a habit name.');
      return;
    }
    setCreating(true);
    try {
      await api.post('/api/habits', {
        name: newHabit.name.trim(),
        icon: newHabit.icon,
        colorHex: newHabit.colorHex,
      });
      setShowAddModal(false);
      setSelectedSuggestion(null);
      setNewHabit({ name: '', icon: '💧', colorHex: '#10b981' });
      await fetchAll();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to create habit.');
    } finally {
      setCreating(false);
    }
  }, [newHabit, fetchAll]);

  // ── Save note ──────────────────────────────────────────────────────────────
  const handleSaveNote = useCallback(async () => {
    if (!noteModalHabit) return;
    const todayLog = habitLogs[noteModalHabit._id]?.todayLog;
    const noteKey = `note_${noteModalHabit._id}_${todayStr()}`;
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
  const statsDone = habits.filter((h) => habitLogs[h._id]?.todayLog?.status === 'done').length;
  const statsMissed = habits.filter((h) => habitLogs[h._id]?.todayLog?.status === 'missed').length;
  const firstName = profile.name ? profile.name.split(' ')[0] : 'there';
  const initial = profile.name ? profile.name[0].toUpperCase() : '?';

  // ── Week data ───────────────────────────────────────────────────────────────
  const MONTH_S = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
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
  const weekDoneToday = todayDay?.habitStatuses.filter((s) => s.status === 'done').length || 0;
  const weekMissedToday = todayDay?.habitStatuses.filter((s) => s.status === 'missed').length || 0;
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
      <OfflineBanner colors={colors} />
      <SyncToast colors={colors} />

      {/* ── Navbar ── */}
      <View style={styles.navbar}>
        <Text style={styles.navbarBrand}>🔥 HabitBoard</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {shieldCount > 0 && (
            <View style={[styles.xpPill, { backgroundColor: '#0e7a4422', borderColor: '#22c55e55' }]}>
              <Text style={[styles.xpPillText, { color: '#22c55e' }]}>🛡 ×{shieldCount}</Text>
            </View>
          )}
          <TouchableOpacity
            onPress={() => navigation.navigate('XpDetail', { xpData })}
            activeOpacity={0.85}
            style={styles.xpPill}
          >
            <Text style={styles.xpPillText}>
              {getLevelIcon(xpData.currentLevel)} Lv.{xpData.currentLevel} · {(xpData.totalXp || 0).toLocaleString()} XP
            </Text>
          </TouchableOpacity>
          <Text style={styles.navbarDate}>{shortDate()}</Text>
        </View>
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

        {/* ── Comeback banner (animated, dismisses after 6s) ── */}
        {comebackBanner && (
          <Animated.View style={[
            styles.comebackBanner,
            {
              opacity: bannerAnim,
              transform: [{
                translateY: bannerAnim.interpolate({
                  inputRange: [0, 1], outputRange: [-40, 0],
                }),
              }],
            },
          ]}>
            <Animated.Text style={[styles.comebackFire, { transform: [{ scale: bannerFireAnim }] }]}>
              🔥
            </Animated.Text>
            <View style={styles.comebackTextCol}>
              <Text style={styles.comebackTitle}>{comebackBanner.title}</Text>
              <Text style={styles.comebackBody}>{comebackBanner.body}</Text>
            </View>
            <TouchableOpacity onPress={() => setComebackBanner(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.comebackClose}>✕</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── Weekly summary card (Sunday/Monday only, dismissable) ── */}
        <WeeklySummaryCard colors={colors} />

        {/* ── One-time widget tip card (shown until user dismisses) ── */}
        <WidgetTipCard
          onHowToAdd={() => navigation.navigate('WidgetInstructions')}
        />

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
          <FlatList
            data={habits}
            keyExtractor={(h) => h._id}
            scrollEnabled={false}
            renderItem={({ item: habit }) => {
              const entry = habitLogs[habit._id] || { allLogs: [], todayLog: null };
              const todayLog = entry.todayLog;
              const streak = computeStreak(entry.allLogs);
              const isDone = todayLog?.status === 'done';
              const isMissed = todayLog?.status === 'missed';
              return (
                <TouchableOpacity
                  activeOpacity={1}
                  onLongPress={() => {
                    Alert.alert(
                      'Delete Habit',
                      `Delete "${habit.name}"? This will permanently remove all its data and streak.`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete', style: 'destructive',
                          onPress: async () => {
                            try {
                              await api.delete(`/api/habits/${habit._id}`);
                              setHabits(prev => prev.filter(h => h._id !== habit._id));
                            } catch (e) {
                              Alert.alert('Error', e.response?.data?.message || 'Could not delete habit.');
                            }
                          },
                        },
                      ],
                    );
                  }}
                  delayLongPress={500}
                >
                  <View style={styles.habitCard}>
                    <View style={[styles.accentBar, { backgroundColor: habit.colorHex || colors.primary }]} />
                    <View style={styles.habitMiddle}>
                      <View style={styles.habitNameRow}>
                        <Text style={styles.habitIcon}>{habit.icon}</Text>
                        <Text style={styles.habitName} numberOfLines={1}>{habit.name}</Text>
                        {habit.reminderEnabled && <Text style={styles.reminderBadge}>⏰</Text>}
                      </View>
                      <View style={styles.habitStreakRow}>
                        {streak > 0 ? (
                          <>
                            <Text style={styles.streakFire}>🔥</Text>
                            <Text style={styles.streakText}>{streak} day streak</Text>
                          </>
                        ) : (
                          <Text style={styles.streakZero}>Start your streak today</Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.habitActions}>
                      <TouchableOpacity
                        style={[styles.actionBtn, isDone && styles.actionBtnDone]}
                        activeOpacity={0.75}
                        onPress={() => handleLogAction(habit, 'done')}
                      >
                        <Text style={[styles.actionBtnText, isDone && styles.actionBtnTextActive]}>✓</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, isMissed && styles.actionBtnMissed]}
                        activeOpacity={0.75}
                        onPress={() => handleLogAction(habit, 'missed')}
                      >
                        <Text style={[styles.actionBtnText, isMissed && styles.actionBtnTextActive]}>✗</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.iconBtn}
                        activeOpacity={0.75}
                        onPress={() => handleOpenReminder(habit)}
                      >
                        <Text style={styles.iconBtnText}>🔔</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.iconBtn}
                        activeOpacity={0.75}
                        onPress={() => navigation.navigate('Calendar', { habitId: habit._id })}
                      >
                        <Text style={styles.iconBtnText}>📅</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
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

      {/* ── Overflow ("•••") action menu ── */}
      <Modal
        visible={!!overflowHabit}
        animationType="slide"
        transparent
        onRequestClose={() => setOverflowHabit(null)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => setOverflowHabit(null)}
        >
          <View style={{
            backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
            paddingTop: 8, paddingBottom: 36, paddingHorizontal: 20,
          }}>
            {/* Handle bar */}
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 16 }} />
            <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.6 }}>
              {overflowHabit?.name}
            </Text>
            <TouchableOpacity
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 14,
                paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border,
              }}
              activeOpacity={0.75}
              onPress={() => { setOverflowHabit(null); setTimeout(() => handleOpenReminder(overflowHabit), 200); }}
            >
              <Text style={{ fontSize: 22 }}>⏰</Text>
              <View>
                <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '600' }}>Set Reminder</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                  {overflowHabit?.reminderEnabled ? `Reminder at ${overflowHabit?.reminderTime}` : 'No reminder set'}
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 14,
                paddingVertical: 14,
              }}
              activeOpacity={0.75}
              onPress={() => { setOverflowHabit(null); setTimeout(() => navigation.navigate('Calendar', { habitId: overflowHabit?._id }), 200); }}
            >
              <Text style={{ fontSize: 22 }}>📅</Text>
              <View>
                <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '600' }}>View Calendar</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>See your full log history</Text>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Add Habit Modal ── */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => { setShowAddModal(false); setSelectedSuggestion(null); }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            {/* Sheet header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Habit</Text>
              <TouchableOpacity
                onPress={() => { setShowAddModal(false); setSelectedSuggestion(null); }}
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

              {/* 4. Create button */}
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


      {/* ── Level-Up Modal overlay ── */}
      <Modal visible={showLevelUp} transparent animationType="none" onRequestClose={() => setShowLevelUp(false)}>
        <Animated.View style={[
          {
            flex: 1, alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.82)'
          },
          { opacity: levelUpAnim },
        ]}>
          <Animated.View style={[
            {
              alignItems: 'center', paddingHorizontal: 40, paddingVertical: 48,
              backgroundColor: '#1a1033', borderRadius: 28, borderWidth: 1,
              borderColor: '#7c3aed88', width: '88%', shadowColor: '#7c3aed',
              shadowOpacity: 0.6, shadowRadius: 32, elevation: 20
            },
            { transform: [{ scale: levelUpAnim.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }) }] },
          ]}>
            <Text style={{ fontSize: 56, marginBottom: 8 }}>{getLevelIcon(levelUpInfo.level)}</Text>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#a78bfa', letterSpacing: 3, marginBottom: 12 }}>LEVEL UP!</Text>
            <Text style={{ fontSize: 30, fontWeight: '900', color: '#ffffff', textAlign: 'center', marginBottom: 6 }}>
              Level {levelUpInfo.level}
            </Text>
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#a78bfa', textAlign: 'center', marginBottom: 24 }}>
              {levelUpInfo.name}
            </Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', textAlign: 'center' }}>Tap anywhere to dismiss</Text>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* ── Per-habit Reminder Modal ── */}
      <Modal
        visible={!!reminderHabit}
        transparent
        animationType="slide"
        onRequestClose={() => setReminderHabit(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { paddingBottom: 32 }]}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>⏰ Reminder</Text>
              <TouchableOpacity onPress={() => setReminderHabit(null)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {reminderHabit && (
              <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 18, textAlign: 'center' }}>
                {reminderHabit.icon} {reminderHabit.name}
              </Text>
            )}

            {/* Toggle */}
            <View style={styles.reminderRow}>
              <Text style={styles.reminderLabel}>Enable reminder</Text>
              <TouchableOpacity
                style={[styles.reminderToggle, reminderEnabled && styles.reminderToggleOn]}
                onPress={() => setReminderEnabled(v => !v)}
                activeOpacity={0.8}
              >
                <View style={[styles.reminderThumb, reminderEnabled && styles.reminderThumbOn]} />
              </TouchableOpacity>
            </View>

            {/* Time picker button */}
            {reminderEnabled && (
              <TouchableOpacity
                style={styles.reminderTimePill}
                onPress={() => setShowTimePicker(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.reminderTimeTxt}>
                  {String(reminderTime.getHours()).padStart(2, '0')}:{String(reminderTime.getMinutes()).padStart(2, '0')}
                </Text>
                <Text style={{ color: colors.primary, fontSize: 12, marginTop: 2 }}>Tap to change</Text>
              </TouchableOpacity>
            )}

            {showTimePicker && (
              <DateTimePicker
                value={reminderTime}
                mode="time"
                is24Hour={true}
                display="default"
                onChange={(_, date) => {
                  setShowTimePicker(false);
                  if (date) setReminderTime(date);
                }}
              />
            )}

            {/* Save button */}
            <TouchableOpacity
              style={[styles.saveReminderBtn, savingReminder && { opacity: 0.6 }]}
              onPress={handleSaveReminder}
              disabled={savingReminder}
              activeOpacity={0.8}
            >
              <Text style={styles.saveReminderTxt}>
                {savingReminder ? 'Saving…' : 'Save Reminder'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
  habitCardDragging: {
    opacity: 0.95,
    borderColor: colors.primary + '66',
  },
  dragHandle: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 8,
    marginLeft: 2,
  },
  dragHandleIcon: {
    fontSize: 20,
    color: colors.textMuted,
    letterSpacing: 1,
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
  xpPill: {
    backgroundColor: colors.primary + '22',
    borderWidth: 1,
    borderColor: colors.primary + '55',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  xpPillText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
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
  reminderBadge: {
    fontSize: 12,
    marginLeft: 4,
    opacity: 0.85,
  },
  reminderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 4, marginBottom: 20,
  },
  reminderLabel: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  reminderToggle: {
    width: 48, height: 26, borderRadius: 13, backgroundColor: colors.border,
    justifyContent: 'center', padding: 2,
  },
  reminderToggleOn: { backgroundColor: colors.primary },
  reminderThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  reminderThumbOn: { alignSelf: 'flex-end' },
  reminderTimePill: {
    alignSelf: 'center', alignItems: 'center',
    backgroundColor: colors.primary + '18',
    borderRadius: 14, borderWidth: 1, borderColor: colors.primary + '55',
    paddingHorizontal: 28, paddingVertical: 14, marginBottom: 22,
  },
  reminderTimeTxt: { color: colors.primary, fontSize: 32, fontWeight: '800' },
  saveReminderBtn: {
    backgroundColor: colors.primary, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 4,
  },
  saveReminderTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // ── Comeback banner ───────────────────────────────────────────────────────
  comebackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4c1d95',   // deep purple — distinct from card
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#7c3aed',
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 14,
    gap: 10,
    // Subtle top highlight for gradient feel
    shadowColor: '#7c3aed',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  comebackFire: { fontSize: 32 },
  comebackTextCol: { flex: 1 },
  comebackTitle: { color: '#ffffff', fontSize: 15, fontWeight: '700', marginBottom: 2 },
  comebackBody: { color: 'rgba(255,255,255,0.82)', fontSize: 12, lineHeight: 17 },
  comebackClose: { color: 'rgba(255,255,255,0.5)', fontSize: 18, paddingLeft: 4 },

  // ── Weekly Challenge card ────────────────────────────────────────────────
  wcCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.primary + '44',
    marginHorizontal: 16,
    marginTop: 18,
    marginBottom: 8,
    padding: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  wcCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  wcBadge: { backgroundColor: colors.primary + '22', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  wcBadgeTxt: { color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  wcDaysLeft: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  wcTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '800', marginBottom: 4 },
  wcDesc: { color: colors.textSecondary, fontSize: 13, lineHeight: 18, marginBottom: 12 },
  wcBarTrack: { height: 6, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden', marginBottom: 6 },
  wcBarFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 4 },
  wcBarRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  wcBarLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  wcParticipants: { color: colors.textMuted, fontSize: 11 },
  wcCompletedBadge: { marginTop: 10, backgroundColor: '#16a34a22', borderRadius: 8, borderWidth: 1, borderColor: '#16a34a44', paddingVertical: 6, alignItems: 'center' },
  wcCompletedTxt: { color: '#16a34a', fontSize: 13, fontWeight: '700' },
});

