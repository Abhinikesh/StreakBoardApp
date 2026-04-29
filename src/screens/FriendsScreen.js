import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, SafeAreaView, StatusBar,
  RefreshControl, Switch, Alert, Share, Linking,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import api from '../lib/axios';
import { useTheme } from '../context/ThemeContext';

const BASE_URL = 'https://streak-o.vercel.app';

export default function FriendsScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const [shareData,  setShareData]  = useState({ shareCode: '', shareUrl: '', isProfilePublic: false });
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [friendCode, setFriendCode] = useState('');
  const [copyText,   setCopyText]   = useState('Copy');
  const [toggling,   setToggling]   = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [shareRes] = await Promise.all([
        api.get('/api/social/my-share'),
      ]);
      setShareData(shareRes.data || { shareCode: '', shareUrl: '', isProfilePublic: false });
    } catch (_) {}
  }, []);

  useEffect(() => {
    (async () => { setLoading(true); await fetchAll(); setLoading(false); })();
  }, [fetchAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await fetchAll(); setRefreshing(false);
  }, [fetchAll]);

  const handleCopy = useCallback(async () => {
    const url = shareData.shareUrl || `${BASE_URL}/u/${shareData.shareCode}`;
    await Clipboard.setStringAsync(url);
    setCopyText('Copied!');
    setTimeout(() => setCopyText('Copy'), 2000);
  }, [shareData]);

  const handleCopyCode = useCallback(async () => {
    await Clipboard.setStringAsync(shareData.shareCode);
    Alert.alert('Copied!', 'Share code copied to clipboard.');
  }, [shareData.shareCode]);

  const handleShare = useCallback(async () => {
    const url = shareData.shareUrl || `${BASE_URL}/u/${shareData.shareCode}`;
    try {
      await Share.share({ message: `Track my habits on StreakBoard! ${url}`, url });
    } catch (_) {}
  }, [shareData]);

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
      Alert.alert('Error', 'Could not update profile. Try again.');
    } finally {
      setToggling(false);
    }
  }, []);

  const handleViewFriend = useCallback(async () => {
    if (!friendCode.trim()) {
      Alert.alert('Enter a share code first');
      return;
    }
    const url = `${BASE_URL}/u/${friendCode.trim()}`;
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Cannot open URL');
    }
  }, [friendCode]);

  const profileUrl = shareData.shareUrl || `${BASE_URL}/u/${shareData.shareCode}`;

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

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
            tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {/* Public profile card */}
        <View style={s.card}>
          <View style={s.cardHeaderRow}>
            <Text style={s.cardTitle}>Your public profile</Text>
            {shareData.isProfilePublic ? (
              <View style={[s.statusBadge, s.statusPublic]}>
                <Text style={[s.statusText, { color: colors.success }]}>● Public</Text>
              </View>
            ) : (
              <View style={[s.statusBadge, s.statusPrivate]}>
                <Text style={[s.statusText, { color: colors.danger }]}>● Private</Text>
              </View>
            )}
          </View>

          <View style={s.urlRow}>
            <Text style={s.urlText} numberOfLines={1}>{profileUrl}</Text>
            <TouchableOpacity style={s.copyBtn} onPress={handleCopy} activeOpacity={0.85}>
              <Text style={s.copyBtnText}>{copyText}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => Linking.openURL(profileUrl)} activeOpacity={0.75}>
            <Text style={s.viewProfileLink}>View my public profile →</Text>
          </TouchableOpacity>

          <View style={s.toggleRow}>
            <Text style={s.toggleLabel}>
              {shareData.isProfilePublic ? 'Make profile private' : 'Make profile public'}
            </Text>
            <Switch
              value={shareData.isProfilePublic}
              onValueChange={handleTogglePublic}
              disabled={toggling}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.textPrimary}
            />
          </View>
        </View>

        {/* Add a friend */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Add a friend</Text>
          <View style={s.addRow}>
            <TextInput
              style={s.codeInput}
              value={friendCode}
              onChangeText={setFriendCode}
              placeholder="Enter share code..."
              placeholderTextColor={colors.textMuted}
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

        {/* My share code */}
        {shareData.shareCode ? (
          <View style={s.card}>
            <Text style={s.cardTitle}>Your share code</Text>
            <Text style={s.cardSubtext}>Share this code with friends so they can find you</Text>
            <View style={s.codeDisplay}>
              <Text style={s.codeText}>{shareData.shareCode}</Text>
            </View>
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

        {/* Empty friends state */}
        <View style={s.emptyFriendsCard}>
          <Text style={s.emptyFriendsEmoji}>👥</Text>
          <Text style={s.emptyFriendsTitle}>No friends yet</Text>
          <Text style={s.emptyFriendsSub}>Share your code and start competing!</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.bg },
  center:  { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 120, paddingTop: 16 },

  navbar:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
              borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.bg },
  navBrand: { fontSize: 20, fontWeight: '800', color: colors.primary },

  card: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 16 },
  cardTitle:   { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  cardSubtext: { color: colors.textMuted, fontSize: 12, marginTop: 4, marginBottom: 12 },

  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  statusBadge:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  statusPublic:  { backgroundColor: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.3)' },
  statusPrivate: { backgroundColor: 'rgba(239,68,68,0.12)',  borderColor: 'rgba(239,68,68,0.3)' },
  statusText:    { fontSize: 11, fontWeight: '600' },

  urlRow:     { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 },
  urlText:    { flex: 1, color: colors.textSecondary, fontSize: 12 },
  copyBtn:    { backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, marginLeft: 8 },
  copyBtnText:{ color: colors.textPrimary, fontSize: 12, fontWeight: '600' },

  viewProfileLink: { color: colors.primary, fontSize: 12, marginBottom: 12 },

  toggleRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, marginTop: 4 },
  toggleLabel:{ color: colors.textSecondary, fontSize: 14, flex: 1, marginRight: 12 },

  addRow:    { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 8 },
  codeInput: { flex: 1, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.textPrimary, marginRight: 10 },
  addBtn:    { backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
  addBtnText:{ color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  addHint:   { color: colors.textMuted, fontSize: 11 },

  codeDisplay:      { backgroundColor: colors.bg, borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 4, marginBottom: 12 },
  codeText:         { color: colors.primary, fontSize: 22, fontWeight: '700', letterSpacing: 2 },
  codeActionRow:    { flexDirection: 'row', gap: 10 },
  codeCopyBtn:      { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.primary, alignItems: 'center' },
  codeCopyBtnText:  { color: colors.primary, fontSize: 13, fontWeight: '600' },
  codeShareBtn:     { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  codeShareBtnText: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },

  emptyFriendsCard:  { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 24, alignItems: 'center' },
  emptyFriendsEmoji: { fontSize: 40, marginBottom: 12 },
  emptyFriendsTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  emptyFriendsSub:   { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
});
