/**
 * src/components/PressableScale.js
 *
 * Drop-in replacement for TouchableOpacity that adds the 0.97 scale animation
 * on press (80ms) for every tappable element in the app.
 *
 * Usage:
 *   import PressableScale from '../components/PressableScale';
 *   <PressableScale onPress={handlePress} style={styles.card}>
 *     {children}
 *   </PressableScale>
 */
import React, { useRef } from 'react';
import { Pressable, Animated } from 'react-native';

export default function PressableScale({
  children,
  style,
  onPress,
  onLongPress,
  disabled,
  hitSlop,
  ...rest
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    Animated.timing(scale, {
      toValue:         0.97,
      duration:        80,
      useNativeDriver: true,
    }).start();
  };

  const pressOut = () => {
    Animated.timing(scale, {
      toValue:         1,
      duration:        80,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      disabled={disabled}
      hitSlop={hitSlop}
      {...rest}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
