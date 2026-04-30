import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Modal, StyleSheet, ActivityIndicator,
  StatusBar, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../lib/axios';
import { useTheme } from '../context/ThemeContext';

function formatDateHeader(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).toUpperCase();
}

export default function JournalScreen({ navigation }) {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const [habits,          setHabits]          = useState([]);
  const [allNotedLogs,    setAllNotedLogs]    = useState([]);
  const [selectedHabitId, setSelectedHabitId] = useState('all');
  const [loading,         setLoading]         = useState(true);
  const [refreshing,      setRefreshing]      = useState(false);
  const [showEditModal,   setShowEditModal]   = useState(false);
  const [editingLog,      setEditingLog]      = useState(null);
  const [editingHabit,    setEditingHabit]    = useState(null);
  const [noteText,        setNoteText]        = useState('');
  const [saving,          setSaving]          = useState(false);
  const [inputFocused,    setInputFocused]    = useState(false);

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      const res = await api.get('/api/habits');
      const active = (res.data || []).filter((h) => h.isActive);
      setHabits(active);

      const results = await Promise.all(
        active.map((h) =>
          api.get(`/api/logs/${h._id}`).then((r) => ({
            habit: h,
            logs: (r.data || []).filter((l) => l.note && l.note.trim() !== ''),
          })),
        ),
      );

      const noted = [];
      for (const { habit, logs } of results) {
        for (const log of logs) {
          noted.push({ ...log, habitId: log.habitId || habit._id, _habit: habit });
        }
      }
      noted.sort((a, b) => b.date.localeCompare(a.date));
      setAllNotedLogs(noted);
    } catch (_) {}
  }, []);

  useEffect(() => {
    (async () => { setLoading(true); await fetchAll(); setLoading(false); })();
  }, [fetchAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await fetchAll(); setRefreshing(false);
  }, [fetchAll]);

  // ── Filtered logs ───────────────────────────────────────────────────────────
  const filteredLogs = useMemo(() => {
    if (selectedHabitId === 'all') return allNotedLogs;
    return allNotedLogs.filter(
      (l) => (l.habitId || l._habit?._id) === selectedHabitId,
    );
  }, [allNotedLogs, selectedHabitId]);

  // ── Group by date ───────────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const map = {};
    for (const log of filteredLogs) {
      if (!map[log.date]) map[log.date] = [];
      map[log.date].push(log);
    }
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredLogs]);

  // ── Open edit modal ─────────────────────────────────────────────────────────
  const openEdit = useCallback((log) => {
    setEditingLog(log);
    setEditingHabit(log._habit);
    setNoteText(log.note || '');
    setShowEditModal(true);
  }, []);

  const closeModal = useCallback(() => {
    setShowEditModal(false);
    setEditingLog(null);
    setEditingHabit(null);
    setNoteText('');
    setInputFocused(false);
  }, []);

  // ── Save note ───────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!editingLog) return;
    setSaving(true);
    try {
      await api.put(`/api/logs/${editingLog._id}/note`, { note: noteText.trim() });
      closeModal();
      await fetchAll();
    } catch (_) {
      Alert.alert('Error', 'Failed to save note. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [editingLog, noteText, closeModal, fetchAll]);

  // ── Remove note ─────────────────────────────────────────────────────────────
  const handleRemove = useCallback(async () => {
    if (!editingLog) return;
    setSaving(true);
    try {
      await api.put(`/api/logs/${editingLog._id}/note`, { note: '' });
      closeModal();
      await fetchAll();
    } catch (_) {
      Alert.alert('Error', 'Failed to remove note.');
    } finally {
      setSaving(false);
    }
  }, [editingLog, closeModal, fetchAll]);

  if (loading) {
    return (
      <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

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
        {/* ── Header ── */}
        <Text style={s.title}>📓 My Journal</Text>
        <Text style={s.subtitle}>Your daily habit notes</Text>

        {/* ── Habit filter pills ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.pillsScroll}
          contentContainerStyle={s.pillsContent}
        >
          {/* All pill */}
          <TouchableOpacity
            style={[s.pill, selectedHabitId === 'all' && s.pillActive]}
            onPress={() => setSelectedHabitId('all')}
            activeOpacity={0.75}
          >
            <Text style={[s.pillText, selectedHabitId === 'all' && s.pillTextActive]}>
              All
            </Text>
          </TouchableOpacity>

          {/* One pill per habit */}
          {habits.map((h) => (
            <TouchableOpacity
              key={h._id}
              style={[s.pill, selectedHabitId === h._id && s.pillActive]}
              onPress={() => setSelectedHabitId(h._id)}
              activeOpacity={0.75}
            >
              <Text style={[s.pillText, selectedHabitId === h._id && s.pillTextActive]}>
                {h.icon} {h.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Entries / Empty states ── */}
        {allNotedLogs.length === 0 ? (
          /* Global empty state */
          <View style={s.emptyState}>
            <Text style={s.emptyEmoji}>📓</Text>
            <Text style={s.emptyTitle}>No journal entries yet</Text>
            <Text style={s.emptySub}>
              Add notes when marking habits done or missed
            </Text>
            <TouchableOpacity
              style={s.emptyBtn}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('Dashboard')}
            >
              <Text style={s.emptyBtnText}>Go to Dashboard →</Text>
            </TouchableOpacity>
          </View>
        ) : filteredLogs.length === 0 ? (
          /* Filter empty state */
          <Text style={s.filterEmpty}>No notes for this habit yet</Text>
        ) : (
          /* Grouped entries */
          grouped.map(([date, logs]) => (
            <View key={date}>
              {/* Date header */}
              <Text style={s.dateHeader}>{formatDateHeader(date)}</Text>

              {/* Entry cards */}
              {logs.map((log) => {
                const habit = log._habit;
                const isDone = log.status === 'done';
                return (
                  <View key={log._id} style={s.entryCard}>
                    {/* Top row */}
                    <View style={s.entryTopRow}>
                      <Text style={s.entryEmoji}>{habit?.icon || '📋'}</Text>
                      <View style={s.entryMeta}>
                        <Text style={s.entryHabitName} numberOfLines={1}>
                          {habit?.name || 'Habit'}
                        </Text>
                        <View style={[s.statusBadge,
                          { backgroundColor: isDone ? colors.success + '33' : colors.danger + '33' }
                        ]}>
                          <Text style={[s.statusBadgeText,
                            { color: isDone ? colors.success : colors.danger }
                          ]}>
                            {isDone ? '✓ Done' : '✗ Missed'}
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={() => openEdit(log)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Text style={s.editBtn}>✏️</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Note text */}
                    <Text style={s.noteText}>"{log.note}"</Text>
                  </View>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>

      {/* ── Edit / Add Note Modal ── */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        <View style={s.modalBackdrop}>
          <View style={s.modalSheet}>
            {/* Modal header */}
            <View style={s.modalHeader}>
              <View style={s.modalHeaderLeft}>
                <Text style={s.modalHeaderEmoji}>{editingHabit?.icon || '📋'}</Text>
                <Text style={s.modalHeaderName} numberOfLines={1}>
                  {editingHabit?.name || 'Habit'}
                </Text>
              </View>
              <TouchableOpacity onPress={closeModal} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Date */}
            <Text style={s.modalDate}>
              {editingLog ? formatDateHeader(editingLog.date) : ''}
            </Text>

            {/* Text input */}
            <TextInput
              style={[s.noteInput, inputFocused && s.noteInputFocused]}
              value={noteText}
              onChangeText={setNoteText}
              placeholder="How did it go today? Add a note..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              fontSize={15}
              maxLength={500}
            />

            {/* Save button */}
            <TouchableOpacity
              style={[s.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              activeOpacity={0.85}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color={colors.textPrimary} />
                : <Text style={s.saveBtnText}>Save Note</Text>
              }
            </TouchableOpacity>

            {/* Remove note */}
            {editingLog?.note ? (
              <TouchableOpacity onPress={handleRemove} disabled={saving} activeOpacity={0.75}>
                <Text style={s.removeNoteText}>Remove note</Text>
              </TouchableOpacity>
            ) : null}
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
  content: { paddingHorizontal: 20, paddingBottom: 100, paddingTop: 16 },

  title:    { color: colors.textPrimary, fontSize: 24, fontWeight: '700' },
  subtitle: { color: colors.textMuted, fontSize: 13, marginTop: 4, marginBottom: 16 },

  // Filter pills
  pillsScroll:  { marginBottom: 16 },
  pillsContent: { paddingRight: 20 },
  pill:         { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, marginRight: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  pillActive:   { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText:     { color: colors.textSecondary, fontSize: 12, fontWeight: '500' },
  pillTextActive:{ color: colors.textPrimary, fontWeight: '600' },

  // Date header
  dateHeader: {
    color: colors.textMuted, fontSize: 12, fontWeight: '600',
    letterSpacing: 1, marginTop: 16, marginBottom: 8,
  },

  // Entry card
  entryCard: {
    backgroundColor: colors.card, borderRadius: 16, borderWidth: 1,
    borderColor: colors.border, padding: 16, marginBottom: 10,
  },
  entryTopRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  entryEmoji:      { fontSize: 22, marginRight: 10 },
  entryMeta:       { flex: 1 },
  entryHabitName:  { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  statusBadge:     { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginTop: 3 },
  statusBadgeText: { fontSize: 10, fontWeight: '600' },
  editBtn:         { fontSize: 18 },
  noteText:        { color: colors.textSecondary, fontSize: 14, lineHeight: 20, fontStyle: 'italic' },

  // Empty states
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyEmoji: { fontSize: 48, textAlign: 'center' },
  emptyTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 12 },
  emptySub:   { color: colors.textMuted, fontSize: 13, marginTop: 8, textAlign: 'center' },
  emptyBtn:   { marginTop: 20, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28 },
  emptyBtnText:{ color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  filterEmpty: { color: colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: 40 },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet:    { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
  modalHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  modalHeaderLeft:{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
  modalHeaderEmoji:{ fontSize: 22, marginRight: 8 },
  modalHeaderName: { color: colors.textPrimary, fontSize: 16, fontWeight: '700', flex: 1 },
  modalClose:    { color: colors.textMuted, fontSize: 20 },
  modalDate:     { color: colors.textMuted, fontSize: 12, marginBottom: 16 },

  noteInput: {
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    color: colors.textPrimary, minHeight: 120, marginBottom: 16,
  },
  noteInputFocused: { borderColor: colors.primary },

  saveBtn:     { width: '100%', height: 52, backgroundColor: colors.primary, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  removeNoteText:{ color: colors.danger, fontSize: 12, textAlign: 'center', marginTop: 12 },
});
