/**
 * src/components/EmptyState.js
 *
 * Reusable empty state component — replaces bare grey text placeholders.
 * Uses RN View compositions for the illustration (no external SVG dep needed).
 *
 * Usage:
 *   <EmptyState
 *     type="habits"                        // selects the illustration
 *     heading="No habits yet"
 *     subheading="Add your first habit to get started"
 *     action={{ label: 'Add Habit', onPress: () => {} }}  // optional
 *   />
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

// ── Illustration components (pure View, no external deps) ─────────────────────
function HabitsIllustration({ color }) {
  return (
    <View style={ill.wrap}>
      {/* Three stacked rows (habit cards) */}
      {[0, 1, 2].map((i) => (
        <View key={i} style={[ill.row, { opacity: 1 - i * 0.25, borderColor: color + '40', marginBottom: i === 2 ? 0 : 8 }]}>
          <View style={[ill.circle, { borderColor: color + '60', backgroundColor: color + '15' }]} />
          <View style={ill.lines}>
            <View style={[ill.line, { width: `${70 - i * 12}%`, backgroundColor: color + '50' }]} />
            <View style={[ill.line, { width: `${45 - i * 8}%`, backgroundColor: color + '30', marginTop: 5 }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

function FriendsIllustration({ color }) {
  return (
    <View style={[ill.wrap, { flexDirection: 'row', justifyContent: 'center', gap: 12 }]}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={[ill.avatar, { opacity: 1 - i * 0.25, borderColor: color + '50', backgroundColor: color + '12' }]}>
          <View style={[ill.avatarDot, { backgroundColor: color + '60' }]} />
        </View>
      ))}
    </View>
  );
}

function MessagesIllustration({ color }) {
  return (
    <View style={ill.wrap}>
      {[{ w: '70%', self: 'flex-start' }, { w: '55%', self: 'flex-end' }, { w: '65%', self: 'flex-start' }].map((b, i) => (
        <View key={i} style={[ill.bubble, { width: b.w, alignSelf: b.self, borderColor: color + '40', backgroundColor: color + '10', marginBottom: 8 }]}>
          <View style={[ill.line, { width: '80%', backgroundColor: color + '40' }]} />
        </View>
      ))}
    </View>
  );
}

function GenericIllustration({ color }) {
  return (
    <View style={ill.wrap}>
      <View style={[ill.box, { borderColor: color + '50', backgroundColor: color + '10' }]}>
        <View style={[ill.line, { width: '60%', backgroundColor: color + '50', alignSelf: 'center' }]} />
        <View style={{ height: 8 }} />
        <View style={[ill.line, { width: '40%', backgroundColor: color + '30', alignSelf: 'center' }]} />
      </View>
    </View>
  );
}

const ILLUSTRATIONS = {
  habits:      HabitsIllustration,
  friends:     FriendsIllustration,
  messages:    MessagesIllustration,
  challenges:  GenericIllustration,
  leaderboard: GenericIllustration,
  history:     GenericIllustration,
  default:     GenericIllustration,
};

// ── Main component ─────────────────────────────────────────────────────────────
export default function EmptyState({ type = 'default', heading, subheading, action }) {
  const { colors } = useTheme();
  const Illustration = ILLUSTRATIONS[type] || ILLUSTRATIONS.default;

  return (
    <View style={s.container}>
      <Illustration color={colors.primary} />
      <Text style={[s.heading,    { color: colors.textPrimary }]}>{heading}</Text>
      {!!subheading && (
        <Text style={[s.subheading, { color: colors.textMuted }]}>{subheading}</Text>
      )}
      {!!action && (
        <TouchableOpacity
          style={[s.actionBtn, { backgroundColor: colors.primary }]}
          onPress={action.onPress}
          activeOpacity={0.85}
        >
          <Text style={s.actionLabel}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container:  { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32 },
  heading:    { fontSize: 18, fontWeight: '600', letterSpacing: -0.3, marginTop: 24, textAlign: 'center' },
  subheading: { fontSize: 14, letterSpacing: 0, lineHeight: 20, marginTop: 8, textAlign: 'center' },
  actionBtn:  { marginTop: 24, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32 },
  actionLabel:{ color: '#fff', fontSize: 15, fontWeight: '600' },
});

const ill = StyleSheet.create({
  wrap:   { alignItems: 'center', justifyContent: 'center', width: 160, height: 120 },
  row:    { flexDirection: 'row', alignItems: 'center', width: '100%', borderWidth: 1, borderRadius: 10, padding: 10, gap: 10 },
  circle: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5 },
  lines:  { flex: 1 },
  line:   { height: 8, borderRadius: 4 },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 6 },
  avatarDot: { width: 20, height: 20, borderRadius: 10 },
  bubble: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 36 },
  box:    { width: '100%', borderWidth: 1.5, borderRadius: 12, padding: 16 },
});
