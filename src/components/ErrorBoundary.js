import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Screen crashed:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.emoji}>⚠️</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.sub}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container:  { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#0f0f14' },
  emoji:      { fontSize: 48, marginBottom: 16 },
  title:      { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 8 },
  sub:        { fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 28, lineHeight: 19 },
  button:     { backgroundColor: '#7C3AED', paddingHorizontal: 28, paddingVertical: 13, borderRadius: 10 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
