import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, SafeAreaView, StatusBar,
  Alert, Switch, Share,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { setAuthToken } from '../lib/axios';
import { useTheme } from '../context/ThemeContext';
import {
  requestNotificationPermission,
  scheduleHabitReminder,
  cancelHabitReminder,
  getReminderSettings,
} from '../lib/notifications';

const BASE_URL = 'https://streak-o.vercel.app';

function getAvatarColor(name) {
  const palette = ['#7c3aed','#10b981','#ef4444','#f59e0b','#3b82f6','#ec4899','#14b8a6','#f97316'];
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
  const { colors, isDark, toggleTheme } = useTheme();
  const s = makeStyles(colors);

  const [profile,        setProfile]        = useState({ name: '', email: '', createdAt: '' });
  const [shareData,      setShareData]      = useState({ shareCode: '', shareUrl: '' });
  const [loading,        setLoading]        = useState(true);
  const [saving,         setSaving]         = useState(false);
  const [editMode,       setEditMode]       = useState(false);
  const [editName,       setEditName]       = useState('');
  const [nameFocused,    setNameFocused]    = useState(false);
  const [stats,          setStats]          = useState({ habits: 0, totalDone: 0, bestStreak: 0 });
  const [notifEnabled,   setNotifEnabled]   = useState(false);
  const [reminderTime,   setReminderTime]   = useState('20:00');
  const [soundEnabled,   setSoundEnabled]   = useState(false);
  const [copyText,       setCopyText]       = useState('Copy');
  const [savingReminder, setSavingReminder] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [profileRes, habitsRes, shareRes] = await Promise.all([
        api.get('/api/user/profile'),
        api.get('/api/habits'),
        api.get('/api/social/my-share').catch(() => ({ data: {} })),
      ]);

      const p = profileRes.data || {};
      setProfile(p);
      setEditName(p.name || '');
      setShareData(shareRes.data || {});

      const remSettings = await getReminderSettings();
      setNotifEnabled(remSettings.enabled);
      setReminderTime(remSettings.time);

      const active = (habitsRes.data || []).filter((h) => h.isActive !== false);
      const logResults = await Promise.all(
        active.map((h) => api.get(`/api/logs/${h._id}`).then((r) => r.data || []).catch(() => [])),
      );
      const allLogs = logResults.flat();
      const totalDone = allLogs.filter((l) => l.status === 'done').length;
      const bestStreak = logResults.reduce((m, logs) => Math.max(m, computeBestStreak(logs)), 0);
      setStats({ habits: active.length, totalDone, bestStreak });
    } catch (_) {}

    try {
      const sound = await AsyncStorage.getItem('soundEnabled');
      setSoundEnabled(sound === 'true');
    } catch (_) {}
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
    if (!notifEnabled) return;
    setSavingReminder(true);
    const success = await scheduleHabitReminder(reminderTime);
    setSavingReminder(false);
    if (success) Alert.alert('✅ Updated', `Reminder updated to ${reminderTime}`);
  }, [notifEnabled, reminderTime]);

  const handleToggleSound = useCallback(async (val) => {
    setSoundEnabled(val);
    await AsyncStorage.setItem('soundEnabled', val ? 'true' : 'false');
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
    catch (_) {}
  }, [shareData.shareCode]);

  const handleLogout = useCallback(() => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'LOG OUT', style: 'destructive',
        onPress: async () => {
          try { await SecureStore.deleteItemAsync('token'); } catch (_) {}
          try { setAuthToken(null); } catch (_) {}
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

  const avatarBg   = getAvatarColor(profile.name);
  const initial    = profile.name ? profile.name[0].toUpperCase() : '?';
  const memberSince = profile.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : 'April 2026';
  const profileUrl = shareData.shareUrl || `${BASE_URL}/u/${shareData.shareCode}`;

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        {/* Avatar + name */}
        <View style={s.avatarSection}>
          <View style={[s.avatarCircle, { backgroundColor: avatarBg }]}>
            <Text style={s.avatarText}>{initial}</Text>
          </View>

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
        </View>

        {/* Quick stats */}
        <View style={s.statsGrid}>
          {[
            ['🏃', stats.habits, 'Habits'],
            ['🔥', stats.bestStreak, 'Best Streak'],
            ['✅', stats.totalDone, 'Total Done'],
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

        {/* Member since */}
        <View style={s.section}>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>📅 Member since</Text>
            <Text style={s.infoVal}>{memberSince}</Text>
          </View>
        </View>

        {/* Preferences */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>PREFERENCES</Text>
          <View style={s.settingRow}>
            <View style={s.settingLeft}>
              <Text style={s.settingLabel}>🌙 Dark Mode</Text>
              <Text style={s.settingDesc}>App appearance</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.textPrimary}
            />
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
              <View style={s.settingRow}>
                <Text style={[s.settingLabel, { color: colors.textSecondary, flex: 1 }]}>Remind me at:</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TextInput
                    style={s.timeInput}
                    value={reminderTime}
                    onChangeText={setReminderTime}
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                    fontSize={14}
                    placeholder="20:00"
                    placeholderTextColor={colors.textMuted}
                  />
                  <TouchableOpacity
                    style={[s.saveTimeBtn, savingReminder && { opacity: 0.6 }]}
                    onPress={handleReminderTimeSave}
                    disabled={savingReminder}
                    activeOpacity={0.85}
                  >
                    <Text style={s.saveTimeBtnTxt}>{savingReminder ? '...' : 'Save'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
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
  safe:    { flex: 1, backgroundColor: colors.bg },
  center:  { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 120, paddingTop: 24 },

  avatarSection: { alignItems: 'center', marginBottom: 20 },
  avatarCircle:  { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center', marginTop: 20, marginBottom: 12 },
  avatarText:    { color: '#ffffff', fontSize: 36, fontWeight: '700' },
  nameRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  profileName:   { color: colors.textPrimary, fontSize: 22, fontWeight: '700' },
  editIcon:      { padding: 4 },
  editIconTxt:   { fontSize: 16 },
  profileEmail:  { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  editRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, width: '100%' },
  nameInput:     { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, height: 44, paddingHorizontal: 14, color: colors.textPrimary, fontSize: 16 },
  nameInputFocused: { borderColor: colors.primary },
  saveBtn:       { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 14, height: 44, alignItems: 'center', justifyContent: 'center' },
  saveBtnTxt:    { color: colors.textPrimary, fontWeight: '600', fontSize: 13 },
  cancelBtn:     { backgroundColor: colors.card, borderRadius: 10, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  cancelBtnTxt:  { color: colors.textSecondary, fontSize: 16 },

  statsGrid: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingVertical: 16, marginBottom: 12, alignItems: 'center' },
  statCell:  { flex: 1, alignItems: 'center' },
  statIcon:  { fontSize: 20, marginBottom: 4 },
  statNum:   { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
  statLbl:   { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  statDiv:   { width: 1, height: 40, backgroundColor: colors.border },

  section:      { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 12, overflow: 'hidden' },
  sectionTitle: { color: colors.textMuted, fontSize: 11, fontWeight: '600', letterSpacing: 1, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  divider:      { height: 1, backgroundColor: colors.border, marginHorizontal: 16 },

  settingRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13 },
  settingLeft: { flex: 1, marginRight: 12 },
  settingLabel:{ color: colors.textPrimary, fontSize: 14, fontWeight: '500' },
  settingDesc: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  timeInput:   { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, color: colors.textPrimary, minWidth: 64, textAlign: 'center' },
  saveTimeBtn: { backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, marginLeft: 8 },
  saveTimeBtnTxt: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },

  infoRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13 },
  infoLabel:{ color: colors.textSecondary, fontSize: 13 },
  infoVal:  { color: colors.textPrimary, fontSize: 13, fontWeight: '500', maxWidth: '55%', textAlign: 'right' },
  badge:    { backgroundColor: 'rgba(124,58,237,0.12)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeTxt: { color: colors.primary, fontSize: 11, fontWeight: '600' },

  urlRow:      { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: 10, marginHorizontal: 16, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 },
  urlText:     { flex: 1, color: colors.textSecondary, fontSize: 12 },
  copyBtn:     { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, marginLeft: 8 },
  copyBtnText: { color: colors.textPrimary, fontSize: 12, fontWeight: '600' },
  shareLinkBtn:{ borderWidth: 1, borderColor: colors.primary, borderRadius: 12, marginHorizontal: 16, marginBottom: 14, paddingVertical: 12, alignItems: 'center' },
  shareLinkTxt:{ color: colors.primary, fontSize: 13, fontWeight: '600' },

  navRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  navRowText: { color: colors.textPrimary, fontSize: 14, fontWeight: '500' },
  navRowArrow:{ color: colors.textMuted, fontSize: 20 },

  logoutBtn:    { height: 54, borderRadius: 14, borderWidth: 1.5, borderColor: colors.danger, alignItems: 'center', justifyContent: 'center', marginTop: 16, marginBottom: 8 },
  logoutBtnTxt: { color: colors.danger, fontSize: 16, fontWeight: '600' },

  footer:        { alignItems: 'center', marginTop: 20 },
  footerBrand:   { color: colors.textMuted, fontSize: 13 },
  footerTagline: { color: colors.borderHover, fontSize: 11, marginTop: 4 },
  footerVersion: { color: colors.borderHover, fontSize: 10, marginTop: 2 },
});
