/**
 * src/components/OfflineWall.js
 * Drop-in screen replacement for features that require an internet connection.
 * Usage:  if (!isOnline) return <OfflineWall colors={colors} onBack={navigation.goBack} />;
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function OfflineWall({ colors, onBack, label }) {
  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors?.bg || '#0d0d12' }]} edges={['top']}>
      <StatusBar barStyle="light-content" />
      {onBack && (
        <TouchableOpacity style={s.back} onPress={onBack} activeOpacity={0.7}>
          <Text style={[s.backTxt, { color: colors?.primary || '#7c3aed' }]}>‹ Back</Text>
        </TouchableOpacity>
      )}
      <View style={s.center}>
        <Text style={s.icon}>📡</Text>
        <Text style={[s.title, { color: colors?.textPrimary || '#fff' }]}>No internet connection</Text>
        <Text style={[s.sub, { color: colors?.textMuted || '#666' }]}>
          {label || 'This feature requires an internet connection.'}{'\n'}
          Your changes will sync automatically when you're back online.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1 },
  back:    { paddingHorizontal: 18, paddingTop: 14 },
  backTxt: { fontSize: 16, fontWeight: '600' },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 },
  icon:    { fontSize: 52, marginBottom: 18 },
  title:   { fontSize: 18, fontWeight: '800', marginBottom: 10, textAlign: 'center' },
  sub:     { fontSize: 14, lineHeight: 22, textAlign: 'center' },
});
