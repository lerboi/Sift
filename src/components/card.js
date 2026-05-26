import { View, Pressable, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring } from 'react-native-reanimated';
import { colors, space, radius } from '../theme';
import { haptics } from '../lib/haptics';
import { useReducedMotion } from '../lib/use-reduced-motion';

export function Card({
  children,
  onPress,
  padding = 4,
  style,
  accessibilityLabel,
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const reduced = useReducedMotion();
  const inDur = reduced ? 0 : 80;

  const inner = (
    <View style={[styles.card, { padding: space[padding] }, style]}>
      {children}
    </View>
  );

  if (!onPress) return inner;

  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          scale.value = withTiming(0.98, { duration: inDur });
          haptics.tap();
        }}
        onPressOut={() => {
          scale.value = reduced
            ? withTiming(1, { duration: 0 })
            : withSpring(1, { damping: 22, stiffness: 180, mass: 1 });
        }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {inner}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.surface,
    borderColor: colors.border.subtle,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
});
