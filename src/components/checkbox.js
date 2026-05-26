import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { haptics } from '../lib/haptics';
import { colors, space, radius, text } from '../theme';

// label is rendered alongside the checkbox; tap anywhere in the row toggles.
export function Checkbox({ value, onChange, label, disabled = false }) {
  const handle = () => {
    if (disabled) return;
    haptics.select();
    onChange(!value);
  };
  return (
    <Pressable
      onPress={handle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.row, pressed && !disabled && { opacity: 0.7 }]}
    >
      <View style={[styles.box, value && styles.boxChecked, disabled && styles.boxDisabled]}>
        {value ? <Check size={14} color={colors.accent.on} strokeWidth={3} /> : null}
      </View>
      <Text style={[styles.label, disabled && styles.labelDisabled]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
    paddingVertical: space[2],
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.strong,
    backgroundColor: colors.bg.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  boxChecked: {
    backgroundColor: colors.accent.default,
    borderColor: colors.accent.default,
  },
  boxDisabled: { opacity: 0.5 },
  label: { ...text.body, color: colors.text.primary, flex: 1 },
  labelDisabled: { color: colors.text.tertiary },
});
