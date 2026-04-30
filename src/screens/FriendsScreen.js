import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, StatusBar, Image,
  RefreshControl, Switch, Alert, Share, Linking, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import api from '../lib/axios';
import { useTheme } from '../context/ThemeContext';

import { WEB_BASE } from '../config/api';

const BASE_URL = WEB_BASE;

function AvatarCircle({ user, size = 44 }) {
  const bg = getAvatarColor(user?.name);
  if (user?.avatar) {
    return (
      <Image
        source={{ uri: user.avatar }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: bg, alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.38 }}>
        {(user?.name || '?')[0].toUpperCase()}
      </Text>
    </View>
  );
}

function getAvatarColor(name) {
  const palette = ['#7c3aed', '#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#ec4899'];
  return palette[(name?.charCodeAt(0) || 0) % palette.length];
}

export default function FriendsScreen({ navigation }) {
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const [shareData,    setShareData]    = useState({ shareCode: '', shareUrl: '', isProfilePublic: false });
  const [friends,      setFriends]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [friendCode,   setFriendCode]   = useState('');
  const [addingFriend, setAddingFriend] = useState(false);
  const [copyText,     setCopyText]     = useState('Copy');
  const [toggling,     setToggling]     = useState(false);

  // ── Fetch share info ────────────────────────────────────────────────────────
  const fetchShareData = useCallback(async () => {
    try {
      const res = await api.get('/api/social/my-share');
      setShareData(res.data || { shareCode: '', shareUrl: '', isProfilePublic: false });
    } catch (_) {}
  }, []);

  // ── Fetch friends list ──────────────────────────────────────────────────────
  const fetchFriends = useCallback(async () => {
    try {
      const res = await api.get('/api/social/friends');
      setFriends(Array.isArray(res.data) ? res.data : []);
    } catch (_) {}
  }, []);

  const fetchAll = useCallback(async () => {
    await Promise.all([fetchShareData(), fetchFriends()]);
  }, [fetchShareData, fetchFriends]);

  useEffect(() => {
    (async () => { setLoading(true); await fetchAll(); setLoading(false); })();
  }, [fetchAll]);

  // Reload friends every time the tab is focused
  useFocusEffect(useCallback(() => { fetchFriends(); }, [fetchFriends]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await fetchAll(); setRefreshing(false);
  }, [fetchAll]);

  // ── View friend's public profile in-app ────────────────────────────────────
  const handleViewFriend = useCallback(async () => {
    const code = friendCode.trim();
    if (!code) {
      Alert.alert('', 'Please enter a share code first.');
      return;
    }
    setAddingFriend(true);
    try {
      // Fetch public profile by shareCode
      const res = await api.get(`/api/social/u/${code}`);
      const userData = res.data;
      navigation.navigate('PublicProfile', {
        shareCode: code,
        userName: userData?.name || 'User',
        userId: userData?._id,
      });
    } catch (e) {
      Alert.alert('Not Found', 'No public profile found with that share code. Check and try again.');
    } finally {
      setAddingFriend(false);
    }
  }, [friendCode, navigation]);

  // ── Add friend by share code ────────────────────────────────────────────────
  const handleAddFriend = useCallback(async () => {
    const code = friendCode.trim();
    if (!code) {
      Alert.alert('', 'Please enter a share code first.');
      return;
    }
    setAddingFriend(true);
    try {
      await api.post('/api/social/friends/add', { shareCode: code });
      setFriendCode('');
      await fetchFriends();
      Alert.alert('✅ Friend added!', 'They now appear in your friends list.');
    } catch (e) {
      const msg = e.response?.data?.message || 'Could not add friend. Make sure their profile is public.';
      Alert.alert('Error', msg);
    } finally {
      setAddingFriend(false);
    }
  }, [friendCode, fetchFriends]);

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
      await api.post(val ? '/api/social/enable' : '/api/social/disable');
      setShareData((prev) => ({ ...prev, isProfilePublic: val }));
    } catch (_) {
      Alert.alert('Error', 'Could not update profile. Try again.');
    } finally {
      setToggling(false);
    }
  }, []);

  const handleRemoveFriend = useCallback((friend) => {
    Alert.alert(
      'Remove Friend',
      `Remove ${friend.name} from your friends list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/social/friends/${friend.shareCode}`);
              setFriends((prev) => prev.filter((f) => f._id !== friend._id));
            } catch (_) {
              Alert.alert('Error', 'Could not remove friend. Try again.');
            }
          },
        },
      ],
    );
  }, []);

  const profileUrl = shareData.shareUrl || `${BASE_URL}/u/${shareData.shareCode}`;

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      <View style={s.navbar}>
        <Text style={s.navBrand}>👥 Friends</Text>
        <Text style={s.navCount}>{friends.length} friend{friends.length !== 1 ? 's' : ''}</Text>
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
        {/* ── Your public profile card ── */}
        <View style={s.card}>
          <View style={s.cardHeaderRow}>
            <Text style={s.cardTitle}>Your public profile</Text>
            <View style={[s.statusBadge, shareData.isProfilePublic ? s.statusPublic : s.statusPrivate]}>
              <Text style={[s.statusText, { color: shareData.isProfilePublic ? colors.success : colors.danger }]}>
                {shareData.isProfilePublic ? '● Public' : '● Private'}
              </Text>
            </View>
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

        {/* ── Add a friend ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Add a friend</Text>
          <Text style={s.cardSubtext}>Enter their share code to view their profile or add them</Text>
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
              returnKeyType="done"
              onSubmitEditing={handleViewFriend}
            />
          </View>
          <View style={s.addBtnRow}>
            <TouchableOpacity
              style={[s.viewBtn, addingFriend && { opacity: 0.6 }]}
              onPress={handleViewFriend}
              disabled={addingFriend}
              activeOpacity={0.85}
            >
              <Text style={s.viewBtnText}>
                {addingFriend ? '...' : 'View Profile'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.addBtn, addingFriend && { opacity: 0.6 }]}
              onPress={handleAddFriend}
              disabled={addingFriend}
              activeOpacity={0.85}
            >
              <Text style={s.addBtnText}>+ Add Friend</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Your share code ── */}
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

        {/* ── Friends list ── */}
        <View style={s.card}>
          <Text style={[s.cardTitle, { marginBottom: 12 }]}>
            Friends {friends.length > 0 ? `(${friends.length})` : ''}
          </Text>

          {friends.length === 0 ? (
            <View style={s.emptyFriends}>
              <Text style={s.emptyEmoji}>👥</Text>
              <Text style={s.emptyTitle}>No friends yet</Text>
              <Text style={s.emptySub}>Enter a share code above and tap "+ Add Friend"</Text>
            </View>
          ) : (
            friends.map((friend) => (
              <TouchableOpacity
                key={friend._id}
                style={s.friendRow}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('PublicProfile', {
                  shareCode: friend.shareCode,
                  userName: friend.name,
                  userId: friend._id,
                })}
                onLongPress={() => handleRemoveFriend(friend)}
              >
                <AvatarCircle user={friend} size={44} />
                <View style={s.friendInfo}>
                  <Text style={s.friendName} numberOfLines={1}>{friend.name}</Text>
                  <Text style={s.friendSub}>
                    🔥 {friend.currentStreak ?? 0} streak
                    {friend.todayDone != null ? `  ·  ✅ ${friend.todayDone} today` : ''}
                  </Text>
                </View>
                <Text style={s.friendArrow}>›</Text>
              </TouchableOpacity>
            ))
          )}
          {friends.length > 0 && (
            <Text style={s.longPressHint}>Long-press a friend to remove</Text>
          )}
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

  navbar:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
               paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
               borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.bg },
  navBrand:  { fontSize: 20, fontWeight: '800', color: colors.primary },
  navCount:  { fontSize: 12, color: colors.textMuted },

  card:        { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 16 },
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

  addRow:     { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 10 },
  codeInput:  { flex: 1, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.textPrimary },
  addBtnRow:  { flexDirection: 'row', gap: 10 },
  viewBtn:    { flex: 1, borderWidth: 1.5, borderColor: colors.primary, borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  viewBtnText:{ color: colors.primary, fontSize: 13, fontWeight: '600' },
  addBtn:     { flex: 1, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  addBtnText: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },

  codeDisplay:      { backgroundColor: colors.bg, borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 4, marginBottom: 12 },
  codeText:         { color: colors.primary, fontSize: 22, fontWeight: '700', letterSpacing: 2 },
  codeActionRow:    { flexDirection: 'row', gap: 10 },
  codeCopyBtn:      { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.primary, alignItems: 'center' },
  codeCopyBtnText:  { color: colors.primary, fontSize: 13, fontWeight: '600' },
  codeShareBtn:     { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  codeShareBtnText: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },

  // Friends list
  friendRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  friendInfo: { flex: 1, marginLeft: 12 },
  friendName: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  friendSub:  { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  friendArrow:{ color: colors.textMuted, fontSize: 20, paddingLeft: 8 },
  longPressHint: { color: colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 10 },

  emptyFriends: { alignItems: 'center', paddingVertical: 24 },
  emptyEmoji:   { fontSize: 40, marginBottom: 10 },
  emptyTitle:   { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  emptySub:     { color: colors.textMuted, fontSize: 12, marginTop: 6, textAlign: 'center' },
});
