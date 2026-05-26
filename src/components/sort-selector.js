import { useRef } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ChevronDown, Check } from 'lucide-react-native';
import { AppSheet } from './app-sheet';
import { haptics } from '../lib/haptics';
import { colors, space, text } from '../theme';

// options: [{ value, label }], value: current key, onChange: (value) => void
export function SortSelector({ options, value, onChange, prefix = 'Sort' }) {
  const sheet = useRef(null);
  const current = options.find((o) => o.value === value);
  const open = () => {
    haptics.tap();
    sheet.current?.expand();
  };
  const pick = (v) => {
    haptics.select();
    onChange(v);
    sheet.current?.close();
  };
  return (
    <>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`${prefix}, currently ${current?.label ?? ''}. Tap to change.`}
        style={({ pressed }) => [styles.trigger, pressed && { opacity: 0.6 }]}
        hitSlop={6}
      >
        <Text style={styles.prefix}>{prefix}</Text>
        <Text style={styles.value}>{current?.label}</Text>
        <ChevronDown size={14} color={colors.text.tertiary} strokeWidth={1.75} />
      </Pressable>

      <AppSheet ref={sheet} snapPoints={['35%']}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Sort by</Text>
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <Pressable
                key={o.value}
                onPress={() => pick(o.value)}
                accessibilityRole="button"
                accessibilityLabel={`${o.label}${selected ? ', selected' : ''}`}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <Text style={[styles.rowLabel, selected && styles.rowLabelSelected]}>{o.label}</Text>
                {selected ? <Check size={16} color={colors.accent.default} strokeWidth={2} /> : null}
              </Pressable>
            );
          })}
        </View>
      </AppSheet>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingVertical: space[2],
  },
  prefix: {
    ...text.subhead,
    color: colors.text.tertiary,
  },
  value: {
    ...text.subhead,
    color: colors.text.primary,
  },
  sheet: {
    paddingHorizontal: space[5],
    paddingTop: space[3],
  },
  sheetTitle: {
    ...text.micro,
    color: colors.text.tertiary,
    letterSpacing: 0.6,
    marginBottom: space[3],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space[4],
    borderBottomColor: colors.border.subtle,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowPressed: { backgroundColor: colors.bg.surface },
  rowLabel: {
    ...text.body,
    color: colors.text.primary,
    flex: 1,
  },
  rowLabelSelected: {
    color: colors.accent.default,
    fontFamily: 'Inter_500Medium',
  },
});
