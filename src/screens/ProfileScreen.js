import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, StatusBar,
  Alert, Switch, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { setAuthToken } from '../lib/axios';
import { useTheme } from '../context/ThemeContext';
import { getLevelInfo, getLevelIcon } from '../lib/xpLevels';
import {
  requestNotificationPermission,
  scheduleHabitReminder,
  cancelHabitReminder,
  getReminderSettings,
} from '../lib/notifications';
import { getComebackStatus, updateBestStreak } from '../lib/comeback';

import { WEB_BASE } from '../config/api';

const BASE_URL = WEB_BASE;

function getAvatarColor(name) {
  const palette = ['#7c3aed', '#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#ec4899', '#14b8a6', '#f97316'];
  return palette[(name?.charCodeAt(0) || 0) % palette.length];
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

export default function ProfileScreen({ navigation }) {
  const { colors, isDark, themeMode, setThemeMode, toggleTheme } = useTheme();
  const s = makeStyles(colors);

  const [profile, setProfile] = useState({ name: '', email: '', createdAt: '', avatar: '' });
  const [shareData, setShareData] = useState({ shareCode: '', shareUrl: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [nameFocused, setNameFocused] = useState(false);
  const [stats, setStats] = useState({ habits: 0, totalDone: 0, bestStreak: 0 });
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState('20:00');
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [emailNotifsEnabled, setEmailNotifsEnabled] = useState(true);
  const [pushNotifsEnabled,  setPushNotifsEnabled]  = useState(true);
  const [copyText, setCopyText] = useState('Copy');
  const [savingReminder, setSavingReminder] = useState(false);
  const [avatarUri, setAvatarUri] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [habits, setHabits] = useState([]);
  const [comebackStatus, setComebackStatus] = useState({ active: false, daysIn: 0, best: 0 });
  const [xpData, setXpData] = useState(null);
  const [shieldData, setShieldData] = useState({ shieldCount: 0, shieldsUsedTotal: 0 });

  const fetchAll = useCallback(async () => {
    try {
      const [profileRes, habitsRes, shareRes, xpRes, shieldRes] = await Promise.all([
        api.get('/api/user/profile'),
        api.get('/api/habits'),
        api.get('/api/social/my-share').catch(() => ({ data: {} })),
        api.get('/api/xp/profile').catch(() => ({ data: null })),
        api.get('/api/shields/status').catch(() => ({ data: { shieldCount: 0, shieldsUsedTotal: 0 } })),
      ]);

      const p = profileRes.data || {};
      setProfile(p);
      setEditName(p.name || '');
      if (p.avatar) setAvatarUri(p.avatar);
      setShareData(shareRes.data || {});
      if (xpRes.data) setXpData(xpRes.data);
      if (shieldRes.data) setShieldData(shieldRes.data);

      const remSettings = await getReminderSettings();
      setNotifEnabled(remSettings.enabled);
      setReminderTime(remSettings.time);

      const active = (habitsRes.data || []).filter((h) => h.isActive !== false);
      setHabits(active);
      const logResults = await Promise.all(
        active.map((h) => api.get(`/api/logs/${h._id}`).then((r) => r.data || []).catch(() => [])),
      );
      const allLogs = logResults.flat();
      const totalDone = allLogs.filter((l) => l.status === 'done').length;
      const bestStreak = logResults.reduce((m, logs) => Math.max(m, computeBestStreak(logs)), 0);
      setStats({ habits: active.length, totalDone, bestStreak });
      // Update comeback module with latest best streak so it can personalise the banner
      updateBestStreak(bestStreak).catch(() => {});
      // Read comeback status for the badge
      const cb = await getComebackStatus();
      setComebackStatus(cb);
    } catch (_) { }

    try {
      const sound = await AsyncStorage.getItem('soundEnabled');
      setSoundEnabled(sound === 'true');
    } catch (_) { }

    // Load global notification prefs from DB
    try {
      const prefsRes = await api.get('/api/notifications/prefs');
      setEmailNotifsEnabled(prefsRes.data.emailNotificationsEnabled ?? true);
      setPushNotifsEnabled(prefsRes.data.pushNotificationsEnabled   ?? true);
    } catch (_) { }
  }, []);

  useEffect(() => {
    (async () => { setLoading(true); await fetchAll(); setLoading(false); })();
  }, [fetchAll]);

  const handleSaveName = useCallback(async () => {
    if (!editName.trim()) { Alert.alert('Required', 'Name cannot be empty.'); return; }
    setSaving(true);
    try {
      await api.put('/api/auth/me', { name: editName.trim() });
      setProfile((p) => ({ ...p, name: editName.trim() }));
      setEditMode(false);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to update name.');
    } finally { setSaving(false); }
  }, [editName]);

  const handleReminderToggle = useCallback(async (value) => {
    if (value) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert('Permission needed',
          'Please allow notifications in Settings to get daily habit reminders.',
          [{ text: 'OK' }]);
        return;
      }
      setNotifEnabled(true);
      const success = await scheduleHabitReminder(reminderTime);
      if (success) Alert.alert('✅ Reminder set', `You'll get a reminder every day at ${reminderTime}`);
    } else {
      await cancelHabitReminder();
      setNotifEnabled(false);
    }
  }, [reminderTime]);

  const handleReminderTimeSave = useCallback(async () => {
    // Validate HH:MM format
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
    if (!timeRegex.test(reminderTime.trim())) {
      Alert.alert('Invalid Time', 'Please enter time in HH:MM format (e.g. 21:00)');
      return;
    }
    setSavingReminder(true);
    try {
      // Ensure we have permission before scheduling
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert('Permission needed',
          'Please allow notifications in Settings to receive reminders.');
        setSavingReminder(false);
        return;
      }
      const success = await scheduleHabitReminder(reminderTime.trim());
      if (success) {
        setNotifEnabled(true);
        Alert.alert('✅ Reminder saved', `You'll get a daily nudge at ${reminderTime}`);
      } else {
        Alert.alert('Error', 'Could not schedule reminder. Try again.');
      }
    } catch (e) {
      Alert.alert('Error', 'Could not save reminder. Try again.');
    } finally {
      setSavingReminder(false);
    }
  }, [reminderTime]);

  const handleToggleSound = useCallback(async (val) => {
    setSoundEnabled(val);
    await AsyncStorage.setItem('soundEnabled', val ? 'true' : 'false');
  }, []);

  const handleToggleEmailNotifs = useCallback(async (val) => {
    setEmailNotifsEnabled(val);
    try {
      await api.patch('/api/notifications/prefs', { emailNotificationsEnabled: val });
    } catch (_) {
      // Revert on failure
      setEmailNotifsEnabled(!val);
    }
  }, []);

  const handleTogglePushNotifs = useCallback(async (val) => {
    setPushNotifsEnabled(val);
    try {
      await api.patch('/api/notifications/prefs', { pushNotificationsEnabled: val });
    } catch (_) {
      setPushNotifsEnabled(!val);
    }
  }, []);

  const handleCopy = useCallback(async () => {
    const url = shareData.shareUrl || `${BASE_URL}/u/${shareData.shareCode}`;
    await Clipboard.setStringAsync(url);
    setCopyText('Copied!');
    setTimeout(() => setCopyText('Copy'), 2000);
  }, [shareData]);

  const handleShare = useCallback(async () => {
    const url = `${BASE_URL}/u/${shareData.shareCode}`;
    try { await Share.share({ message: `Track my habits on StreakBoard! ${url}`, url }); }
    catch (_) { }
  }, [shareData.shareCode]);

  const handleLogout = useCallback(() => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'LOG OUT', style: 'destructive',
        onPress: async () => {
          try { await SecureStore.deleteItemAsync('token'); } catch (_) { }
          try { setAuthToken(null); } catch (_) { }
          const parent = navigation.getParent();
          if (parent) {
            parent.reset({ index: 0, routes: [{ name: 'Login' }] });
          } else {
            navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
          }
        },
      },
    ]);
  }, [navigation]);

  // ── Delete habit ──────────────────────────────────────────────────────────
  const confirmDeleteHabit = useCallback((habitId, habitName) => {
    Alert.alert(
      'Delete Habit',
      `Delete "${habitName}"?\nThis will permanently remove all its data and streak.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/habits/${habitId}`);
              setHabits((prev) => prev.filter((h) => h._id !== habitId));
              Alert.alert('Deleted ✓', `"${habitName}" has been removed.`);
            } catch (e) {
              Alert.alert('Error', e.response?.data?.message || 'Could not delete habit. Try again.');
            }
          },
        },
      ],
    );
  }, []);

  // ── Avatar picker & upload ────────────────────────────────────────────────
  const handlePickAvatar = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo access to change your avatar');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (result.canceled) return;
      const localUri = result.assets[0].uri;
      setAvatarUri(localUri);
      await uploadAvatar(localUri);
    } catch (e) {
      Alert.alert('Error', 'Could not pick image.');
    }
  }, []);

  const uploadAvatar = async (localUri) => {
    setUploadingAvatar(true);
    try {
      // Detect file extension + MIME type from the URI
      const filename = localUri.split('/').pop();
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1].toLowerCase().replace('jpg', 'jpeg')}` : 'image/jpeg';

      const formData = new FormData();
      formData.append('file', { uri: localUri, name: filename || 'avatar.jpg', type });
      formData.append('upload_preset', 'streakboard_avatars');
      formData.append('folder', 'avatars');

      // ⚠️ Replace YOUR_CLOUD_NAME with your actual Cloudinary cloud name
      const cloudName = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
      // NOTE: Do NOT manually set Content-Type — fetch will set it with the correct multipart boundary
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: 'POST', body: formData },
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        if (__DEV__) console.log('Cloudinary error:', errData);
        throw new Error(errData?.error?.message || `Upload failed (${response.status})`);
      }

      const data = await response.json();
      const imageUrl = data.secure_url;
      if (!imageUrl) throw new Error('No secure_url in Cloudinary response');

      // Save avatar URL to backend
      await api.put('/api/auth/me', { avatar: imageUrl });

      // Update local component state
      setAvatarUri(imageUrl);
      setProfile((p) => ({ ...p, avatar: imageUrl }));

      // Persist into AsyncStorage user cache so Dashboard & other screens pick it up
      try {
        const userStr = await AsyncStorage.getItem('user');
        const user = userStr ? JSON.parse(userStr) : {};
        user.avatar = imageUrl;
        await AsyncStorage.setItem('user', JSON.stringify(user));
      } catch (_) { }

      Alert.alert('✅ Updated!', 'Profile photo saved successfully.');
    } catch (e) {
      if (__DEV__) console.error('avatar upload error:', e);
      Alert.alert('Upload failed', e.message || 'Check your internet connection and try again.');
    } finally {
      setUploadingAvatar(false);
    }
  };


  const avatarBg = getAvatarColor(profile.name);
  const initial = profile.name ? profile.name[0].toUpperCase() : '?';
  const memberSince = profile.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : 'April 2026';
  const profileUrl = shareData.shareUrl || `${BASE_URL}/u/${shareData.shareCode}`;

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        {/* Avatar + name */}
        <View style={s.avatarSection}>
          {/* Tappable avatar — shows photo or initial */}
          <TouchableOpacity
            onPress={handlePickAvatar}
            style={s.avatarWrapper}
            activeOpacity={0.8}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={s.avatarImage} />
            ) : (
              <View style={[s.avatarCircle, { backgroundColor: avatarBg }]}>
                <Text style={s.avatarText}>{initial}</Text>
              </View>
            )}

            {/* Camera badge */}
            <View style={s.cameraBadge}>
              <Text style={s.cameraIcon}>📷</Text>
            </View>

            {/* Upload loading overlay */}
            {uploadingAvatar && (
              <View style={s.avatarLoading}>
                <ActivityIndicator color="#ffffff" size="small" />
              </View>
            )}
          </TouchableOpacity>

          {editMode ? (
            <View style={s.editRow}>
              <TextInput
                style={[s.nameInput, nameFocused && s.nameInputFocused]}
                value={editName}
                onChangeText={setEditName}
                autoFocus
                fontSize={16}
                placeholderTextColor={colors.textMuted}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
              />
              <TouchableOpacity style={s.saveBtn} onPress={handleSaveName} disabled={saving} activeOpacity={0.85}>
                {saving
                  ? <ActivityIndicator color={colors.textPrimary} size="small" />
                  : <Text style={s.saveBtnTxt}>Save</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={s.cancelBtn}
                onPress={() => { setEditMode(false); setEditName(profile.name); }} activeOpacity={0.75}>
                <Text style={s.cancelBtnTxt}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.nameRow}>
              <Text style={s.profileName}>{profile.name || 'Your Name'}</Text>
              <TouchableOpacity onPress={() => setEditMode(true)} activeOpacity={0.7} style={s.editIcon}>
                <Text style={s.editIconTxt}>✏️</Text>
              </TouchableOpacity>
            </View>
          )}
          <Text style={s.profileEmail}>{profile.email}</Text>

          {/* ── Level badge + XP bar ── */}
          {xpData && (() => {
            const { current, next } = getLevelInfo(xpData.totalXp || 0);
            const icon = getLevelIcon(current.level);
            const pct  = Math.round((xpData.progress || 0) * 100);
            return (
              <View style={s.xpCard}>
                {/* Level badge */}
                <View style={s.levelBadgeRow}>
                  <Text style={s.levelIcon}>{icon}</Text>
                  <Text style={s.levelBadgeTxt}>Lv.{current.level}</Text>
                  <Text style={s.levelName}>{current.name}</Text>
                </View>
                {/* XP bar */}
                <View style={s.xpBarTrack}>
                  <View style={[s.xpBarFill, { width: `${pct}%` }]} />
                </View>
                <Text style={s.xpBarLabel}>
                  {next
                    ? `${(xpData.totalXp || 0).toLocaleString()} / ${next.minXp.toLocaleString()} XP → Level ${next.level}`
                    : `${(xpData.totalXp || 0).toLocaleString()} XP — Max Level!`}
                </Text>
              </View>
            );
          })()}
        </View>

        {/* Quick stats */}
        <View style={s.statsGrid}>
          {[
            ['🏃', stats.habits, 'Habits'],
            ['🔥', stats.bestStreak, 'Best Streak'],
            ['✅', stats.totalDone, 'Total Done'],
            ['🛡', shieldData.shieldCount, 'Shields'],
          ].map(([icon, val, lbl], i, arr) => (
            <React.Fragment key={lbl}>
              <View style={s.statCell}>
                <Text style={s.statIcon}>{icon}</Text>
                <Text style={s.statNum}>{val}</Text>
                <Text style={s.statLbl}>{lbl}</Text>
              </View>
              {i < arr.length - 1 && <View style={s.statDiv} />}
            </React.Fragment>
          ))}
        </View>

        {/* Comeback badge — shown for up to 3 days after returning */}
        {comebackStatus.active && (
          <View style={s.comebackBadgeRow}>
            <Text style={s.comebackBadgeEmoji}>🔄</Text>
            <Text style={s.comebackBadgeTxt}>
              Comeback streak — day {comebackStatus.daysIn} of 3!
            </Text>
          </View>
        )}

        {/* Member since */}
        <View style={s.section}>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>📅 Member since</Text>
            <Text style={s.infoVal}>{memberSince}</Text>
          </View>
        </View>

        {/* MY HABITS */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>MY HABITS</Text>
          {habits.length === 0 && (
            <Text style={[s.infoLabel, { paddingHorizontal: 16, paddingBottom: 12 }]}>
              No active habits yet.
            </Text>
          )}
          {habits.map((habit, i) => (
            <View
              key={habit._id}
              style={{
                flexDirection: 'row', alignItems: 'center',
                paddingHorizontal: 16, paddingVertical: 12,
                borderBottomWidth: i < habits.length - 1 ? 1 : 0,
                borderBottomColor: colors.border,
              }}
            >
              <Text style={{ fontSize: 20, marginRight: 10 }}>{habit.icon || '📌'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '600' }}>
                  {habit.name}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                  {habit.trackingPeriod || 30}-day goal
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => confirmDeleteHabit(habit._id, habit.name)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={{ padding: 8 }}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 18 }}>🗑️</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity
            onPress={() => navigation.navigate('Home')}
            style={{
              borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed',
              borderRadius: 10, padding: 14, alignItems: 'center',
              margin: 16, marginTop: habits.length ? 8 : 4,
            }}
            activeOpacity={0.75}
          >
            <Text style={{ color: colors.textMuted, fontSize: 14 }}>+ Add New Habit</Text>
          </TouchableOpacity>
        </View>

        {/* Preferences */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>PREFERENCES</Text>

          {/* ── Appearance (3-way: Light / System / Dark) ── */}
          <View style={s.settingRow}>
            <View style={s.settingLeft}>
              <Text style={s.settingLabel}>🎨 Appearance</Text>
              <Text style={s.settingDesc}>Choose your app theme</Text>
            </View>
          </View>
          <View style={s.themeSegment}>
            {[['light', '☀️ Light'], ['system', '⚙️ System'], ['dark', '🌙 Dark']].map(([mode, label]) => (
              <TouchableOpacity
                key={mode}
                style={[s.themeSegBtn, themeMode === mode && s.themeSegBtnActive]}
                onPress={() => setThemeMode(mode)}
                activeOpacity={0.75}
              >
                <Text style={[s.themeSegBtnTxt, themeMode === mode && s.themeSegBtnTxtActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={s.divider} />
          <View style={s.settingRow}>
            <View style={s.settingLeft}>
              <Text style={s.settingLabel}>🔊 Sound Effects</Text>
              <Text style={s.settingDesc}>Play sounds on habit log</Text>
            </View>
            <Switch
              value={soundEnabled}
              onValueChange={handleToggleSound}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.textPrimary}
            />
          </View>
        </View>

        {/* Notifications */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>NOTIFICATIONS</Text>
          <View style={s.settingRow}>
            <View style={s.settingLeft}>
              <Text style={s.settingLabel}>🔔 Daily Reminder</Text>
              <Text style={s.settingDesc}>Get a nudge to log your habits</Text>
            </View>
            <Switch
              value={notifEnabled}
              onValueChange={handleReminderToggle}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.textPrimary}
            />
          </View>
          {notifEnabled && (
            <>
              <View style={s.divider} />
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10 }}>
                <Text style={[s.settingLabel, { color: colors.textSecondary, flex: 1 }]}>
                  Remind me at:
                </Text>
                <TextInput
                  style={s.timeInput}
                  value={reminderTime}
                  onChangeText={setReminderTime}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                  fontSize={14}
                  placeholder="21:00"
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="done"
                  onSubmitEditing={handleReminderTimeSave}
                />
                <TouchableOpacity
                  style={[s.saveTimeBtn, savingReminder && { opacity: 0.6 }]}
                  onPress={handleReminderTimeSave}
                  disabled={savingReminder}
                  activeOpacity={0.85}
                >
                  <Text style={s.saveTimeBtnTxt}>{savingReminder ? 'Saving…' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ── Email Notifications toggle ───────────────────────────── */}
          <View style={s.divider} />
          <View style={s.settingRow}>
            <View style={s.settingLeft}>
              <Text style={s.settingLabel}>✉️ Email Reminders</Text>
              <Text style={s.settingDesc}>Daily email if you haven't logged today</Text>
            </View>
            <Switch
              value={emailNotifsEnabled}
              onValueChange={handleToggleEmailNotifs}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.textPrimary}
            />
          </View>

          {/* ── Push Notifications toggle ─────────────────────────────── */}
          <View style={s.divider} />
          <View style={s.settingRow}>
            <View style={s.settingLeft}>
              <Text style={s.settingLabel}>🔔 Push Notifications</Text>
              <Text style={s.settingDesc}>Evening nudge if streak is at risk</Text>
            </View>
            <Switch
              value={pushNotifsEnabled}
              onValueChange={handleTogglePushNotifs}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.textPrimary}
            />
          </View>
        </View>

        {/* Account */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>ACCOUNT</Text>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Email</Text>
            <Text style={s.infoVal} numberOfLines={1}>{profile.email}</Text>
          </View>
          <View style={s.divider} />
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Account type</Text>
            <View style={s.badge}><Text style={s.badgeTxt}>✉ Email OTP</Text></View>
          </View>
        </View>

        {/* Public profile */}
        {shareData.shareCode ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>PUBLIC PROFILE</Text>
            <View style={s.urlRow}>
              <Text style={s.urlText} numberOfLines={1}>{profileUrl}</Text>
              <TouchableOpacity style={s.copyBtn} onPress={handleCopy} activeOpacity={0.85}>
                <Text style={s.copyBtnText}>{copyText}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={s.shareLinkBtn} onPress={handleShare} activeOpacity={0.85}>
              <Text style={s.shareLinkTxt}>🔗 Share Link</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Social nav */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>SOCIAL</Text>
          <TouchableOpacity style={s.navRow} onPress={() => navigation.navigate('Friends')} activeOpacity={0.75}>
            <Text style={s.navRowText}>👥 Friends & Share Code</Text>
            <Text style={s.navRowArrow}>›</Text>
          </TouchableOpacity>
          <View style={s.divider} />
          <TouchableOpacity style={s.navRow} onPress={() => navigation.navigate('Journal')} activeOpacity={0.75}>
            <Text style={s.navRowText}>📓 My Journal</Text>
            <Text style={s.navRowArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <Text style={s.logoutBtnTxt}>Log out</Text>
        </TouchableOpacity>

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerBrand}>🔥 StreakBoard</Text>
          <Text style={s.footerTagline}>Track what you do. Not what you plan.</Text>
          <Text style={s.footerVersion}>Version 1.0.0</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 120, paddingTop: 24 },

  avatarSection: { alignItems: 'center', marginBottom: 20 },

  // Tappable avatar wrapper
  avatarWrapper: {
    width: 90, height: 90, borderRadius: 45,
    alignSelf: 'center',
    marginTop: 20, marginBottom: 12,
    position: 'relative',
  },
  avatarImage: {
    width: 90, height: 90, borderRadius: 45,
  },
  avatarCircle: {
    width: 90, height: 90, borderRadius: 45,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#ffffff', fontSize: 36, fontWeight: '700' },

  // Camera badge overlay
  cameraBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: colors.bg,
  },
  cameraIcon: { fontSize: 13 },

  // Upload loading overlay
  avatarLoading: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 45,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  profileName: { color: colors.textPrimary, fontSize: 22, fontWeight: '700' },
  editIcon: { padding: 4 },
  editIconTxt: { fontSize: 16 },
  profileEmail: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  // ── XP card ──
  xpCard: { marginTop: 14, backgroundColor: colors.primary + '11', borderWidth: 1, borderColor: colors.primary + '33', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, alignSelf: 'stretch', alignItems: 'flex-start' },
  levelBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  levelIcon: { fontSize: 22 },
  levelBadgeTxt: { fontSize: 16, fontWeight: '800', color: colors.primary },
  levelName: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  xpBarTrack: { width: '100%', height: 7, backgroundColor: colors.border, borderRadius: 6, overflow: 'hidden', marginBottom: 6 },
  xpBarFill: { height: 7, backgroundColor: colors.primary, borderRadius: 6 },
  xpBarLabel: { fontSize: 11, color: colors.textMuted },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, width: '100%' },
  nameInput: { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, height: 44, paddingHorizontal: 14, color: colors.textPrimary, fontSize: 16 },
  nameInputFocused: { borderColor: colors.primary },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 14, height: 44, alignItems: 'center', justifyContent: 'center' },
  saveBtnTxt: { color: colors.textPrimary, fontWeight: '600', fontSize: 13 },
  cancelBtn: { backgroundColor: colors.card, borderRadius: 10, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  cancelBtnTxt: { color: colors.textSecondary, fontSize: 16 },

  statsGrid: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingVertical: 16, marginBottom: 12, alignItems: 'center' },
  statCell: { flex: 1, alignItems: 'center' },
  statIcon: { fontSize: 20, marginBottom: 4 },
  statNum: { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
  statLbl: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  statDiv: { width: 1, height: 40, backgroundColor: colors.border },

  section: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 12, overflow: 'hidden' },
  sectionTitle: { color: colors.textMuted, fontSize: 11, fontWeight: '600', letterSpacing: 1, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 16 },

  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13 },
  settingLeft: { flex: 1, marginRight: 12 },
  settingLabel: { color: colors.textPrimary, fontSize: 14, fontWeight: '500' },
  settingDesc: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  timeInput: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, color: colors.textPrimary, minWidth: 64, textAlign: 'center' },
  saveTimeBtn: { backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, marginLeft: 8 },
  saveTimeBtnTxt: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },

  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13 },
  infoLabel: { color: colors.textSecondary, fontSize: 13 },
  infoVal: { color: colors.textPrimary, fontSize: 13, fontWeight: '500', maxWidth: '55%', textAlign: 'right' },
  badge: { backgroundColor: 'rgba(124,58,237,0.12)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeTxt: { color: colors.primary, fontSize: 11, fontWeight: '600' },

  urlRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: 10, marginHorizontal: 16, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 },
  urlText: { flex: 1, color: colors.textSecondary, fontSize: 12 },
  copyBtn: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, marginLeft: 8 },
  copyBtnText: { color: colors.textPrimary, fontSize: 12, fontWeight: '600' },
  shareLinkBtn: { borderWidth: 1, borderColor: colors.primary, borderRadius: 12, marginHorizontal: 16, marginBottom: 14, paddingVertical: 12, alignItems: 'center' },
  shareLinkTxt: { color: colors.primary, fontSize: 13, fontWeight: '600' },

  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  navRowText: { color: colors.textPrimary, fontSize: 14, fontWeight: '500' },
  navRowArrow: { color: colors.textMuted, fontSize: 20 },

  logoutBtn: { height: 54, borderRadius: 14, borderWidth: 1.5, borderColor: colors.danger, alignItems: 'center', justifyContent: 'center', marginTop: 16, marginBottom: 8 },
  logoutBtnTxt: { color: colors.danger, fontSize: 16, fontWeight: '600' },

  footer: { alignItems: 'center', marginTop: 20 },
  footerBrand: { color: colors.textMuted, fontSize: 13 },
  footerTagline: { color: colors.borderHover, fontSize: 11, marginTop: 4 },
  footerVersion: { color: colors.borderHover, fontSize: 10, marginTop: 2 },

  // ── 3-segment theme picker ────────────────────────────────────────────────
  themeSegment: {
    flexDirection: 'row',
    backgroundColor: colors.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 3,
    gap: 3,
  },
  themeSegBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeSegBtnActive: {
    backgroundColor: colors.primary,
  },
  themeSegBtnTxt: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  themeSegBtnTxtActive: {
    color: '#ffffff',
  },

  // ── Comeback badge ────────────────────────────────────────────────────────
  comebackBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(124,58,237,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.4)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 8,
  },
  comebackBadgeEmoji: { fontSize: 20 },
  comebackBadgeTxt: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
});
