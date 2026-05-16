import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Alert, StatusBar, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import api from '../lib/axios';

// ── Avatar circle ──────────────────────────────────────────────────────────────
function Avatar({ name = '?', size = 44, color }) {
  const letter = (name[0] || '?').toUpperCase();
  const PALETTE = ['#7c3aed','#10b981','#ef4444','#f59e0b','#3b82f6','#ec4899','#14b8a6','#f97316'];
  const bg = color || PALETTE[(name.charCodeAt(0) || 0) % PALETTE.length];
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: bg + '30', borderWidth: 2, borderColor: bg,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <Text style={{ color: bg, fontWeight: '800', fontSize: size * 0.42 }}>{letter}</Text>
    </View>
  );
}

// ── Friend card ────────────────────────────────────────────────────────────────
function FriendCard({ friend, onRemove, colors }) {
  const [removing, setRemoving] = useState(false);

  const handleRemove = () => {
    Alert.alert(
      'Remove Friend',
      `Remove ${friend.name} from your friends list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            setRemoving(true);
            try { await onRemove(friend._id || friend.id); }
            finally { setRemoving(false); }
          },
        },
      ],
    );
  };

  const streak       = friend.currentStreak ?? friend.streak ?? 0;
  const totalDone    = friend.totalDone ?? friend.done ?? 0;
  const rate         = friend.completionRate ?? friend.rate ?? 0;
  const habitCount   = friend.habitCount ?? friend.habits ?? 0;

  return (
    <View style={[styles.friendCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Avatar name={friend.name} size={48} />
      <View style={styles.friendInfo}>
        <Text style={[styles.friendName, { color: colors.textPrimary }]} numberOfLines={1}>
          {friend.name}
        </Text>
        <View style={styles.friendStats}>
          <Text style={[styles.stat, { color: colors.primary }]}>🔥 {streak}</Text>
          <Text style={[styles.statDiv, { color: colors.border }]}>·</Text>
          <Text style={[styles.stat, { color: colors.success }]}>✅ {totalDone}</Text>
          <Text style={[styles.statDiv, { color: colors.border }]}>·</Text>
          <Text style={[styles.stat, { color: colors.textMuted }]}>{rate}%</Text>
          <Text style={[styles.statDiv, { color: colors.border }]}>·</Text>
          <Text style={[styles.stat, { color: colors.textMuted }]}>{habitCount} habits</Text>
        </View>
      </View>
      <TouchableOpacity
        onPress={handleRemove}
        disabled={removing}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={[styles.removeBtn, { borderColor: colors.danger + '55' }]}
        activeOpacity={0.7}
      >
        {removing
          ? <ActivityIndicator size="small" color={colors.danger} />
          : <Text style={{ color: colors.danger, fontSize: 16, fontWeight: '700' }}>✕</Text>}
      </TouchableOpacity>
    </View>
  );
}

// ── Search result card ─────────────────────────────────────────────────────────
function SearchResultCard({ user, onAdd, adding, colors }) {
  return (
    <View style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Avatar name={user.name} size={44} />
      <View style={styles.resultInfo}>
        <Text style={[styles.resultName, { color: colors.textPrimary }]} numberOfLines={1}>
          {user.name}
        </Text>
        <Text style={[styles.resultSub, { color: colors.textMuted }]}>
          🔥 {user.currentStreak ?? 0} streak
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.addBtn, { backgroundColor: colors.primary }, adding && { opacity: 0.6 }]}
        onPress={() => onAdd(user)}
        disabled={adding}
        activeOpacity={0.8}
      >
        {adding
          ? <ActivityIndicator size="small" color="#fff" />
          : <Text style={styles.addBtnTxt}>+ Add</Text>}
      </TouchableOpacity>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function FriendsScreen() {
  const { colors } = useTheme();

  const [friends,     setFriends]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);

  const [query,       setQuery]       = useState('');
  const [searching,   setSearching]   = useState(false);
  const [searchResult, setSearchResult] = useState(null); // null | { found: true, user } | { found: false }
  const [addingId,    setAddingId]    = useState(null);

  const fetchFriends = useCallback(async () => {
    try {
      const res = await api.get('/api/social/friends');
      const list = Array.isArray(res.data) ? res.data : [];
      setFriends(list);
    } catch (_) {
      setFriends([]);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    fetchFriends().finally(() => setLoading(false));
  }, [fetchFriends]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFriends();
    setRefreshing(false);
  }, [fetchFriends]);

  const handleSearch = useCallback(async () => {
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
      const status = err?.response?.status;
      if (status === 404) setSearchResult({ found: false });
      else Alert.alert('Error', 'Could not search. Please try again.');
    } finally {
      setSearching(false);
    }
  }, [query]);

  const handleAdd = useCallback(async (user) => {
    const id = user._id || user.id;
    setAddingId(id);
    try {
      await api.post('/api/social/friends/add', { friendId: id });
      setSearchResult(null);
      setQuery('');
      await fetchFriends();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Could not add friend.');
    } finally {
      setAddingId(null);
    }
  }, [fetchFriends]);

  const handleRemove = useCallback(async (friendId) => {
    try {
      // Try DELETE with friendId in path (primary)
      await api.delete(`/api/social/friends/${friendId}`);
      setFriends(prev => prev.filter(f => (f._id || f.id) !== friendId));
    } catch (err) {
      // Fallback: try POST body-based removal
      try {
        await api.post('/api/social/friends/remove', { friendId });
        setFriends(prev => prev.filter(f => (f._id || f.id) !== friendId));
      } catch (err2) {
        Alert.alert('Error', 'Could not remove friend. Please try again.');
      }
    }
  }, []);

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
            {/* Search bar */}
            <Text style={[s.sectionLabel, { color: colors.textMuted }]}>FIND BY USERNAME</Text>
            <View style={[s.searchRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                style={[s.searchInput, { color: colors.textPrimary }]}
                placeholder="Search username..."
                placeholderTextColor={colors.textMuted}
                value={query}
                onChangeText={v => { setQuery(v); setSearchResult(null); }}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={[s.searchBtn, { backgroundColor: colors.primary }, (!query.trim() || searching) && { opacity: 0.5 }]}
                onPress={handleSearch}
                disabled={!query.trim() || searching}
                activeOpacity={0.8}
              >
                {searching
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={s.searchBtnTxt}>Search</Text>}
              </TouchableOpacity>
            </View>

            {/* Search result */}
            {searchResult && (
              searchResult.found ? (
                <SearchResultCard
                  user={searchResult.user}
                  onAdd={handleAdd}
                  adding={addingId === (searchResult.user._id || searchResult.user.id)}
                  colors={colors}
                />
              ) : (
                <View style={[s.notFound, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={{ fontSize: 28, marginBottom: 6 }}>🔍</Text>
                  <Text style={[s.notFoundTxt, { color: colors.textMuted }]}>
                    No user found with that username
                  </Text>
                </View>
              )
            )}

            {/* Friends list header */}
            {friends.length > 0 && (
              <Text style={[s.sectionLabel, { color: colors.textMuted, marginTop: 24 }]}>
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
                Search for a username above to add your first friend
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
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1 },
  navbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
            borderBottomWidth: 1 },
  navBrand: { fontSize: 20, fontWeight: '800' },
  navSub:   { fontSize: 12 },

  headerContent: { paddingHorizontal: 20, paddingTop: 20 },
  sectionLabel:  { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10 },

  searchRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1,
               paddingLeft: 14, paddingRight: 6, paddingVertical: 6, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 6 },
  searchBtn:   { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  searchBtnTxt:{ color: '#fff', fontSize: 13, fontWeight: '700' },

  notFound: { borderRadius: 14, borderWidth: 1, padding: 20, alignItems: 'center', marginBottom: 12 },
  notFoundTxt: { fontSize: 13, textAlign: 'center' },

  list: { paddingHorizontal: 20, paddingBottom: 120 },

  empty:      { alignItems: 'center', marginTop: 60, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 14 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySub:   { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    alignItems: 'center', justifyContent: 'center' },
});

const styles = StyleSheet.create({
  friendCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1,
                padding: 14, marginBottom: 10, gap: 12 },
  friendInfo: { flex: 1 },
  friendName: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  friendStats:{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  stat:       { fontSize: 12, fontWeight: '600' },
  statDiv:    { fontSize: 12 },
  removeBtn:  { width: 32, height: 32, borderRadius: 8, borderWidth: 1,
                alignItems: 'center', justifyContent: 'center' },

  resultCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1,
                padding: 12, marginBottom: 10, gap: 12 },
  resultInfo: { flex: 1 },
  resultName: { fontSize: 15, fontWeight: '700' },
  resultSub:  { fontSize: 12, marginTop: 2 },
  addBtn:     { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
  addBtnTxt:  { color: '#fff', fontSize: 13, fontWeight: '700' },
});
