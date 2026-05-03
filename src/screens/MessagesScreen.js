import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, StatusBar, Image, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import api from '../lib/axios';
import { useTheme } from '../context/ThemeContext';

const PALETTE = ['#7c3aed','#10b981','#ef4444','#f59e0b','#3b82f6','#ec4899'];
function avatarColor(name) { return PALETTE[(name?.charCodeAt(0) || 0) % PALETTE.length]; }

function Avatar({ user, size = 44 }) {
  const bg = avatarColor(user?.name);
  if (user?.avatar)
    return <Image source={{ uri: user.avatar }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.38 }}>{(user?.name || '?')[0].toUpperCase()}</Text>
    </View>
  );
}

function timeLabel(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60)  return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function MessagesScreen({ navigation }) {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const [convos,     setConvos]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchConvos = useCallback(async () => {
    try {
      const res = await api.get('/api/messages/conversations');
      setConvos(Array.isArray(res.data) ? res.data : []);
    } catch (_) {}
  }, []);

  useEffect(() => {
    (async () => { setLoading(true); await fetchConvos(); setLoading(false); })();
  }, [fetchConvos]);

  useFocusEffect(useCallback(() => { fetchConvos(); }, [fetchConvos]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await fetchConvos(); setRefreshing(false);
  }, [fetchConvos]);

  const renderItem = ({ item }) => {
    const unread = item.unreadCount > 0;
    const isMine = item.lastMessage?.senderId?.toString() === item.partner?._id?.toString()
      ? false : true;
    return (
      <TouchableOpacity
        style={s.row}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('Conversation', {
          friendId:   item.partner._id,
          friendName: item.partner.name,
          friendAvatar: item.partner.avatar,
        })}
      >
        <View style={{ position: 'relative', marginRight: 12 }}>
          <Avatar user={item.partner} size={46} />
          {unread && <View style={s.unreadDot} />}
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[s.name, unread && s.nameBold]} numberOfLines={1}>{item.partner.name}</Text>
            <Text style={s.time}>{timeLabel(item.lastMessage?.createdAt)}</Text>
          </View>
          <Text style={[s.preview, unread && s.previewBold]} numberOfLines={1}>
            {isMine ? '' : 'You: '}{item.lastMessage?.content}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <View style={s.navbar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backTxt}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Messages</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          data={convos}
          keyExtractor={i => i._id?.toString() || i.partner._id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          contentContainerStyle={convos.length === 0 ? s.emptyContainer : { paddingBottom: 120 }}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyEmoji}>💬</Text>
              <Text style={s.emptyTitle}>No messages yet</Text>
              <Text style={s.emptySub}>Go to Friends → tap a friend → Send Message</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.bg },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navbar:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
             paddingHorizontal: 16, paddingVertical: 12,
             borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 60 },
  backTxt: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  title:   { color: colors.textPrimary, fontSize: 17, fontWeight: '800' },
  row:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20,
             paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  unreadDot:   { position: 'absolute', top: 0, right: 0, width: 12, height: 12,
                 borderRadius: 6, backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.bg },
  name:        { color: colors.textSecondary, fontSize: 14, fontWeight: '500', flex: 1, marginRight: 8 },
  nameBold:    { color: colors.textPrimary, fontWeight: '700' },
  time:        { color: colors.textMuted, fontSize: 11 },
  preview:     { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  previewBold: { color: colors.textSecondary, fontWeight: '600' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty:     { alignItems: 'center', padding: 40 },
  emptyEmoji:{ fontSize: 48, marginBottom: 14 },
  emptyTitle:{ color: colors.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 6 },
  emptySub:  { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
});
