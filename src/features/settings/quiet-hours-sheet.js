import { forwardRef } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { AppSheet } from '../../components/app-sheet';
import { haptics } from '../../lib/haptics';
import { colors, space, text } from '../../theme';

// preset ranges (24h format, end exclusive). 'off' disables quiet hours.
// custom ranges are post-mvp — preset list keeps the picker calm + factual
// and avoids a time-picker dep until real-data wiring needs it.
export const QUIET_HOURS_PRESETS = [
  { value: 'off',         label: 'Off',           range: null },
  { value: '22-07',       label: '22:00 – 07:00', range: { start: '22:00', end: '07:00' } },
  { value: '23-08',       label: '23:00 – 08:00', range: { start: '23:00', end: '08:00' } },
  { value: '21-07',       label: '21:00 – 07:00', range: { start: '21:00', end: '07:00' } },
  { value: 'overnight',   label: '20:00 – 09:00', range: { start: '20:00', end: '09:00' } },
];

export function presetLabel(value) {
  return QUIET_HOURS_PRESETS.find((p) => p.value === value)?.label ?? 'Off';
}

export const QuietHoursSheet = forwardRef(function QuietHoursSheet(
  { value, onChange },
  ref,
) {
  const pick = (v) => {
    haptics.select();
    onChange(v);
    ref.current?.close();
  };
  return (
    <AppSheet ref={ref} snapPoints={['45%']}>
      <View style={styles.sheet}>
        <Text style={styles.title}>Quiet hours</Text>
        <Text style={styles.subtitle}>
          During quiet hours, briefings and alerts are batched and delivered the
          next morning.
        </Text>
        {QUIET_HOURS_PRESETS.map((p) => {
          const selected = p.value === value;
          return (
            <Pressable
              key={p.value}
              onPress={() => pick(p.value)}
              accessibilityRole="button"
              accessibilityLabel={`${p.label}${selected ? ', selected' : ''}`}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Text style={[styles.rowLabel, selected && styles.rowLabelSelected]}>{p.label}</Text>
              {selected ? <Check size={16} color={colors.accent.default} strokeWidth={2} /> : null}
            </Pressable>
          );
        })}
      </View>
    </AppSheet>
  );
});

const styles = StyleSheet.create({
  sheet: {
    paddingHorizontal: space[5],
    paddingTop: space[3],
  },
  title: {
    ...text.title,
    color: colors.text.primary,
    marginBottom: space[2],
  },
  subtitle: {
    ...text.footnote,
    color: colors.text.tertiary,
    marginBottom: space[4],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space[3],
    borderBottomColor: colors.border.subtle,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pressed: { backgroundColor: colors.bg.surface },
  rowLabel: { ...text.body, color: colors.text.primary, flex: 1 },
  rowLabelSelected: { color: colors.accent.default, fontFamily: 'Inter_500Medium' },
});
