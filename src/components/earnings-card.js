import { View, Text, StyleSheet } from 'react-native';
import { colors, space, text } from '../theme';
import { Card } from './card';
import { MonoNumber } from './mono-number';

function fmtEPS(n) {
  return `$${n.toFixed(2)}`;
}

function fmtPct(p) {
  return `${Math.round(p * 100)}%`;
}

export function EarningsCard({ ticker, period, when, epsEst, beatProb, briefingReady, onPress }) {
  const epsStr = fmtEPS(epsEst);
  const pctStr = fmtPct(beatProb);
  return (
    <Card onPress={onPress} accessibilityLabel={`${ticker} earnings ${period}, ${when}, EPS estimate ${epsStr}, predicted beat probability ${pctStr}`}>
      <View style={styles.topRow}>
        <Text style={styles.ticker} accessibilityLabel={ticker.split('').join(' ')}>{ticker}</Text>
        <Text style={styles.period}>{period}</Text>
        <View style={styles.spacer} />
        <Text style={styles.when}>{when}</Text>
      </View>

      <View style={styles.metricRow}>
        <Text style={styles.label}>EPS est </Text>
        <MonoNumber value={epsStr} size="body" />
        <Text style={styles.sep}>  •  </Text>
        {/* prediction not realized outcome — accent, never signal.positive (palette.md) */}
        <Text style={styles.predArrow}>▲ </Text>
        <MonoNumber value={pctStr} size="body" accessibilityLabel={`${pctStr.replace('%', ' percent')} predicted beat probability`} />
      </View>

      {briefingReady && (
        <View style={styles.footerRow}>
          <View style={styles.dot} />
          <Text style={styles.footerText}>pre-earnings briefing ready</Text>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  ticker: {
    ...text.headlineMono,
    color: colors.text.primary,
  },
  period: {
    ...text.subhead,
    color: colors.text.secondary,
    marginLeft: space[3],
  },
  spacer: { flex: 1 },
  when: {
    ...text.subhead,
    color: colors.text.tertiary,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: space[2],
  },
  label: {
    ...text.subhead,
    color: colors.text.secondary,
  },
  sep: {
    ...text.subhead,
    color: colors.text.tertiary,
  },
  predArrow: {
    ...text.bodyMono,
    color: colors.accent.default,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space[3],
    gap: space[2],
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent.default,
  },
  footerText: {
    ...text.caption,
    color: colors.accent.default,
  },
});
