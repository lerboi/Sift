import { View, Text, StyleSheet } from 'react-native';
import { Card } from '../../components/card';
import { MonoNumber } from '../../components/mono-number';
import { colors, space, text } from '../../theme';

function fmtSurprise(p) {
  const pct = Math.abs(p * 100).toFixed(1);
  const sign = p > 0 ? '+' : p < 0 ? '−' : '';
  return `${sign}${pct}%`;
}

export function MetricTile({ label, actual, estimate, surprisePct, formatter }) {
  const fmt = formatter ?? ((v) => String(v));
  const beat = surprisePct > 0.005;
  const miss = surprisePct < -0.005;
  const arrow = beat ? '▲' : miss ? '▼' : '━';
  const color = beat ? colors.signal.positive : miss ? colors.signal.negative : colors.signal.neutral;

  return (
    <Card style={styles.tile} padding={4}>
      <Text style={styles.label}>{label}</Text>
      <MonoNumber value={fmt(actual)} size="headline" color={colors.text.primary} style={styles.actual} />
      <Text style={styles.est}>vs {fmt(estimate)}</Text>
      <Text style={[styles.delta, { color }]}>
        {arrow} {fmtSurprise(surprisePct)}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1 },
  label: { ...text.micro, color: colors.text.tertiary, letterSpacing: 0.5 },
  actual: { marginTop: space[2] },
  est: { ...text.footnote, color: colors.text.tertiary, marginTop: 2 },
  delta: { ...text.subheadMono, marginTop: space[2] },
});
