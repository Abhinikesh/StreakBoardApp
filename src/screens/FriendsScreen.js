import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, SafeAreaView, StatusBar,
  RefreshControl, Switch, Alert, Share, Linking,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import api from '../lib/axios';

const COLORS = {
  bg: '#0d0d1a', card: '#111120', border: '#1e1e2e',
  primary: '#7c3aed', textPrimary: '#ffffff',
  textSecondary: '#888888', textMuted: '#555555',
  success: '#10b981', danger: '#ef4444',
};

const BASE_URL = 'https://streak-o.vercel.app';

export default function FriendsScreen() {
  const [shareData,  setShareData]  = useState({ shareCode: '', shareUrl: '', isProfilePublic: false });
  const [profile,    setProfile]    = useState({ name: '' });
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [friendCode, setFriendCode] = useState('');
  const [copyText,   setCopyText]   = useState('Copy');
  const [toggling,   setToggling]   = useState(false);

  // ── Fetch data ──────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      const [shareRes, profileRes] = await Promise.all([
        api.get('/api/social/my-share'),
        api.get('/api/user/profile'),
      ]);
      setShareData(shareRes.data || { shareCode: '', shareUrl: '', isProfilePublic: false });
      setProfile(profileRes.data || { name: '' });
    } catch (_) {}
  }, []);

  useEffect(() => {
    (async () => { setLoading(true); await fetchAll(); setLoading(false); })();
  }, [fetchAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await fetchAll(); setRefreshing(false);
  }, [fetchAll]);

  // ── Copy profile URL ────────────────────────────────────────────────────────
  const handleCopy = useCallback(async () => {
    const url = shareData.shareUrl || `${BASE_URL}/u/${shareData.shareCode}`;
    await Clipboard.setStringAsync(url);
    setCopyText('Copied!');
    setTimeout(() => setCopyText('Copy'), 2000);
  }, [shareData]);

  // ── Copy share code ─────────────────────────────────────────────────────────
  const handleCopyCode = useCallback(async () => {
    await Clipboard.setStringAsync(shareData.shareCode);
    Alert.alert('Copied!', 'Share code copied to clipboard.');
  }, [shareData.shareCode]);

  // ── Share link ──────────────────────────────────────────────────────────────
  const handleShare = useCallback(async () => {
    const url = `${BASE_URL}/u/${shareData.shareCode}`;
    try {
      await Share.share({
        message: `Track my habits on StreakBoard! ${url}`,
        url,
      });
    } catch (_) {}
  }, [shareData.shareCode]);

  // ── Toggle public/private ───────────────────────────────────────────────────
  const handleTogglePublic = useCallback(async (val) => {
    setToggling(true);
    try {
      if (val) {
        await api.post('/api/social/enable');
      } else {
        await api.post('/api/social/disable');
      }
      setShareData((prev) => ({ ...prev, isProfilePublic: val }));
    } catch (_) {
      Alert.alert('Error', 'Failed to update profile visibility.');
    } finally {
      setToggling(false);
    }
  }, []);

  // ── View friend profile ─────────────────────────────────────────────────────
  const handleViewFriend = useCallback(() => {
    if (!friendCode.trim()) {
      Alert.alert('Required', 'Enter a share code.');
      return;
    }
    Linking.openURL(`${BASE_URL}/u/${friendCode.trim()}`);
  }, [friendCode]);

  const profileUrl = shareData.shareUrl || `${BASE_URL}/u/${shareData.shareCode}`;

  if (loading) {
    return (
      <View style={s.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* Navbar */}
      <View style={s.navbar}>
        <Text style={s.navBrand}>👥 Friends</Text>
        <View />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
            tintColor={COLORS.primary} colors={[COLORS.primary]} />
        }
      >
        {/* ── Section 2: Public profile card ── */}
        <View style={s.card}>
          {/* Card header */}
          <View style={s.cardHeaderRow}>
            <Text style={s.cardTitle}>Your public profile</Text>
            {shareData.isProfilePublic ? (
              <View style={[s.statusBadge, s.statusPublic]}>
                <Text style={[s.statusText, { color: COLORS.success }]}>● Public</Text>
              </View>
            ) : (
              <View style={[s.statusBadge, s.statusPrivate]}>
                <Text style={[s.statusText, { color: COLORS.danger }]}>● Private</Text>
              </View>
            )}
          </View>

          {/* Profile URL row */}
          <View style={s.urlRow}>
            <Text style={s.urlText} numberOfLines={1}>{profileUrl}</Text>
            <TouchableOpacity style={s.copyBtn} onPress={handleCopy} activeOpacity={0.85}>
              <Text style={s.copyBtnText}>{copyText}</Text>
            </TouchableOpacity>
          </View>

          {/* View profile link */}
          <TouchableOpacity onPress={() => Linking.openURL(profileUrl)} activeOpacity={0.75}>
            <Text style={s.viewProfileLink}>View my public profile →</Text>
          </TouchableOpacity>

          {/* Toggle */}
          <View style={s.toggleRow}>
            <Text style={s.toggleLabel}>
              {shareData.isProfilePublic ? 'Make profile private' : 'Make profile public'}
            </Text>
            <Switch
              value={shareData.isProfilePublic}
              onValueChange={handleTogglePublic}
              disabled={toggling}
              trackColor={{ false: COLORS.border, true: COLORS.primary }}
              thumbColor={COLORS.textPrimary}
            />
          </View>
        </View>

        {/* ── Section 3: Add a friend ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Add a friend</Text>
          <View style={s.addRow}>
            <TextInput
              style={s.codeInput}
              value={friendCode}
              onChangeText={setFriendCode}
              placeholder="Enter share code..."
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              fontSize={14}
            />
            <TouchableOpacity style={s.addBtn} onPress={handleViewFriend} activeOpacity={0.85}>
              <Text style={s.addBtnText}>View Profile</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.addHint}>Enter their share code to view their public profile</Text>
        </View>

        {/* ── Section 4: My share code ── */}
        {shareData.shareCode ? (
          <View style={s.card}>
            <Text style={s.cardTitle}>Your share code</Text>
            <Text style={s.cardSubtext}>
              Share this code with friends so they can find you
            </Text>

            {/* Big code display */}
            <View style={s.codeDisplay}>
              <Text style={s.codeText}>{shareData.shareCode}</Text>
            </View>

            {/* Action buttons */}
            <View style={s.codeActionRow}>
              <TouchableOpacity style={s.codeCopyBtn} onPress={handleCopyCode} activeOpacity={0.85}>
                <Text style={s.codeCopyBtnText}>📋 Copy Code</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.codeShareBtn} onPress={handleShare} activeOpacity={0.85}>
                <Text style={s.codeShareBtnText}>🔗 Share Link</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* ── Section 5: Empty friends state ── */}
        <View style={s.emptyFriendsCard}>
          <Text style={s.emptyFriendsEmoji}>👥</Text>
          <Text style={s.emptyFriendsTitle}>No friends yet</Text>
          <Text style={s.emptyFriendsSub}>Share your code and start competing!</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.bg },
  center:  { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 120, paddingTop: 16 },
  navbar:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
              borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.bg },
  navBrand: { fontSize: 20, fontWeight: '800', color: COLORS.primary },

  title:    { color: COLORS.textPrimary, fontSize: 24, fontWeight: '700' },
  subtitle: { color: COLORS.textMuted, fontSize: 13, marginTop: 4, marginBottom: 20 },

  // Cards
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle:   { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700' },
  cardSubtext: { color: COLORS.textMuted, fontSize: 12, marginTop: 4, marginBottom: 12 },

  // Profile card
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  statusBadge:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  statusPublic:  { backgroundColor: COLORS.success + '33', borderColor: COLORS.success + '4d' },
  statusPrivate: { backgroundColor: COLORS.danger  + '33', borderColor: COLORS.danger  + '4d' },
  statusText:    { fontSize: 11, fontWeight: '600' },

  urlRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10,
  },
  urlText:    { flex: 1, color: COLORS.textSecondary, fontSize: 12 },
  copyBtn:    { backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, marginLeft: 8 },
  copyBtnText:{ color: COLORS.textPrimary, fontSize: 12, fontWeight: '600' },

  viewProfileLink: { color: COLORS.primary, fontSize: 12, marginBottom: 12 },

  toggleRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 12, marginTop: 4 },
  toggleLabel:{ color: COLORS.textSecondary, fontSize: 14, flex: 1, marginRight: 12 },

  // Add friend
  addRow:    { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 8 },
  codeInput: {
    flex: 1, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: COLORS.textPrimary, marginRight: 10,
  },
  addBtn:    { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
  addBtnText:{ color: COLORS.textPrimary, fontSize: 13, fontWeight: '600' },
  addHint:   { color: COLORS.textMuted, fontSize: 11 },

  // Share code section
  codeDisplay: {
    backgroundColor: COLORS.bg, borderWidth: 1,
    borderColor: COLORS.primary + '4d', borderRadius: 12,
    padding: 16, alignItems: 'center', marginTop: 4, marginBottom: 12,
  },
  codeText: { color: COLORS.primary, fontSize: 22, fontWeight: '700', letterSpacing: 2 },

  codeActionRow:  { flexDirection: 'row', gap: 10 },
  codeCopyBtn:    { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.primary, alignItems: 'center' },
  codeCopyBtnText:{ color: COLORS.primary, fontSize: 13, fontWeight: '600' },
  codeShareBtn:   { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: 'center' },
  codeShareBtnText:{ color: COLORS.textPrimary, fontSize: 13, fontWeight: '600' },

  // Empty friends
  emptyFriendsCard: {
    backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1,
    borderColor: COLORS.border, padding: 24, alignItems: 'center',
  },
  emptyFriendsEmoji:{ fontSize: 40, marginBottom: 12 },
  emptyFriendsTitle:{ color: COLORS.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  emptyFriendsSub:  { color: COLORS.textMuted, fontSize: 13, textAlign: 'center' },
});
