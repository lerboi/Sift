import { View, Text, StyleSheet } from 'react-native';
import { colors, space, text } from '../theme';
import { Card } from './card';
import { MonoNumber } from './mono-number';

function fmtEPS(n) {
  return `$${n.toFixed(2)}`;
}

function fmtSurprise(p) {
  const pct = (p * 100).toFixed(1);
  const sign = p >= 0 ? '+' : '';
  return `${sign}${pct}%`;
}

export function EventCard({
  ticker,
  period,
  when,
  epsActual,
  epsEst,
  surprisePct,
  isLive = false,
  onPress,
}) {
  const beat = surprisePct > 0;
  const miss = surprisePct < 0;
  const arrow = beat ? '▲' : miss ? '▼' : '━';
  const surpriseColor = beat
    ? colors.signal.positive
    : miss
    ? colors.signal.negative
    : colors.signal.neutral;

  const a11y = `${ticker} ${period}, reported ${fmtEPS(epsActual)} versus estimate ${fmtEPS(epsEst)}, ${fmtSurprise(surprisePct).replace('%', ' percent')} surprise`;

  return (
    <Card onPress={onPress} accessibilityLabel={a11y}>
      <View style={styles.topRow}>
        {isLive ? (
          <View style={styles.liveWrap}>
            <View style={styles.liveDot} />
            <Text style={styles.liveLabel}>LIVE</Text>
          </View>
        ) : null}
        <Text style={styles.ticker}>{ticker}</Text>
        <Text style={styles.period}>{period}</Text>
        <View style={styles.spacer} />
        <Text style={styles.when}>{when}</Text>
      </View>

      <View style={styles.metricRow}>
        <MonoNumber value={fmtEPS(epsActual)} size="headline" color={colors.text.primary} />
        <Text style={styles.vs}> vs </Text>
        <MonoNumber value={fmtEPS(epsEst)} size="subhead" color={colors.text.tertiary} accessibilityLabel={`${fmtEPS(epsEst)} estimate`} />
        <View style={styles.spacer} />
        <Text style={[styles.arrow, { color: surpriseColor }]}>{arrow} </Text>
        <MonoNumber value={fmtSurprise(surprisePct)} size="headline" color={surpriseColor} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  liveWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: space[2],
    alignSelf: 'center',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.signal.negative,
  },
  liveLabel: {
    ...text.micro,
    color: colors.signal.negative,
    letterSpacing: 0.5,
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
  vs: {
    ...text.subhead,
    color: colors.text.tertiary,
  },
  arrow: {
    ...text.headlineMono,
  },
});
