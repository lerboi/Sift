import { View, Text, StyleSheet } from 'react-native';
import { colors, space, text } from '../theme';
import { formatDayHeader } from '../lib/dates';

export function DayHeader({ iso, now, style }) {
  const { relative, absolute, weekday } = formatDayHeader(iso, now ? { now } : undefined);
  // when relative is the weekday itself (e.g. "WED"), don't repeat it on the right
  const right = relative === weekday ? absolute : `${weekday} ${absolute}`;
  return (
    <View style={[styles.row, style]} accessibilityRole="header">
      <Text style={styles.relative}>{relative}</Text>
      <Text style={styles.dot}>·</Text>
      <Text style={styles.absolute}>{right}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space[2],
    marginBottom: space[3],
  },
  relative: {
    ...text.micro,
    color: colors.text.tertiary,
    letterSpacing: 0.6,
  },
  dot: {
    ...text.micro,
    color: colors.text.tertiary,
  },
  absolute: {
    ...text.subhead,
    color: colors.text.tertiary,
  },
});
