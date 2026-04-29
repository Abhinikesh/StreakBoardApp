import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

export default function SplashScreen() {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in content
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    // Pulse the flame forever
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <Animated.Text style={[styles.flame, { transform: [{ scale: pulseAnim }] }]}>
          🔥
        </Animated.Text>
        <Text style={styles.brand}>StreakBoard</Text>
        <Text style={styles.tagline}>Track what you do.</Text>
        <Text style={styles.tagline2}>Not what you plan.</Text>
      </Animated.View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Loading your streaks...</Text>
        <View style={styles.dotsRow}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.dot} />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  flame: {
    fontSize: 72,
    marginBottom: 16,
  },
  brand: {
    fontSize: 32,
    fontWeight: '800',
    color: '#7c3aed',
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 14,
    color: '#888888',
    marginTop: 8,
  },
  tagline2: {
    fontSize: 14,
    color: '#555555',
    marginTop: 2,
  },
  footer: {
    position: 'absolute',
    bottom: 60,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#2a2a3a',
    marginBottom: 12,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#7c3aed',
    opacity: 0.6,
  },
});
