/**
 * src/screens/FriendsScreen.js
 *
 * Friends screen with dual add-friend methods:
 *  1. By Username (existing)
 *  2. By Friend Code (new — 6-char alphanumeric)
 *
 * Top:    Your Friend Code + Copy button
 * Middle: Tab switcher → Username search | Code search
 * Bottom: Friends list
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Alert, StatusBar,
  RefreshControl, Animated, Clipboard, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import api from '../lib/axios';

// ── Clipboard compat ─────────────────────────────────────────────────────────
async function copyToClipboard(text) {
  try {
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      Clipboard.setString(text);
    } else {
      await navigator.clipboard.writeText(text);
    }
  } catch (_) {
    Clipboard.setString(text);
  }
}

// ── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, visible, type = 'success' }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(1800),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, message]);

  if (!visible) return null;
  const bg = type === 'error' ? '#ef4444' : '#10b981';
  return (
    <Animated.View style={[toast.wrap, { backgroundColor: bg, opacity }]}>
      <Text style={toast.txt}>{type === 'error' ? '✕ ' : '✓ '}{message}</Text>
    </Animated.View>
  );
}
const toast = StyleSheet.create({
  wrap: { position: 'absolute', top: 90, alignSelf: 'center', paddingHorizontal: 20,
          paddingVertical: 10, borderRadius: 24, zIndex: 999, elevation: 20,
          shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  txt:  { color: '#fff', fontSize: 14, fontWeight: '700' },
});

// ── Avatar ───────────────────────────────────────────────────────────────────
const PALETTE = ['#7c3aed','#10b981','#ef4444','#f59e0b','#3b82f6','#ec4899','#14b8a6','#f97316'];
function Avatar({ name = '?', size = 44 }) {
  const letter = (name[0] || '?').toUpperCase();
  const bg = PALETTE[(name.charCodeAt(0) || 0) % PALETTE.length];
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: bg + '28', borderWidth: 2, borderColor: bg,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <Text style={{ color: bg, fontWeight: '800', fontSize: size * 0.42 }}>{letter}</Text>
    </View>
  );
}

// ── Friend card ──────────────────────────────────────────────────────────────
function FriendCard({ friend, onRemove, colors }) {
  const [removing, setRemoving] = useState(false);
  const streak     = friend.currentStreak ?? friend.streak ?? 0;
  const totalDone  = friend.totalDone ?? friend.done ?? 0;
  const rate       = friend.completionRate ?? friend.rate ?? 0;
  const habitCount = friend.habitCount ?? friend.habits ?? 0;

  const handleRemove = () => {
    Alert.alert('Remove Friend', `Remove ${friend.name} from your friends?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
          setRemoving(true);
          try { await onRemove(friend._id || friend.id); }
          finally { setRemoving(false); }
      }},
    ]);
  };

  return (
    <View style={[s.friendCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Avatar name={friend.name} size={48} />
      <View style={{ flex: 1 }}>
        <Text style={[s.friendName, { color: colors.textPrimary }]} numberOfLines={1}>{friend.name}</Text>
        <View style={s.statRow}>
          <Text style={[s.stat, { color: colors.primary }]}>🔥 {streak}</Text>
          <Text style={[s.dot, { color: colors.border }]}>·</Text>
          <Text style={[s.stat, { color: colors.success }]}>✅ {totalDone}</Text>
          <Text style={[s.dot, { color: colors.border }]}>·</Text>
          <Text style={[s.stat, { color: colors.textMuted }]}>{rate}%</Text>
          <Text style={[s.dot, { color: colors.border }]}>·</Text>
          <Text style={[s.stat, { color: colors.textMuted }]}>{habitCount} habits</Text>
        </View>
      </View>
      <TouchableOpacity onPress={handleRemove} disabled={removing}
        style={[s.removeBtn, { borderColor: colors.danger + '55' }]} activeOpacity={0.7}>
        {removing
          ? <ActivityIndicator size="small" color={colors.danger} />
          : <Text style={{ color: colors.danger, fontSize: 16, fontWeight: '700' }}>✕</Text>}
      </TouchableOpacity>
    </View>
  );
}

// ── Search result card ───────────────────────────────────────────────────────
function ResultCard({ user, onAdd, adding, colors }) {
  return (
    <View style={[s.resultCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Avatar name={user.name} size={44} />
      <View style={{ flex: 1 }}>
        <Text style={[s.friendName, { color: colors.textPrimary }]} numberOfLines={1}>{user.name}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
          🔥 {user.currentStreak ?? 0} streak · {user.totalHabits ?? 0} habits
        </Text>
      </View>
      <TouchableOpacity
        style={[s.addBtn, { backgroundColor: colors.primary }, adding && { opacity: 0.6 }]}
        onPress={() => onAdd(user)} disabled={adding} activeOpacity={0.8}>
        {adding
          ? <ActivityIndicator size="small" color="#fff" />
          : <Text style={s.addBtnTxt}>+ Add</Text>}
      </TouchableOpacity>
    </View>
  );
}

// ── Your Friend Code card ────────────────────────────────────────────────────
function MyCodeCard({ code, onCopy, colors }) {
  return (
    <View style={[s.codeCard, { backgroundColor: colors.card, borderColor: colors.primary + '44' }]}>
      <Text style={[s.codeLabel, { color: colors.textMuted }]}>YOUR FRIEND CODE</Text>
      <View style={[s.codeBox, { borderColor: colors.primary + '66', backgroundColor: colors.primary + '0D' }]}>
        <Text style={[s.codeText, { color: colors.primary }]}>
          {code || '——————'}
        </Text>
      </View>
      <TouchableOpacity
        style={[s.copyBtn, { borderColor: colors.primary + '55', backgroundColor: colors.primary + '14' }]}
        onPress={onCopy} activeOpacity={0.75} disabled={!code}>
        <Text style={[s.copyBtnTxt, { color: colors.primary }]}>📋  Copy Code</Text>
      </TouchableOpacity>
      <Text style={[s.codeHint, { color: colors.textMuted }]}>
        Share this code with friends so they can add you instantly
      </Text>
    </View>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────
export default function FriendsScreen() {
  const { colors } = useTheme();

  // ── State ─────────────────────────────────────────────────────────────────
  const [friends,     setFriends]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [myCode,      setMyCode]      = useState(null);

  // Tab: 'username' | 'code'
  const [addTab,      setAddTab]      = useState('username');

  // Username search
  const [query,       setQuery]       = useState('');
  const [searching,   setSearching]   = useState(false);
  const [searchResult, setSearchResult] = useState(null);

  // Code search
  const [codeInput,   setCodeInput]   = useState('');
  const [codeSearching, setCodeSearching] = useState(false);
  const [codeResult,  setCodeResult]  = useState(null);

  // Adding
  const [addingId,    setAddingId]    = useState(null);

  // Toast
  const [toastMsg,    setToastMsg]    = useState('');
  const [toastType,   setToastType]   = useState('success');
  const [toastVis,    setToastVis]    = useState(false);

  const toastTimer = useRef(null);

  const showToast = useCallback((msg, type = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg(msg);
    setToastType(type);
    setToastVis(true);
    toastTimer.current = setTimeout(() => setToastVis(false), 2500);
  }, []);

  // ── Fetch friends + my code ───────────────────────────────────────────────
  const fetchFriends = useCallback(async () => {
    try {
      const res = await api.get('/api/social/friends');
      setFriends(Array.isArray(res.data) ? res.data : []);
    } catch (_) { setFriends([]); }
  }, []);

  const fetchMyCode = useCallback(async () => {
    try {
      const res = await api.get('/api/user/profile');
      const code = res.data?.friendCode || res.data?.friend_code || null;
      setMyCode(code);
    } catch (_) {}
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    Promise.all([fetchFriends(), fetchMyCode()]).finally(() => setLoading(false));
  }, [fetchFriends, fetchMyCode]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchFriends(), fetchMyCode()]);
    setRefreshing(false);
  }, [fetchFriends, fetchMyCode]);

  // ── Copy code ─────────────────────────────────────────────────────────────
  const handleCopy = useCallback(async () => {
    if (!myCode) return;
    await copyToClipboard(myCode);
    showToast('Friend code copied!');
  }, [myCode, showToast]);

  // ── Username search ───────────────────────────────────────────────────────
  const handleUsernameSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchResult(null);
    try {
      const res = await api.get(`/api/social/search?username=${encodeURIComponent(q)}`);
      const user = res.data;
      if (user && (user._id || user.id)) {
        setSearchResult({ found: true, user });
      } else {
        setSearchResult({ found: false });
      }
    } catch (err) {
      if (err?.response?.status === 404) setSearchResult({ found: false });
      else Alert.alert('Error', 'Could not search. Please try again.');
    } finally {
      setSearching(false);
    }
  }, [query]);

  // ── Code search ───────────────────────────────────────────────────────────
  const handleCodeSearch = useCallback(async () => {
    const code = codeInput.trim().toUpperCase();
    if (!code) return;
    setCodeSearching(true);
    setCodeResult(null);
    try {
      const res = await api.get(`/api/users/by-code/${encodeURIComponent(code)}`);
      const user = res.data;
      if (user && (user._id || user.id || user.userId)) {
        setCodeResult({ found: true, user });
      } else {
        setCodeResult({ found: false });
      }
    } catch (err) {
      if (err?.response?.status === 404) setCodeResult({ found: false });
      else Alert.alert('Error', 'Could not look up code. Please try again.');
    } finally {
      setCodeSearching(false);
    }
  }, [codeInput]);

  // ── Add friend (shared logic) ─────────────────────────────────────────────
  const handleAdd = useCallback(async (user) => {
    const id = user._id || user.id || user.userId;
    setAddingId(id);
    try {
      await api.post('/api/social/friends/add', { friendId: id });
      setSearchResult(null);
      setCodeResult(null);
      setQuery('');
      setCodeInput('');
      await fetchFriends();
      showToast('Friend added! 🎉');
    } catch (err) {
      const msg = err?.response?.data?.message || 'Could not add friend.';
      const isAlready = msg.toLowerCase().includes('already');
      showToast(isAlready ? 'Already friends!' : msg, 'error');
    } finally {
      setAddingId(null);
    }
  }, [fetchFriends, showToast]);

  // ── Remove friend ─────────────────────────────────────────────────────────
  const handleRemove = useCallback(async (friendId) => {
    try {
      await api.delete(`/api/social/friends/${friendId}`);
      setFriends(prev => prev.filter(f => (f._id || f.id) !== friendId));
    } catch (_) {
      try {
        await api.post('/api/social/friends/remove', { friendId });
        setFriends(prev => prev.filter(f => (f._id || f.id) !== friendId));
      } catch {
        Alert.alert('Error', 'Could not remove friend. Please try again.');
      }
    }
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      {/* Navbar */}
      <View style={[s.navbar, { borderBottomColor: colors.border }]}>
        <Text style={[s.navBrand, { color: colors.primary }]}>👥 Friends</Text>
        <Text style={[s.navSub, { color: colors.textMuted }]}>{friends.length} friends</Text>
      </View>

      <FlatList
        data={friends}
        keyExtractor={f => f._id || f.id || f.name}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
            tintColor={colors.primary} colors={[colors.primary]} />
        }
        ListHeaderComponent={
          <View style={s.headerContent}>

            {/* ── Your Friend Code ── */}
            <MyCodeCard code={myCode} onCopy={handleCopy} colors={colors} />

            {/* ── Add Friend section ── */}
            <Text style={[s.sectionLabel, { color: colors.textMuted, marginTop: 22, marginBottom: 12 }]}>
              ADD A FRIEND
            </Text>

            {/* Tab switcher */}
            <View style={[s.tabRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {[['username', '@ Username'], ['code', '# Code']].map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  style={[s.tab, addTab === key && { borderBottomColor: colors.primary, borderBottomWidth: 2.5 }]}
                  onPress={() => {
                    setAddTab(key);
                    setSearchResult(null);
                    setCodeResult(null);
                  }}
                  activeOpacity={0.8}>
                  <Text style={[s.tabTxt, { color: addTab === key ? colors.primary : colors.textMuted }]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Username search panel */}
            {addTab === 'username' && (
              <View style={s.panel}>
                <View style={[s.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <TextInput
                    style={[s.input, { color: colors.textPrimary }]}
                    placeholder="Search username..."
                    placeholderTextColor={colors.textMuted}
                    value={query}
                    onChangeText={v => { setQuery(v); setSearchResult(null); }}
                    onSubmitEditing={handleUsernameSearch}
                    returnKeyType="search"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    style={[s.actionBtn, { backgroundColor: colors.primary },
                            (!query.trim() || searching) && { opacity: 0.5 }]}
                    onPress={handleUsernameSearch}
                    disabled={!query.trim() || searching}
                    activeOpacity={0.8}>
                    {searching
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={s.actionBtnTxt}>Search</Text>}
                  </TouchableOpacity>
                </View>

                {searchResult && (
                  searchResult.found ? (
                    <ResultCard
                      user={searchResult.user}
                      onAdd={handleAdd}
                      adding={addingId === (searchResult.user._id || searchResult.user.id)}
                      colors={colors}
                    />
                  ) : (
                    <View style={[s.notFound, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Text style={{ fontSize: 26, marginBottom: 4 }}>🔍</Text>
                      <Text style={[s.notFoundTxt, { color: colors.textMuted }]}>
                        No user found with that username
                      </Text>
                    </View>
                  )
                )}
              </View>
            )}

            {/* Code search panel */}
            {addTab === 'code' && (
              <View style={s.panel}>
                <View style={[s.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <TextInput
                    style={[s.input, s.codeInputFont, { color: colors.primary }]}
                    placeholder="Enter friend code..."
                    placeholderTextColor={colors.textMuted}
                    value={codeInput}
                    onChangeText={v => {
                      // Allow only alphanumeric, max 6 chars, uppercase
                      const cleaned = v.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
                      setCodeInput(cleaned);
                      setCodeResult(null);
                    }}
                    onSubmitEditing={handleCodeSearch}
                    returnKeyType="search"
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={6}
                  />
                  <TouchableOpacity
                    style={[s.actionBtn, { backgroundColor: colors.primary },
                            (codeInput.trim().length < 6 || codeSearching) && { opacity: 0.5 }]}
                    onPress={handleCodeSearch}
                    disabled={codeInput.trim().length < 6 || codeSearching}
                    activeOpacity={0.8}>
                    {codeSearching
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={s.actionBtnTxt}>Find</Text>}
                  </TouchableOpacity>
                </View>

                <Text style={[s.codeInputHint, { color: colors.textMuted }]}>
                  Enter a 6-character code (e.g. AB12CD)
                </Text>

                {codeResult && (
                  codeResult.found ? (
                    <ResultCard
                      user={codeResult.user}
                      onAdd={handleAdd}
                      adding={addingId === (codeResult.user._id || codeResult.user.id || codeResult.user.userId)}
                      colors={colors}
                    />
                  ) : (
                    <View style={[s.notFound, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Text style={{ fontSize: 26, marginBottom: 4 }}>🔍</Text>
                      <Text style={[s.notFoundTxt, { color: colors.textMuted }]}>
                        No user found with that friend code
                      </Text>
                    </View>
                  )
                )}
              </View>
            )}

            {/* Friends list header */}
            {friends.length > 0 && (
              <Text style={[s.sectionLabel, { color: colors.textMuted, marginTop: 28, marginBottom: 2 }]}>
                YOUR FRIENDS
              </Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <FriendCard friend={item} onRemove={handleRemove} colors={colors} />
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={s.empty}>
              <Text style={s.emptyEmoji}>👥</Text>
              <Text style={[s.emptyTitle, { color: colors.textPrimary }]}>No friends yet</Text>
              <Text style={[s.emptySub, { color: colors.textMuted }]}>
                Search by username or share your friend code above to add friends
              </Text>
            </View>
          ) : null
        }
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
      />

      {loading && (
        <View style={s.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      <Toast message={toastMsg} visible={toastVis} type={toastType} />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1 },

  navbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, borderBottomWidth: 1 },
  navBrand: { fontSize: 20, fontWeight: '800' },
  navSub:   { fontSize: 12 },

  headerContent: { paddingHorizontal: 20, paddingTop: 20 },
  sectionLabel:  { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },

  // ── Friend code card
  codeCard: { borderRadius: 18, borderWidth: 1.5, padding: 18, marginBottom: 4,
              alignItems: 'center' },
  codeLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 12 },
  codeBox:   { borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 28,
               paddingVertical: 14, marginBottom: 14, width: '100%', alignItems: 'center' },
  codeText:  { fontSize: 30, fontWeight: '800', letterSpacing: 8,
               fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace' },
  copyBtn:   { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1.5,
               paddingHorizontal: 24, paddingVertical: 11, marginBottom: 10 },
  copyBtnTxt:{ fontSize: 14, fontWeight: '700' },
  codeHint:  { fontSize: 11, textAlign: 'center', lineHeight: 16, paddingHorizontal: 8 },

  // ── Add friend tabs
  tabRow: { flexDirection: 'row', borderRadius: 14, borderWidth: 1,
            marginBottom: 14, overflow: 'hidden' },
  tab:    { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0 },
  tabTxt: { fontSize: 14, fontWeight: '700' },

  panel: { marginBottom: 4 },

  // ── Input rows
  inputRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1,
              paddingLeft: 14, paddingRight: 6, paddingVertical: 6, marginBottom: 10 },
  input:    { flex: 1, fontSize: 15, paddingVertical: 6 },
  codeInputFont: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 16, letterSpacing: 3, fontWeight: '700',
  },
  codeInputHint: { fontSize: 11, marginTop: -4, marginBottom: 10, paddingHorizontal: 4 },

  actionBtn:    { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  actionBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // ── Result / not-found
  resultCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1,
                padding: 12, marginBottom: 10, gap: 12 },
  addBtn:    { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
  addBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },

  notFound:    { borderRadius: 14, borderWidth: 1, padding: 18, alignItems: 'center', marginBottom: 12 },
  notFoundTxt: { fontSize: 13, textAlign: 'center' },

  // ── Friends list items
  friendCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1,
                padding: 14, marginBottom: 10, gap: 12 },
  friendName: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  statRow:    { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  stat:       { fontSize: 12, fontWeight: '600' },
  dot:        { fontSize: 12 },
  removeBtn:  { width: 32, height: 32, borderRadius: 8, borderWidth: 1,
                alignItems: 'center', justifyContent: 'center' },

  // ── Empty / loading
  list:           { paddingHorizontal: 20, paddingBottom: 120 },
  empty:          { alignItems: 'center', marginTop: 40, paddingHorizontal: 32 },
  emptyEmoji:     { fontSize: 48, marginBottom: 14 },
  emptyTitle:     { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySub:       { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    alignItems: 'center', justifyContent: 'center' },
});
