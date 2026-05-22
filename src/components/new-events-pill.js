import { Pressable, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { colors, space, radius, text } from '../theme';
import { haptics } from '../lib/haptics';

export function NewEventsPill({ count, onTap }) {
  if (count <= 0) return null;
  const label = `${count} new event${count > 1 ? 's' : ''} · tap to view`;
  return (
    <Animated.View entering={FadeInDown.duration(200)} exiting={FadeOutUp.duration(150)}>
      <Pressable
        onPress={() => {
          haptics.tap();
          onTap?.();
        }}
        accessibilityRole="button"
        accessibilityLabel={`${count} new event${count > 1 ? 's' : ''}, tap to view`}
        style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
      >
        <Text style={styles.text}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'center',
    backgroundColor: colors.accent.muted,
    borderColor: 'rgba(91, 141, 239, 0.35)',
    borderWidth: 1,
    paddingHorizontal: space[4],
    paddingVertical: 8,
    borderRadius: radius.pill,
    marginVertical: space[2],
  },
  pressed: { opacity: 0.85 },
  text: {
    ...text.callout,
    color: colors.accent.default,
  },
});
