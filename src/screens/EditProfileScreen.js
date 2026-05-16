import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Animated,
  Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useUserProfile } from '../context/UserProfileContext';
import api from '../lib/axios';

const SEASON_BADGE_META = {
  champion:    { icon: '👑', label: 'Champion'    },
  runner_up:   { icon: '🌟', label: 'Runner-up'   },
  podium:      { icon: '🏅', label: 'Podium'      },
  top10:       { icon: '⚡', label: 'Top 10'      },
  participant: { icon: '🎟️', label: 'Participant' },
};

function buildAvailableBadges(profile, habits) {
  const list = [];
  const seen = new Set();

  (profile?.seasonBadges || []).forEach((b) => {
    const meta = SEASON_BADGE_META[b.type];
    if (!meta) return;
    const label = `${meta.label} · ${b.month || ''}`.trim();
    if (!seen.has(label)) { seen.add(label); list.push({ icon: meta.icon, label }); }
  });

  (habits || []).forEach((h) => {
    (h.badges || []).forEach((b) => {
      if (b.type === '100_day_streak') {
        const label = `100 Day Legend · ${h.name}`;
        if (!seen.has(label)) { seen.add(label); list.push({ icon: '💯', label }); }
      }
    });
  });

  return list;
}

function Toast({ visible }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.delay(1600),
        Animated.timing(anim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);
  if (!visible) return null;
  return (
    <Animated.View style={[styles.toast, { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
      <Text style={styles.toastTxt}>✓  Profile updated</Text>
    </Animated.View>
  );
}

export default function EditProfileScreen({ navigation }) {
  const { colors } = useTheme();
  const { updateProfileCache } = useUserProfile();
  const s = makeStyles(colors);

  const [loading, setSaving] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [showToast, setShowToast] = useState(false);

  const [name,        setName]        = useState('');
  const [pinnedBadge, setPinnedBadge] = useState(null);
  const [avatarUri,   setAvatarUri]   = useState(null);

  const [availableBadges, setAvailableBadges] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [profileRes, habitsRes] = await Promise.all([
          api.get('/api/user/profile'),
          api.get('/api/habits').catch(() => ({ data: [] })),
        ]);
        const p = profileRes.data || {};
        setName(p.name || '');
        setPinnedBadge(p.pinnedBadge?.icon ? p.pinnedBadge : null);
        if (p.avatar) setAvatarUri(p.avatar);
        setAvailableBadges(buildAvailableBadges(p, habitsRes.data || []));
      } catch (_) {
        Alert.alert('Error', 'Could not load profile data. Please try again.');
      } finally {
        setFetching(false);
      }
    })();
  }, []);

  const handleSave = useCallback(async () => {
    if (!name.trim()) { Alert.alert('Required', 'Name cannot be empty.'); return; }
    setSaving(true);
    try {
      await api.put('/api/auth/me', {
        name:        name.trim(),
        pinnedBadge: pinnedBadge || null,
      });
      updateProfileCache({
        name:        name.trim(),
        pinnedBadge: pinnedBadge || null,
      });
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  }, [name, pinnedBadge, navigation, updateProfileCache]);

  if (fetching) {
    return (
      <View style={[s.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const initial = name ? name[0].toUpperCase() : '?';

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={[s.backArrow, { color: colors.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.textPrimary }]}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} disabled={loading} activeOpacity={0.8}>
          {loading
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <Text style={[s.saveLink, { color: colors.primary }]}>Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── Avatar preview ── */}
        <View style={[s.avatarPreview, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {avatarUri
            ? <Image source={{ uri: avatarUri }} style={s.avatarImg} />
            : <View style={[s.avatarCircle, { backgroundColor: colors.primary }]}>
                <Text style={[s.avatarTxt, { color: '#fff' }]}>{initial}</Text>
              </View>}
          <Text style={[s.avatarHint, { color: colors.textMuted }]}>
            Change profile photo from the Profile page
          </Text>
        </View>

        {/* ── Username ── */}
        <Text style={[s.label, { color: colors.textMuted }]}>USERNAME</Text>
        <TextInput
          style={[s.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.card }]}
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          placeholderTextColor={colors.textMuted}
          maxLength={40}
          autoCapitalize="words"
        />

        {/* ── Pinned Achievement ── */}
        {availableBadges.length > 0 && (
          <>
            <Text style={[s.label, { color: colors.textMuted }]}>PINNED ACHIEVEMENT</Text>
            <Text style={[s.sublabel, { color: colors.textMuted }]}>Choose one badge to feature on your profile</Text>
            <TouchableOpacity
              style={[s.badgeChip, !pinnedBadge && s.badgeChipSelected, { borderColor: !pinnedBadge ? colors.primary : colors.border, backgroundColor: !pinnedBadge ? colors.primary + '15' : colors.card }]}
              onPress={() => setPinnedBadge(null)}
              activeOpacity={0.75}
            >
              <Text style={[s.badgeChipTxt, { color: !pinnedBadge ? colors.primary : colors.textSecondary }]}>None</Text>
            </TouchableOpacity>
            {availableBadges.map((b) => {
              const active = pinnedBadge?.label === b.label;
              return (
                <TouchableOpacity
                  key={b.label}
                  style={[s.badgeChip, active && s.badgeChipSelected, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary + '15' : colors.card }]}
                  onPress={() => setPinnedBadge(active ? null : b)}
                  activeOpacity={0.75}
                >
                  <Text style={s.badgeChipIcon}>{b.icon}</Text>
                  <Text style={[s.badgeChipTxt, { color: active ? colors.primary : colors.textSecondary }]}>{b.label}</Text>
                  {active && <Text style={[s.badgeChipCheck, { color: colors.primary }]}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {/* ── Save button ── */}
        <TouchableOpacity
          style={[s.saveBtn, { backgroundColor: colors.primary }, loading && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.saveBtnTxt}>Save Changes</Text>}
        </TouchableOpacity>

      </ScrollView>

      <Toast visible={showToast} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute', bottom: 40, alignSelf: 'center',
    backgroundColor: '#22C55E', paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 24, zIndex: 999, elevation: 10,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6,
  },
  toastTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

const makeStyles = (colors) => StyleSheet.create({
  safe:    { flex: 1 },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:  {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backArrow:   { fontSize: 15, fontWeight: '600' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  saveLink:    { fontSize: 15, fontWeight: '700' },
  content:     { paddingHorizontal: 20, paddingBottom: 60, paddingTop: 16 },

  avatarPreview: {
    alignItems: 'center', borderRadius: 16, borderWidth: 1,
    padding: 20, marginBottom: 24,
  },
  avatarImg:    { width: 72, height: 72, borderRadius: 36, marginBottom: 10 },
  avatarCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  avatarTxt:    { fontSize: 28, fontWeight: '800' },
  avatarHint:   { fontSize: 12, textAlign: 'center', marginTop: 4 },

  label:    { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8, marginTop: 20 },
  sublabel: { fontSize: 12, marginBottom: 10, marginTop: -6, color: colors.textMuted },
  input: {
    borderWidth: 1.5, borderRadius: 12, padding: 14,
    fontSize: 15, marginBottom: 4,
  },

  badgeChip: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderRadius: 12, padding: 14,
    marginBottom: 8, gap: 10,
  },
  badgeChipSelected: {},
  badgeChipIcon:  { fontSize: 20 },
  badgeChipTxt:   { flex: 1, fontSize: 14, fontWeight: '500' },
  badgeChipCheck: { fontSize: 16, fontWeight: '700' },

  saveBtn: {
    borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 24,
    shadowColor: colors.primary, shadowOpacity: 0.35,
    shadowRadius: 10, elevation: 6,
  },
  saveBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
