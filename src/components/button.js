import { ActivityIndicator, Pressable, Text, StyleSheet, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { colors, space, radius, text } from '../theme';
import { haptics } from '../lib/haptics';

const PRESS_IN = { duration: 80 };
const PRESS_OUT = { duration: 140 };

export function Button({
  variant = 'primary',
  onPress,
  loading = false,
  disabled = false,
  icon,
  children,
  fullWidth = false,
  accessibilityLabel,
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePressIn = () => {
    if (disabled || loading) return;
    scale.value = withTiming(0.98, PRESS_IN);
    haptics.tap();
  };
  const handlePressOut = () => {
    scale.value = withTiming(1, PRESS_OUT);
  };

  const isInactive = disabled || loading;
  const v = VARIANT_STYLES[variant];

  return (
    <Animated.View style={[fullWidth && { alignSelf: 'stretch' }, animStyle]}>
      <Pressable
        onPress={isInactive ? undefined : onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityState={{ disabled: isInactive, busy: loading }}
        accessibilityLabel={accessibilityLabel}
        style={[
          styles.base,
          v.container,
          isInactive && styles.inactive,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={v.label.color} size="small" />
        ) : (
          <View style={styles.row}>
            {icon ? <View style={styles.icon}>{icon}</View> : null}
            <Text style={[styles.label, v.label]}>{children}</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const VARIANT_STYLES = {
  primary: {
    container: { backgroundColor: colors.accent.default, borderWidth: 0 },
    label: { color: colors.accent.on },
  },
  secondary: {
    container: {
      backgroundColor: colors.bg.surface,
      borderWidth: 1,
      borderColor: colors.border.default,
    },
    label: { color: colors.text.primary },
  },
  ghost: {
    container: { backgroundColor: 'transparent', borderWidth: 0 },
    label: { color: colors.accent.default },
  },
};

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...text.callout,
    textAlign: 'center',
  },
  inactive: {
    opacity: 0.5,
  },
});
