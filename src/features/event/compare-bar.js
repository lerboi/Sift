import { View, Text, StyleSheet } from 'react-native';
import { colors, space, radius, text } from '../../theme';

// twin-bar viz: estimate (muted) + actual (signal color) scaled to the larger of the two
export function CompareBar({ label, actual, estimate, formatter, surprisePct }) {
  const fmt = formatter ?? ((v) => String(v));
  const max = Math.max(actual, estimate) * 1.05;
  const actualPct = (actual / max) * 100;
  const estPct = (estimate / max) * 100;
  const beat = surprisePct > 0.005;
  const miss = surprisePct < -0.005;
  const actualColor = beat
    ? colors.signal.positive
    : miss
    ? colors.signal.negative
    : colors.signal.neutral;

  return (
    <View style={styles.wrap} accessibilityLabel={`${label}, estimate ${fmt(estimate)}, actual ${fmt(actual)}`}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.row}>
        <Text style={styles.legend}>Actual</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${actualPct}%`, backgroundColor: actualColor }]} />
        </View>
        <Text style={styles.value}>{fmt(actual)}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.legend}>Estimate</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${estPct}%`, backgroundColor: colors.bg.elevated, borderColor: colors.border.default, borderWidth: 1 }]} />
        </View>
        <Text style={styles.value}>{fmt(estimate)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[2] },
  label: { ...text.micro, color: colors.text.tertiary, letterSpacing: 0.5 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  legend: {
    ...text.footnote,
    color: colors.text.tertiary,
    width: 64,
  },
  track: {
    flex: 1,
    height: 8,
    backgroundColor: colors.bg.inset,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.sm,
  },
  value: {
    ...text.subheadMono,
    color: colors.text.primary,
    width: 76,
    textAlign: 'right',
  },
});
