import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StyleSheet, ActivityIndicator,
  SafeAreaView, StatusBar, Alert, Switch,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import api, { setAuthToken } from '../lib/axios';

const COLORS = {
  bg: '#0d0d1a', card: '#111120', border: '#1e1e2e',
  borderHover: '#2a2a3a', primary: '#7c3aed',
  textPrimary: '#ffffff', textSecondary: '#888888',
  textMuted: '#555555', success: '#10b981', danger: '#ef4444',
};

export default function ProfileScreen({ navigation }) {
  const [profile,      setProfile]      = useState({ name: '', email: '' });
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [editName,     setEditName]     = useState('');
  const [editMode,     setEditMode]     = useState(false);
  const [nameFocused,  setNameFocused]  = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState('08:00');
  const [stats,        setStats]        = useState({ habits: 0, totalDone: 0, streak: 0 });

  // ── Fetch profile + quick stats ──────────────────────────────────────────────
  const fetchProfile = useCallback(async () => {
    try {
      const [profileRes, habitsRes] = await Promise.all([
        api.get('/api/user/profile'),
        api.get('/api/habits'),
      ]);
      const p = profileRes.data || {};
      setProfile(p);
      setEditName(p.name || '');
      setNotifEnabled(p.notificationsEnabled ?? false);
      setReminderTime(p.reminderTime || '08:00');

      const active = (habitsRes.data || []).filter((h) => h.isActive);
      // Quick stats: fetch all logs in parallel
      const logResults = await Promise.all(
        active.map((h) => api.get(`/api/logs/${h._id}`).then((r) => r.data || [])),
      );
      const allLogs = logResults.flat();
      const totalDone = allLogs.filter((l) => l.status === 'done').length;

      // Current streak: max across habits
      let maxStreak = 0;
      for (const logs of logResults) {
        const s = quickStreak(logs);
        if (s > maxStreak) maxStreak = s;
      }
      setStats({ habits: active.length, totalDone, streak: maxStreak });
    } catch (_) {}
  }, []);

  useEffect(() => {
    (async () => { setLoading(true); await fetchProfile(); setLoading(false); })();
  }, [fetchProfile]);

  // ── Save name ────────────────────────────────────────────────────────────────
  const handleSaveName = useCallback(async () => {
    if (!editName.trim()) { Alert.alert('Required', 'Name cannot be empty.'); return; }
    setSaving(true);
    try {
      await api.put('/api/user/profile', { name: editName.trim() });
      setProfile((p) => ({ ...p, name: editName.trim() }));
      setEditMode(false);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to update name.');
    } finally {
      setSaving(false);
    }
  }, [editName]);

  // ── Save notification settings ───────────────────────────────────────────────
  const handleSaveNotif = useCallback(async (enabled, time) => {
    try {
      await api.put('/api/user/notifications', {
        notificationsEnabled: enabled,
        reminderTime: time,
      });
    } catch (_) {}
  }, []);

  // ── Logout ───────────────────────────────────────────────────────────────────
  const handleLogout = useCallback(() => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out', style: 'destructive',
        onPress: async () => {
          await SecureStore.deleteItemAsync('token');
          setAuthToken(null);
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        },
      },
    ]);
  }, [navigation]);

  const initial = profile.name ? profile.name[0].toUpperCase() : '?';

  if (loading) {
    return (
      <View style={s.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* ── Avatar + name ── */}
        <View style={s.avatarSection}>
          <View style={s.avatarCircle}>
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
                placeholderTextColor={COLORS.textMuted}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
              />
              <TouchableOpacity style={s.saveBtn} onPress={handleSaveName} disabled={saving} activeOpacity={0.85}>
                {saving
                  ? <ActivityIndicator color={COLORS.textPrimary} size="small" />
                  : <Text style={s.saveBtnTxt}>Save</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity style={s.cancelBtn} onPress={() => { setEditMode(false); setEditName(profile.name); }} activeOpacity={0.75}>
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

        {/* ── Quick stats ── */}
        <View style={s.statsGrid}>
          {[
            ['🏃', stats.habits, 'Habits'],
            ['🔥', stats.streak, 'Best Streak'],
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

        {/* ── Notifications ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Notifications</Text>

          <View style={s.settingRow}>
            <View style={s.settingLeft}>
              <Text style={s.settingLabel}>Daily reminder</Text>
              <Text style={s.settingDesc}>Get a nudge to log your habits</Text>
            </View>
            <Switch
              value={notifEnabled}
              onValueChange={(val) => {
                setNotifEnabled(val);
                handleSaveNotif(val, reminderTime);
              }}
              trackColor={{ false: COLORS.border, true: COLORS.primary }}
              thumbColor={COLORS.textPrimary}
            />
          </View>

          {notifEnabled && (
            <View style={s.settingRow}>
              <View style={s.settingLeft}>
                <Text style={s.settingLabel}>Reminder time</Text>
                <Text style={s.settingDesc}>24-hour format (e.g. 08:00)</Text>
              </View>
              <TextInput
                style={s.timeInput}
                value={reminderTime}
                onChangeText={setReminderTime}
                onBlur={() => handleSaveNotif(notifEnabled, reminderTime)}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                fontSize={14}
              />
            </View>
          )}
        </View>

        {/* ── Account ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Account</Text>

          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Email</Text>
            <Text style={s.infoVal} numberOfLines={1}>{profile.email}</Text>
          </View>

          <View style={[s.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={s.infoLabel}>Account type</Text>
            <View style={s.badge}>
              <Text style={s.badgeTxt}>✉️ Email OTP</Text>
            </View>
          </View>
        </View>

        {/* ── Danger zone ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Session</Text>
          <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
            <Text style={s.logoutBtnTxt}>Log out</Text>
          </TouchableOpacity>
        </View>

        {/* ── App info ── */}
        <View style={s.appInfo}>
          <Text style={s.appInfoTxt}>🔥 StreakBoard</Text>
          <Text style={s.appInfoSub}>Track what you do. Not what you plan.</Text>
          <Text style={s.appInfoVersion}>Version 1.0.0</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Mini streak helper ────────────────────────────────────────────────────────
function quickStreak(logs) {
  const toStr = (d) => d.toISOString().split('T')[0];
  const today = new Date();
  const todayS = toStr(today);
  const yest = new Date(today);
  yest.setDate(yest.getDate() - 1);
  const yesterS = toStr(yest);
  const set = new Set(logs.map((l) => l.date));
  if (!set.has(todayS) && !set.has(yesterS)) return 0;
  const start = set.has(todayS) ? todayS : yesterS;
  let n = 0;
  const cur = new Date(start);
  while (true) {
    const ds = toStr(cur);
    if (set.has(ds)) { n++; cur.setDate(cur.getDate() - 1); } else break;
  }
  return n;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.bg },
  center:  { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 100, paddingTop: 24 },

  // Avatar
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatarCircle:  { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  avatarText:    { color: COLORS.textPrimary, fontSize: 32, fontWeight: '700' },

  nameRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  profileName:{ color: COLORS.textPrimary, fontSize: 20, fontWeight: '700' },
  editIcon:   { padding: 4 },
  editIconTxt:{ fontSize: 16 },
  profileEmail:{ color: COLORS.textMuted, fontSize: 13 },

  editRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  nameInput: { flex: 1, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, height: 44, paddingHorizontal: 14, color: COLORS.textPrimary, fontSize: 16 },
  nameInputFocused: { borderColor: COLORS.primary },
  saveBtn:   { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 14, height: 44, alignItems: 'center', justifyContent: 'center' },
  saveBtnTxt:{ color: COLORS.textPrimary, fontWeight: '600', fontSize: 13 },
  cancelBtn: { backgroundColor: COLORS.card, borderRadius: 10, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  cancelBtnTxt:{ color: COLORS.textSecondary, fontSize: 16 },

  // Stats grid
  statsGrid: { flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, paddingVertical: 16, marginBottom: 20, alignItems: 'center' },
  statCell:  { flex: 1, alignItems: 'center' },
  statIcon:  { fontSize: 20, marginBottom: 4 },
  statNum:   { color: COLORS.textPrimary, fontSize: 20, fontWeight: '700' },
  statLbl:   { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  statDiv:   { width: 1, height: 40, backgroundColor: COLORS.border },

  // Sections
  section:      { backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 16, overflow: 'hidden' },
  sectionTitle: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '600', letterSpacing: 0.8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6, textTransform: 'uppercase' },

  settingRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: COLORS.border },
  settingLeft: { flex: 1, marginRight: 12 },
  settingLabel:{ color: COLORS.textPrimary, fontSize: 14, fontWeight: '500' },
  settingDesc: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  timeInput:   { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, color: COLORS.textPrimary, minWidth: 64, textAlign: 'center' },

  infoRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: COLORS.border },
  infoLabel: { color: COLORS.textSecondary, fontSize: 14 },
  infoVal:   { color: COLORS.textPrimary, fontSize: 14, fontWeight: '500', maxWidth: '55%', textAlign: 'right' },
  badge:     { backgroundColor: COLORS.primary + '22', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeTxt:  { color: COLORS.primary, fontSize: 12, fontWeight: '600' },

  logoutBtn:    { margin: 16, marginTop: 8, height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.danger, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.danger + '14' },
  logoutBtnTxt: { color: COLORS.danger, fontSize: 15, fontWeight: '600' },

  appInfo:       { alignItems: 'center', marginTop: 8 },
  appInfoTxt:    { color: COLORS.textMuted, fontSize: 14, fontWeight: '600' },
  appInfoSub:    { color: COLORS.textMuted, fontSize: 11, marginTop: 4 },
  appInfoVersion:{ color: COLORS.border, fontSize: 11, marginTop: 6 },
});
