import { Pressable, View, Text, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { colors, space, text } from '../theme';
import { haptics } from '../lib/haptics';

export function SettingsRow({
  icon,
  label,
  value,
  onPress,
  destructive = false,
  last = false,
  trailing,
}) {
  const labelColor = destructive ? colors.signal.negative : colors.text.primary;
  const handle = onPress
    ? () => {
        haptics.tap();
        onPress();
      }
    : undefined;

  return (
    <Pressable
      onPress={handle}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={value !== undefined ? `${label}, ${String(value)}` : label}
      style={({ pressed }) => [
        styles.row,
        !last && styles.divider,
        pressed && onPress && styles.pressed,
      ]}
    >
      {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
      <Text style={[styles.label, { color: labelColor }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.spacer} />
      {trailing ? (
        <View style={styles.trailing}>{trailing}</View>
      ) : (
        <>
          {value !== undefined ? (
            <Text style={styles.value} numberOfLines={1}>
              {String(value)}
            </Text>
          ) : null}
          {onPress && !destructive ? (
            <ChevronRight
              size={16}
              color={colors.text.tertiary}
              strokeWidth={1.75}
              style={{ marginLeft: space[2] }}
            />
          ) : null}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: space[4],
    paddingVertical: space[2],
  },
  divider: {
    borderBottomColor: colors.border.subtle,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pressed: { backgroundColor: colors.bg.elevated },
  iconWrap: {
    width: 24,
    alignItems: 'center',
    marginRight: space[3],
  },
  label: { ...text.body, color: colors.text.primary, flexShrink: 1 },
  spacer: { flex: 1 },
  value: { ...text.subhead, color: colors.text.secondary },
  trailing: { marginLeft: space[2] },
});
