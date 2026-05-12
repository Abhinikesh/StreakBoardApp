import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, StatusBar, Image,
  RefreshControl, Switch, Alert, Share, Linking, FlatList, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import api from '../lib/axios';
import { useTheme } from '../context/ThemeContext';
import { useOffline } from '../context/OfflineContext';
import OfflineWall from '../components/OfflineWall';

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
  const { isOnline } = useOffline();
  // isOnline guard moved AFTER all hooks below (Rules of Hooks — no early return before hooks)

  const [shareData,    setShareData]    = useState({ shareCode: '', shareUrl: '', isProfilePublic: false });
  const [friends,      setFriends]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [friendCode,   setFriendCode]   = useState('');
  const [addingFriend, setAddingFriend] = useState(false);
  const [copyText,     setCopyText]     = useState('Copy');
  const [toggling,     setToggling]     = useState(false);

  // ── Challenge state ──────────────────────────────────────────────────────
  const [activeTab,       setActiveTab]     = useState('friends'); // 'friends' | 'challenges'
  const [challenges,      setChallenges]    = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedFriend,  setSelectedFriend]  = useState(null);
  const [habitInput,      setHabitInput]    = useState('');
  const [myHabits,        setMyHabits]      = useState([]);
  const [sending,         setSending]       = useState(false);
  const [friendRequests,  setFriendRequests] = useState([]);  // incoming pending requests

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

  const fetchChallenges = useCallback(async () => {
    try {
      const res = await api.get('/api/friend-challenges');
      setChallenges(Array.isArray(res.data) ? res.data : []);
    } catch (_) {}
  }, []);

  // ── Fetch incoming friend requests ───────────────────────────────────────
  const fetchFriendRequests = useCallback(async () => {
    try {
      const res = await api.get('/api/social/friend-requests');
      setFriendRequests(Array.isArray(res.data) ? res.data : []);
    } catch (_) {}
  }, []);

  const fetchAll = useCallback(async () => {
    await Promise.all([fetchShareData(), fetchFriends(), fetchChallenges(), fetchFriendRequests()]);
  }, [fetchShareData, fetchFriends, fetchChallenges, fetchFriendRequests]);

  useEffect(() => {
    (async () => { setLoading(true); await fetchAll(); setLoading(false); })();
  }, [fetchAll]);

  // Reload friends every time the tab is focused
  useFocusEffect(useCallback(() => { fetchFriends(); fetchChallenges(); fetchFriendRequests(); }, [fetchFriends, fetchChallenges, fetchFriendRequests]));

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

  // ── Send a friend request by share code ────────────────────────────────────
  const handleSendRequest = useCallback(async () => {
    const code = friendCode.trim();
    if (!code) { Alert.alert('', 'Please enter a share code first.'); return; }
    setAddingFriend(true);
    try {
      // Resolve shareCode → userId, then POST the request
      const profileRes = await api.get(`/api/social/u/${code}`);
      const targetId = profileRes.data?._id;
      if (!targetId) throw new Error('Could not find that user.');
      await api.post('/api/social/friend-requests', { targetUserId: targetId });
      setFriendCode('');
      Alert.alert('✅ Request Sent!', "They'll get a notification and can accept your request.");
    } catch (e) {
      const msg = e.response?.data?.message || e.message || 'Could not send request. Make sure the profile is public.';
      Alert.alert('Error', msg);
    } finally { setAddingFriend(false); }
  }, [friendCode]);

  // ── Accept / decline incoming friend requests ───────────────────────────────
  const handleAcceptFriendReq = useCallback(async (req) => {
    try {
      await api.patch(`/api/social/friend-requests/${req._id}/accept`);
      setFriendRequests(prev => prev.filter(r => r._id !== req._id));
      await fetchFriends();
      Alert.alert('🎉 Now Friends!', `You and ${req.senderName || 'them'} are now friends.`);
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Could not accept.');
    }
  }, [fetchFriends]);

  const handleDeclineFriendReq = useCallback(async (req) => {
    try {
      await api.patch(`/api/social/friend-requests/${req._id}/decline`);
      setFriendRequests(prev => prev.filter(r => r._id !== req._id));
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Could not decline.');
    }
  }, []);


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

  // ── Challenge actions ───────────────────────────────────────────────────
  const handleOpenCreate = useCallback(async (friend) => {
    setSelectedFriend(friend);
    setHabitInput('');
    try {
      const res = await api.get('/api/habits');
      setMyHabits((res.data || []).filter(h => h.isActive).slice(0, 10));
    } catch (_) { setMyHabits([]); }
    setShowCreateModal(true);
  }, []);

  const handleSendChallenge = useCallback(async () => {
    const habit = habitInput.trim();
    if (!habit) { Alert.alert('', 'Enter a habit name.'); return; }
    if (!selectedFriend?._id) {
      Alert.alert('Error', 'No friend selected. Please close and try again.');
      return;
    }
    setSending(true);
    try {
      console.log('[FriendsScreen] sendChallenge payload:', {
        friendId: selectedFriend._id,
        friendName: selectedFriend.name,
        habitName: habit,
      });
      await api.post('/api/friend-challenges', {
        friendId:  selectedFriend._id,
        habitName: habit,
      });
      setShowCreateModal(false);
      setActiveTab('challenges');
      await fetchChallenges();
      Alert.alert('Challenge Sent! ⚔️', `${selectedFriend.name} has been challenged.`);
    } catch (e) {
      console.error('[FriendsScreen] sendChallenge error:', e?.message, e?.response?.data);
      // Show the real backend message (e.g. "already have an active challenge")
      const errMsg = e?.response?.data?.message || e?.message || 'Could not send challenge.';
      Alert.alert('Error', errMsg);
      // Don't clear habitInput so the user can retry without retyping
    } finally { setSending(false); }
  }, [habitInput, selectedFriend, fetchChallenges]);

  const handleAccept = useCallback(async (id) => {
    try {
      await api.patch(`/api/friend-challenges/${id}/accept`);
      await fetchChallenges();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || 'Could not accept.');
    }
  }, [fetchChallenges]);

  const handleDecline = useCallback(async (id) => {
    Alert.alert('Decline Challenge', 'Decline this challenge?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Decline', style: 'destructive', onPress: async () => {
        try {
          await api.patch(`/api/friend-challenges/${id}/decline`);
          await fetchChallenges();
        } catch (_) {}
      }},
    ]);
  }, [fetchChallenges]);

  const profileUrl = shareData.shareUrl || `${BASE_URL}/u/${shareData.shareCode}`;

  // Offline guard — AFTER all hooks
  if (!isOnline) {
    return <OfflineWall colors={colors} label="Friends & messaging require an internet connection." />;
  }

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      <View style={s.navbar}>
        <Text style={s.navBrand}>👥 Friends</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            style={s.msgNavBtn}
            onPress={() => navigation.navigate('Messages')}
            activeOpacity={0.8}
          >
            <Text style={s.msgNavTxt}>💬</Text>
          </TouchableOpacity>
          <View style={s.tabSwitch}>
            <TouchableOpacity style={[s.tabBtn, activeTab==='friends' && s.tabBtnActive]} onPress={() => setActiveTab('friends')}>
              <Text style={[s.tabBtnTxt, activeTab==='friends' && s.tabBtnTxtActive]}>Friends</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.tabBtn, activeTab==='challenges' && s.tabBtnActive]} onPress={() => { setActiveTab('challenges'); fetchChallenges(); }}>
              <Text style={[s.tabBtnTxt, activeTab==='challenges' && s.tabBtnTxtActive]}>Challenges</Text>
            </TouchableOpacity>
          </View>
        </View>
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
              onPress={handleSendRequest}
              disabled={addingFriend}
              activeOpacity={0.85}
            >
              <Text style={s.addBtnText}>{addingFriend ? 'Sending...' : '👤 Send Request'}</Text>
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

        {/* ── Friend Requests Inbox ── */}
        {friendRequests.length > 0 && (
          <View style={s.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Text style={s.cardTitle}>Friend Requests</Text>
              <View style={{ backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8 }}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{friendRequests.length}</Text>
              </View>
            </View>
            {friendRequests.map((req, idx) => (
              <View key={req._id} style={[s.requestRow, idx < friendRequests.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                <AvatarCircle user={{ name: req.senderName, avatar: req.senderAvatar }} size={44} />
                <View style={s.requestInfo}>
                  <Text style={s.friendName} numberOfLines={1}>{req.senderName || 'Someone'}</Text>
                  <Text style={s.friendSub}>wants to be friends</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity style={s.reqAcceptBtn} onPress={() => handleAcceptFriendReq(req)} activeOpacity={0.85}>
                    <Text style={s.reqAcceptTxt}>✓</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.reqDeclineBtn} onPress={() => handleDeclineFriendReq(req)} activeOpacity={0.85}>
                    <Text style={s.reqDeclineTxt}>✗</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── Friends list ── */}}
        <View style={s.card}>
          <Text style={[s.cardTitle, { marginBottom: 12 }]}>
            Friends {friends.length > 0 ? `(${friends.length})` : ''}
          </Text>

          {friends.length === 0 ? (
            <View style={s.emptyFriends}>
              <Text style={s.emptyEmoji}>👥</Text>
              <Text style={s.emptyTitle}>No friends yet</Text>
              <Text style={s.emptySub}>Enter a share code above to send a friend request</Text>
            </View>
          ) : (
            friends.map((friend) => (
              <TouchableOpacity
                key={friend._id}
                style={s.friendRow}
                activeOpacity={0.8}
                onPress={() => Alert.alert(
                  friend.name, '',
                  [
                    { text: '👤 View Profile', onPress: () => navigation.navigate('PublicProfile', {
                        shareCode: friend.shareCode, userName: friend.name, userId: friend._id,
                      })
                    },
                    { text: '💬 Send Message', onPress: () => navigation.navigate('Conversation', {
                        friendId: friend._id, friendName: friend.name, friendAvatar: friend.avatar,
                      })
                    },
                    { text: 'Cancel', style: 'cancel' },
                  ]
                )}
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
                <TouchableOpacity style={s.challengeBtn} onPress={() => handleOpenCreate(friend)} activeOpacity={0.85}>
                  <Text style={s.challengeBtnTxt}>⚔️</Text>
                </TouchableOpacity>
                <Text style={s.friendArrow}>›</Text>
              </TouchableOpacity>
            ))
          )}
          {friends.length > 0 && (
            <Text style={s.longPressHint}>Long-press a friend to remove</Text>
          )}
        </View>

      </ScrollView>

      {/* ── Challenges Tab ── */}
      {activeTab === 'challenges' && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.bg }}>
          {/* Back header */}
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12,
            borderBottomWidth: 1, borderBottomColor: colors.border,
            backgroundColor: colors.bg,
          }}>
            <TouchableOpacity
              onPress={() => setActiveTab('friends')}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
                alignItems: 'center', justifyContent: 'center', marginRight: 12,
              }}
            >
              <Text style={{ color: colors.primary, fontSize: 18, fontWeight: '700' }}>←</Text>
            </TouchableOpacity>
            <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '800', flex: 1 }}>
              ⚔️ Challenges
            </Text>
          </View>
          <ScrollView
          contentContainerStyle={[s.content, { paddingTop: 16 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary}/>}>
          {challenges.length === 0 ? (
            <View style={s.emptyFriends}>
              <Text style={s.emptyEmoji}>⚔️</Text>
              <Text style={s.emptyTitle}>No challenges yet</Text>
              <Text style={s.emptySub}>Tap the ⚔️ button next to a friend to challenge them.</Text>
            </View>
          ) : challenges.map(c => {
            const isChallenger = c.challengerId?._id === undefined
              ? String(c.challengerId) !== undefined : true;
            const me = c.challengerId;
            const them = c.challengedId;
            const myDays = c.challengerDaysLogged?.length ?? 0;
            const theirDays = c.challengedDaysLogged?.length ?? 0;
            const days = c.startDate
              ? Array.from({length:7},(_,i)=>{ const d=new Date(c.startDate+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+i); return d.toISOString().split('T')[0]; })
              : [];
            const statusColor = c.status==='active' ? colors.primary : c.status==='complete' ? '#16a34a' : c.status==='pending' ? '#f59e0b' : '#ef4444';
            return (
              <View key={c._id} style={s.challengeCard}>
                <View style={s.challengeCardTop}>
                  <View style={[s.statusPill,{backgroundColor:statusColor+'22',borderColor:statusColor+'55'}]}>
                    <Text style={[s.statusPillTxt,{color:statusColor}]}>{c.status.toUpperCase()}</Text>
                  </View>
                  {c.status==='active' && c.endDate && (
                    <Text style={s.challengeDays}>{Math.max(0,Math.ceil((new Date(c.endDate)-new Date())/86400000))}d left</Text>
                  )}
                </View>
                <Text style={s.challengeHabit}>{c.habitName}</Text>
                <View style={s.challengePlayers}>
                  <Text style={s.challengePlayer} numberOfLines={1}>{me?.name ?? 'You'}</Text>
                  <Text style={s.challengeVs}>vs</Text>
                  <Text style={s.challengePlayer} numberOfLines={1}>{them?.name ?? '...'}</Text>
                </View>
                {c.status !== 'pending' && days.length > 0 && (
                  <View style={s.gridRow}>
                    <View style={s.dayGrid}>
                      {days.map(d => (
                        <View key={d+'c'} style={[s.dayDot, c.challengerDaysLogged?.includes(d) && s.dayDotDone]}>
                          <Text style={s.dayDotTxt}>{c.challengerDaysLogged?.includes(d)?'✓':''}</Text>
                        </View>
                      ))}
                    </View>
                    <View style={s.dayGrid}>
                      {days.map(d => (
                        <View key={d+'e'} style={[s.dayDot, c.challengedDaysLogged?.includes(d) && s.dayDotDone]}>
                          <Text style={s.dayDotTxt}>{c.challengedDaysLogged?.includes(d)?'✓':''}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
                {c.status==='complete' && (
                  <Text style={s.resultTxt}>
                    {myDays === theirDays ? '🤝 Tied!' : myDays > theirDays ? '🏆 You won! +50 XP' : `🥈 ${them?.name} won`}
                  </Text>
                )}
                {c.status==='pending' && (
                  <View style={s.pendingActions}>
                    <TouchableOpacity style={s.acceptBtn} onPress={() => handleAccept(c._id)}>
                      <Text style={s.acceptBtnTxt}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.declineBtn} onPress={() => handleDecline(c._id)}>
                      <Text style={s.declineBtnTxt}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
          </ScrollView>
        </View>
      )}

      {/* ── Create Challenge Modal ── */}
      <Modal visible={showCreateModal} animationType="slide" transparent onRequestClose={() => setShowCreateModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Challenge {selectedFriend?.name}</Text>
            <Text style={s.modalSub}>Fixed duration: 7 days</Text>
            <Text style={s.modalLabel}>Habit name</Text>
            <TextInput
              style={s.modalInput}
              value={habitInput}
              onChangeText={setHabitInput}
              placeholder="e.g. Morning Run"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            {myHabits.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:14}}>
                {myHabits.map(h => (
                  <TouchableOpacity key={h._id} style={[s.habitChip, habitInput===h.name && s.habitChipActive]} onPress={() => setHabitInput(h.name)}>
                    <Text style={[s.habitChipTxt, habitInput===h.name && {color:'#fff'}]}>{h.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity style={[s.sendBtn, sending && {opacity:0.6}]} onPress={handleSendChallenge} disabled={sending}>
              <Text style={s.sendBtnTxt}>{sending ? 'Sending...' : '⚔️ Send Challenge'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setShowCreateModal(false)}>
              <Text style={s.cancelBtnTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  challengeBtn:    { backgroundColor: colors.primary+'22', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginRight: 6 },
  challengeBtnTxt: { fontSize: 16 },
  msgNavBtn:       { backgroundColor: colors.primary+'22', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  msgNavTxt:       { fontSize: 16 },

  emptyFriends: { alignItems: 'center', paddingVertical: 24 },
  emptyEmoji:   { fontSize: 40, marginBottom: 10 },
  emptyTitle:   { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  emptySub:     { color: colors.textMuted, fontSize: 12, marginTop: 6, textAlign: 'center' },

  // Tab switcher
  tabSwitch:       { flexDirection: 'row', backgroundColor: colors.border+'88', borderRadius: 10, padding: 3 },
  tabBtn:          { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  tabBtnActive:    { backgroundColor: colors.primary },
  tabBtnTxt:       { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  tabBtnTxtActive: { color: '#fff' },

  // Challenge cards
  challengeCard:    { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 12 },
  challengeCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  statusPill:       { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  statusPillTxt:    { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  challengeDays:    { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  challengeHabit:   { color: colors.textPrimary, fontSize: 16, fontWeight: '800', marginBottom: 6 },
  challengePlayers: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  challengePlayer:  { color: colors.textSecondary, fontSize: 13, fontWeight: '600', flex: 1 },
  challengeVs:      { color: colors.textMuted, fontSize: 12, paddingHorizontal: 8 },
  gridRow:          { gap: 6, marginBottom: 8 },
  dayGrid:          { flexDirection: 'row', gap: 4 },
  dayDot:           { width: 28, height: 28, borderRadius: 6, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  dayDotDone:       { backgroundColor: colors.primary },
  dayDotTxt:        { color: '#fff', fontSize: 11, fontWeight: '700' },
  resultTxt:        { color: colors.textPrimary, fontSize: 14, fontWeight: '700', textAlign: 'center', marginTop: 8 },
  pendingActions:   { flexDirection: 'row', gap: 10, marginTop: 10 },
  acceptBtn:        { flex: 1, backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  acceptBtnTxt:     { color: '#fff', fontWeight: '700', fontSize: 13 },
  declineBtn:       { flex: 1, borderWidth: 1, borderColor: colors.danger||'#ef4444', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  declineBtnTxt:    { color: colors.danger||'#ef4444', fontWeight: '700', fontSize: 13 },

  // Create challenge modal
  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalBox:      { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36 },
  modalTitle:    { color: colors.textPrimary, fontSize: 18, fontWeight: '800', marginBottom: 4 },
  modalSub:      { color: colors.textMuted, fontSize: 12, marginBottom: 16 },
  modalLabel:    { color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6 },
  modalInput:    { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.textPrimary, fontSize: 15, marginBottom: 12 },
  habitChip:     { backgroundColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8 },
  habitChipActive:{ backgroundColor: colors.primary },
  habitChipTxt:  { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  sendBtn:       { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  sendBtnTxt:    { color: '#fff', fontWeight: '800', fontSize: 15 },
  cancelBtn:     { alignItems: 'center', paddingVertical: 10 },
  cancelBtnTxt:  { color: colors.textMuted, fontSize: 14 },
  // Friend request inbox rows
  requestRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 11 },
  requestInfo:   { flex: 1, marginLeft: 12 },
  reqAcceptBtn:  { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  reqAcceptTxt:  { color: '#fff', fontSize: 18, fontWeight: '700' },
  reqDeclineBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 1.5, borderColor: colors.danger || '#ef4444', alignItems: 'center', justifyContent: 'center' },
  reqDeclineTxt: { color: colors.danger || '#ef4444', fontSize: 18, fontWeight: '700' },
});
