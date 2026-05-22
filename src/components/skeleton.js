import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors, radius as r } from '../theme';
import { useReducedMotion } from '../lib/use-reduced-motion';

export function Skeleton({ width, height = 16, radius = 'md', circle = false, style }) {
  const opacity = useSharedValue(0.6);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      opacity.value = 0.5;
      return;
    }
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800 }),
        withTiming(0.5, { duration: 800 }),
      ),
      -1,
      false,
    );
  }, [reduced]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const shape = circle
    ? { width: height, height, borderRadius: height / 2 }
    : { width, height, borderRadius: r[radius] ?? r.md };

  return <Animated.View style={[styles.base, shape, animStyle, style]} accessibilityElementsHidden importantForAccessibility="no" />;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.bg.elevated,
  },
});
