import { View, Pressable, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { colors, space, radius } from '../theme';
import { haptics } from '../lib/haptics';

const PRESS_IN = { duration: 80 };
const PRESS_OUT = { duration: 140 };

export function Card({
  children,
  onPress,
  padding = 4,
  style,
  accessibilityLabel,
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

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
          scale.value = withTiming(0.98, PRESS_IN);
          haptics.tap();
        }}
        onPressOut={() => {
          scale.value = withTiming(1, PRESS_OUT);
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
