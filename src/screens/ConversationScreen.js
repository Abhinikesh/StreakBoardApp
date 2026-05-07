import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, StatusBar, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import api from '../lib/axios';
import { useTheme } from '../context/ThemeContext';

const MAX_CHARS = 280;
const POLL_MS   = 3000; // 3-second polling

function timeLabel(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ConversationScreen({ route, navigation }) {
  const { friendId, friendName, friendAvatar } = route.params;
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const [messages,  setMessages]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [sending,   setSending]   = useState(false);
  const [input,     setInput]     = useState('');
  const [myId,      setMyId]      = useState(null);
  const listRef  = useRef(null);
  const pollRef  = useRef(null);

  // Fetch myId once
  useEffect(() => {
    api.get('/api/user/profile').then(r => setMyId(r.data?._id || r.data?.id)).catch(() => {});
  }, []);

  const fetchMessages = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await api.get(`/api/messages/conversation/${friendId}`);
      setMessages(Array.isArray(res.data) ? res.data : []);
    } catch (_) {}
    finally { setLoading(false); }
  }, [friendId]);

  // Initial load
  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  // 3-second polling while screen is focused
  useFocusEffect(useCallback(() => {
    pollRef.current = setInterval(() => fetchMessages(true), POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [fetchMessages]));

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);

    // Optimistic update — show the message immediately
    const optimisticMsg = {
      _id:        `opt-${Date.now()}`,
      senderId:   myId,
      receiverId: friendId,
      content:    text,
      createdAt:  new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setInput('');

    try {
      console.log('[ConversationScreen] sendMessage payload:', { receiverId: friendId, content: text });
      const res = await api.post('/api/messages/send', { receiverId: friendId, content: text });
      console.log('[ConversationScreen] sendMessage success:', res.data?._id);
      // Replace optimistic entry with real server entry on next poll
      await fetchMessages(true);
    } catch (e) {
      console.error('[ConversationScreen] sendMessage error:', e?.message, e?.response?.data);
      // Roll back the optimistic message
      setMessages(prev => prev.filter(m => m._id !== optimisticMsg._id));
      setInput(text); // restore typed text
      const errMsg = e?.response?.data?.message || e?.message || 'Could not send message.';
      Alert.alert('Error', errMsg);
    } finally {
      setSending(false);
    }
  }, [input, friendId, myId, fetchMessages, sending]);

  const handleBlock = useCallback(() => {
    Alert.alert(`Block ${friendName}?`, 'They will not be able to message you.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Block', style: 'destructive', onPress: async () => {
        try {
          await api.post(`/api/messages/block/${friendId}`);
          Alert.alert('Blocked', `${friendName} has been blocked.`);
          navigation.goBack();
        } catch (_) {}
      }},
    ]);
  }, [friendId, friendName, navigation]);

  const renderMessage = ({ item }) => {
    const isMine = item.senderId?.toString() === myId?.toString();
    return (
      <View style={[s.msgRow, isMine && s.msgRowMine]}>
        <View style={[s.bubble, isMine ? s.bubbleMine : s.bubbleTheirs]}>
          <Text style={[s.bubbleTxt, isMine ? s.bubbleTxtMine : s.bubbleTxtTheirs]}>
            {item.content}
          </Text>
          <Text style={[s.msgTime, isMine ? s.msgTimeMine : s.msgTimeTheirs]}>
            {timeLabel(item.createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  const canSend = input.trim().length > 0 && input.trim().length <= MAX_CHARS && !sending;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      {/* Navbar */}
      <View style={s.navbar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backTxt}>‹</Text>
        </TouchableOpacity>
        <Text style={s.navName} numberOfLines={1}>{friendName}</Text>
        <TouchableOpacity onPress={handleBlock} style={s.moreBtn}>
          <Text style={s.moreTxt}>⋯</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Messages list */}
        {loading ? (
          <View style={s.center}><ActivityIndicator color={colors.primary} /></View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={i => i._id}
            renderItem={renderMessage}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={s.empty}>
                <Text style={s.emptyTxt}>No messages yet. Say hello! 👋</Text>
              </View>
            }
          />
        )}

        {/* Input bar */}
        <View style={s.inputBar}>
          <View style={s.inputWrap}>
            <TextInput
              style={s.input}
              value={input}
              onChangeText={setInput}
              placeholder="Type a message..."
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={MAX_CHARS}
              returnKeyType="default"
            />
            <Text style={[s.charCount, input.length > 260 && s.charCountWarn]}>
              {input.length}/{MAX_CHARS}
            </Text>
          </View>
          <TouchableOpacity
            style={[s.sendBtn, !canSend && s.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!canSend}
            activeOpacity={0.8}
          >
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={s.sendTxt}>↑</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  navbar:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8,
              paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn:  { paddingHorizontal: 10, paddingVertical: 6 },
  backTxt:  { color: colors.primary, fontSize: 26, lineHeight: 28 },
  navName:  { flex: 1, color: colors.textPrimary, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  moreBtn:  { paddingHorizontal: 14, paddingVertical: 6 },
  moreTxt:  { color: colors.textMuted, fontSize: 22, lineHeight: 24 },

  listContent: { paddingHorizontal: 14, paddingVertical: 12, paddingBottom: 4 },
  msgRow:     { marginBottom: 10, alignItems: 'flex-start' },
  msgRowMine: { alignItems: 'flex-end' },
  bubble:       { maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  bubbleMine:   { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  bubbleTxt:      { fontSize: 14, lineHeight: 20 },
  bubbleTxtMine:  { color: '#fff' },
  bubbleTxtTheirs:{ color: colors.textPrimary },
  msgTime:        { fontSize: 10, marginTop: 3 },
  msgTimeMine:    { color: 'rgba(255,255,255,0.65)', textAlign: 'right' },
  msgTimeTheirs:  { color: colors.textMuted },

  empty:    { flex: 1, alignItems: 'center', paddingTop: 60 },
  emptyTxt: { color: colors.textMuted, fontSize: 14 },

  inputBar:  { flexDirection: 'row', alignItems: 'flex-end',
               paddingHorizontal: 12, paddingVertical: 10,
               borderTopWidth: 1, borderTopColor: colors.border,
               backgroundColor: colors.bg },
  inputWrap: { flex: 1, backgroundColor: colors.card, borderRadius: 22,
               borderWidth: 1, borderColor: colors.border,
               paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8,
               marginRight: 10, minHeight: 44 },
  input:       { color: colors.textPrimary, fontSize: 14, maxHeight: 100, lineHeight: 20 },
  charCount:   { color: colors.textMuted, fontSize: 10, textAlign: 'right', marginTop: 2 },
  charCountWarn: { color: '#ef4444' },
  sendBtn:         { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary,
                     alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: colors.border },
  sendTxt:         { color: '#fff', fontSize: 20, lineHeight: 22, fontWeight: '700' },
});
