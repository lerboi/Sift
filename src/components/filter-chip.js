import { Pressable, Text, StyleSheet } from 'react-native';
import { colors, space, radius, text, font } from '../theme';
import { haptics } from '../lib/haptics';

export function FilterChip({ label, selected, onPress, accessibilityLabel }) {
  return (
    <Pressable
      onPress={() => { haptics.select(); onPress?.(); }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.selected : styles.idle,
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={[styles.label, selected ? styles.labelSelected : styles.labelIdle]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: space[3],
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: {
    backgroundColor: colors.accent.muted,
    borderColor: 'rgba(91, 141, 239, 0.45)',
  },
  idle: {
    backgroundColor: colors.bg.surface,
    borderColor: colors.border.subtle,
  },
  label: { ...text.caption, fontFamily: font.sansMed },
  labelSelected: { color: colors.accent.default },
  labelIdle: { color: colors.text.secondary },
});
