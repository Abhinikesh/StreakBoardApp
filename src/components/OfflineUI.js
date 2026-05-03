import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { useOffline } from '../context/OfflineContext';

/** Subtle banner below the status bar when offline */
export function OfflineBanner({ colors }) {
  const { isOnline, pendingCount } = useOffline();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue:  isOnline ? 0 : 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [isOnline, anim]);

  const maxHeight = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 38] });
  const opacity   = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <Animated.View style={[styles.banner, { maxHeight, opacity }]}>
      <Text style={styles.txt} numberOfLines={1}>
        📡 Offline{pendingCount > 0 ? ` — ${pendingCount} change${pendingCount !== 1 ? 's' : ''} pending` : ' — changes will sync when back online'}
      </Text>
    </Animated.View>
  );
}

/** Brief "Synced" toast that slides up from bottom */
export function SyncToast({ colors }) {
  const { toast } = useOffline();
  const anim = useRef(new Animated.Value(0)).current;
  const cur  = useRef(null);

  useEffect(() => {
    if (toast) {
      cur.current = toast.id;
      Animated.sequence([
        Animated.spring(anim, { toValue: 1, tension: 80, friction: 10, useNativeDriver: true }),
        Animated.delay(1800),
        Animated.timing(anim, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [toast, anim]);

  if (!toast) return null;

  return (
    <Animated.View style={[styles.toast, {
      opacity:   anim,
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
    }]}>
      <Text style={styles.toastTxt}>{toast.msg}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#1e1b2e',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(124,58,237,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  txt: { color: '#a78bfa', fontSize: 12, fontWeight: '600' },

  toast: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    backgroundColor: '#16a34a',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  toastTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
