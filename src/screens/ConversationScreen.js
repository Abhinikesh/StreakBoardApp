import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, StatusBar,
  KeyboardAvoidingView, Platform, Alert, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import api from '../lib/axios';
import { useTheme } from '../context/ThemeContext';
import { setActiveConversation, clearActiveConversation } from '../lib/activeConversation';

const MAX_CHARS = 280;
const POLL_MS   = 3000;

function timeLabel(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── Inline error toast (slides up, auto-dismiss or manual) ──────────────────
function ErrorToast({ message, onDismiss }) {
  const slideY = useRef(new Animated.Value(40)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideY,  { toValue: 0, duration: 280, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.errorToast, { transform: [{ translateY: slideY }], opacity }]}>
      <Text style={styles.errorToastIcon}>⚠️</Text>
      <Text style={styles.errorToastTxt} numberOfLines={3}>{message}</Text>
      <TouchableOpacity onPress={onDismiss} style={styles.errorToastClose}>
        <Text style={styles.errorToastCloseTxt}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Blocked wall — shown instead of messages when sender is blocked ──────────
function BlockedWall({ friendName, colors }) {
  return (
    <View style={[styles.blockedWall, { backgroundColor: colors.bg }]}>
      <View style={[styles.blockedCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.blockedEmoji}>🚫</Text>
        <Text style={[styles.blockedTitle, { color: colors.textPrimary }]}>
          You can't message {friendName}
        </Text>
        <Text style={[styles.blockedSub, { color: colors.textMuted }]}>
          You have been blocked by this user. Previous messages are hidden.
        </Text>
      </View>
    </View>
  );
}

// ── Blocked input replacement — shown instead of the text box ───────────────
function BlockedInputBar({ friendName, colors }) {
  return (
    <View style={[styles.blockedBar, { backgroundColor: colors.bg, borderTopColor: colors.border }]}>
      <Text style={styles.blockedBarIcon}>🔇</Text>
      <Text style={[styles.blockedBarTxt, { color: colors.textMuted }]} numberOfLines={2}>
        Messaging unavailable — {friendName} has blocked you.
      </Text>
    </View>
  );
}

export default function ConversationScreen({ route, navigation }) {
  const { friendId, friendName, friendAvatar } = route.params;
  const { colors } = useTheme();

  const [messages,    setMessages]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [sending,     setSending]     = useState(false);
  const [input,       setInput]       = useState('');
  const [myId,        setMyId]        = useState(null);
  const [isBlocked,   setIsBlocked]   = useState(false);   // recipient blocked us
  const [sendError,   setSendError]   = useState(null);    // styled inline error string

  const listRef  = useRef(null);
  const pollRef  = useRef(null);

  // Fetch own id once
  useEffect(() => {
    api.get('/api/user/profile').then(r => setMyId(r.data?._id || r.data?.id)).catch(() => {});
  }, []);

  // ── Detect if a response is a block error ──────────────────────────────────
  const isBlockError = (e) =>
    e?.response?.data?.error === 'BLOCKED' ||
    e?.response?.data?.code  === 'BLOCKED' ||
    e?.response?.status === 403;

  // ── Fetch messages — sets isBlocked if server returns a block code ─────────
  const fetchMessages = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await api.get(`/api/messages/conversation/${friendId}`);
      // If we were previously blocked but the fetch succeeds, unblock
      setIsBlocked(false);
      setMessages(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      if (isBlockError(e)) {
        setIsBlocked(true);
        setMessages([]);    // hide chat history
      }
      // All other errors: keep existing messages visible, fail silently
    } finally {
      setLoading(false);
    }
  }, [friendId]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  // Polling + presence tracking — only while focused
  useFocusEffect(useCallback(() => {
    // Mark conversation as open so App.js suppresses its push notifications
    setActiveConversation(friendId);
    pollRef.current = setInterval(() => fetchMessages(true), POLL_MS);
    return () => {
      clearActiveConversation();
      clearInterval(pollRef.current);
    };
  }, [fetchMessages, friendId]));


  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [messages.length]);

  // ── Send handler ───────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSendError(null);
    setSending(true);

    // Optimistic update
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
      await api.post('/api/messages/send', { receiverId: friendId, content: text });
      await fetchMessages(true);
    } catch (e) {
      // Roll back optimistic message
      setMessages(prev => prev.filter(m => m._id !== optimisticMsg._id));
      setInput(text);

      if (isBlockError(e)) {
        // ── Block-specific inline UI — no raw Alert ──────────────────────────
        setIsBlocked(true);
        setMessages([]);
        // No need for a toast; the BlockedWall + BlockedInputBar make it obvious
      } else {
        // ── Non-block send error → styled inline toast ───────────────────────
        const msg = e?.response?.data?.message || e?.message || 'Could not send message.';
        setSendError(msg);
      }
    } finally {
      setSending(false);
    }
  }, [input, friendId, myId, fetchMessages, sending]);

  // ── Block action ───────────────────────────────────────────────────────────
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
      <View style={[styles.msgRow, isMine && styles.msgRowMine]}>
        <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs,
          isMine ? { backgroundColor: colors.primary } : { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.bubbleTxt, isMine ? styles.bubbleTxtMine : { color: colors.textPrimary }]}>
            {item.content}
          </Text>
          <Text style={[styles.msgTime, isMine ? styles.msgTimeMine : { color: colors.textMuted }]}>
            {timeLabel(item.createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  const canSend = input.trim().length > 0 && input.trim().length <= MAX_CHARS && !sending && !isBlocked;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      {/* Navbar */}
      <View style={[styles.navbar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backTxt, { color: colors.primary }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.navName, { color: colors.textPrimary }]} numberOfLines={1}>
          {friendName}
        </Text>
        <TouchableOpacity onPress={handleBlock} style={styles.moreBtn}>
          <Text style={[styles.moreTxt, { color: colors.textMuted }]}>⋯</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* ── Messages area ── */}
        {loading ? (
          <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
        ) : isBlocked ? (
          // Blocked → show wall instead of chat history
          <BlockedWall friendName={friendName} colors={colors} />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={i => i._id}
            renderItem={renderMessage}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={[styles.emptyTxt, { color: colors.textMuted }]}>No messages yet. Say hello! 👋</Text>
              </View>
            }
          />
        )}

        {/* ── Inline send-error toast (non-block errors only) ── */}
        {sendError && !isBlocked && (
          <ErrorToast message={sendError} onDismiss={() => setSendError(null)} />
        )}

        {/* ── Input bar / blocked bar ── */}
        {isBlocked ? (
          <BlockedInputBar friendName={friendName} colors={colors} />
        ) : (
          <View style={[styles.inputBar, { borderTopColor: colors.border, backgroundColor: colors.bg }]}>
            <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                style={[styles.input, { color: colors.textPrimary }]}
                value={input}
                onChangeText={setInput}
                placeholder="Type a message..."
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={MAX_CHARS}
                returnKeyType="default"
              />
              <Text style={[styles.charCount, { color: colors.textMuted }, input.length > 260 && styles.charCountWarn]}>
                {input.length}/{MAX_CHARS}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: canSend ? colors.primary : colors.border }]}
              onPress={handleSend}
              disabled={!canSend}
              activeOpacity={0.8}
            >
              {sending
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.sendTxt}>↑</Text>
              }
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  navbar:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8,
              paddingVertical: 10, borderBottomWidth: 1 },
  backBtn:  { paddingHorizontal: 10, paddingVertical: 6 },
  backTxt:  { fontSize: 26, lineHeight: 28 },
  navName:  { flex: 1, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  moreBtn:  { paddingHorizontal: 14, paddingVertical: 6 },
  moreTxt:  { fontSize: 22, lineHeight: 24 },

  listContent: { paddingHorizontal: 14, paddingVertical: 12, paddingBottom: 4 },
  msgRow:     { marginBottom: 10, alignItems: 'flex-start' },
  msgRowMine: { alignItems: 'flex-end' },
  bubble:       { maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: 'transparent' },
  bubbleMine:   { borderBottomRightRadius: 4 },
  bubbleTheirs: { borderBottomLeftRadius: 4 },
  bubbleTxt:      { fontSize: 14, lineHeight: 20 },
  bubbleTxtMine:  { color: '#fff' },
  msgTime:        { fontSize: 10, marginTop: 3 },
  msgTimeMine:    { color: 'rgba(255,255,255,0.65)', textAlign: 'right' },

  empty:    { flex: 1, alignItems: 'center', paddingTop: 60 },
  emptyTxt: { fontSize: 14 },

  // ── Input bar ──────────────────────────────────────────────────────────────
  inputBar:  { flexDirection: 'row', alignItems: 'flex-end',
               paddingHorizontal: 12, paddingVertical: 10,
               borderTopWidth: 1 },
  inputWrap: { flex: 1, borderRadius: 22, borderWidth: 1,
               paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8,
               marginRight: 10, minHeight: 44 },
  input:       { fontSize: 14, maxHeight: 100, lineHeight: 20 },
  charCount:   { fontSize: 10, textAlign: 'right', marginTop: 2 },
  charCountWarn: { color: '#ef4444' },
  sendBtn:     { width: 44, height: 44, borderRadius: 22,
                 alignItems: 'center', justifyContent: 'center' },
  sendTxt:     { color: '#fff', fontSize: 20, lineHeight: 22, fontWeight: '700' },

  // ── Inline error toast (non-block send errors) ────────────────────────────
  errorToast: {
    position: 'absolute', bottom: 70, left: 12, right: 12,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1f1f2e',
    borderRadius: 14, borderWidth: 1, borderColor: '#ef444466',
    paddingHorizontal: 14, paddingVertical: 12,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, elevation: 10,
  },
  errorToastIcon:     { fontSize: 18, marginRight: 10 },
  errorToastTxt:      { flex: 1, color: '#f87171', fontSize: 13, lineHeight: 18 },
  errorToastClose:    { marginLeft: 10, padding: 4 },
  errorToastCloseTxt: { color: '#6b7280', fontSize: 16, fontWeight: '700' },

  // ── Blocked wall ──────────────────────────────────────────────────────────
  blockedWall: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32,
  },
  blockedCard: {
    borderRadius: 20, borderWidth: 1, padding: 28,
    alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, elevation: 6,
  },
  blockedEmoji: { fontSize: 48, marginBottom: 16, textAlign: 'center' },
  blockedTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 10 },
  blockedSub:   { fontSize: 13, textAlign: 'center', lineHeight: 19 },

  // ── Blocked input replacement ─────────────────────────────────────────────
  blockedBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderTopWidth: 1,
  },
  blockedBarIcon: { fontSize: 20, marginRight: 10 },
  blockedBarTxt:  { flex: 1, fontSize: 13, lineHeight: 18 },
});
