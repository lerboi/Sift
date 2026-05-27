import { Pressable, View, Text, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { Sparkline } from '../../components/sparkline';
import { colors, space, text } from '../../theme';
import { haptics } from '../../lib/haptics';
import { useSparkline } from './use-sparkline';

// sparkline muted by default (b16) — trend prop preserved on the data shape
// for when real 30d-change data lands and we can re-tint with intent.
export function WatchlistRow({ symbol, name, nextEarnings, sparkline, briefingReady, onPress, last = false }) {
  const liveSpark = useSparkline(symbol);
  const series = sparkline && sparkline.length > 2 ? sparkline : liveSpark;
  // shape() uses 9999 as the "no upcoming briefing" sentinel so date-sort works
  // — render as em-dash so the user doesn't see "9999d" or "Q? 26".
  const hasNext = nextEarnings.daysAway < 9999;
  const periodText = hasNext ? nextEarnings.period : '—';
  const countdownText = hasNext ? `${nextEarnings.daysAway}d` : '—';
  const a11yWhen = hasNext
    ? `reports ${nextEarnings.date}, in ${nextEarnings.daysAway} days`
    : 'no upcoming earnings scheduled';
  return (
    <Pressable
      onPress={() => { haptics.tap(); onPress?.(); }}
      accessibilityRole="button"
      accessibilityLabel={`${symbol}, ${name}, ${a11yWhen}${briefingReady ? ', briefing ready' : ''}`}
      style={({ pressed }) => [
        styles.row,
        !last && styles.divider,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.body}>
        <View style={styles.topLine}>
          <Text style={styles.symbol} accessibilityLabel={symbol.split('').join(' ')}>{symbol}</Text>
          <View style={styles.sparkSlot}>
            <Sparkline data={series} width={72} height={20} color={colors.text.secondary} strokeWidth={1.5} />
          </View>
          <View style={styles.right}>
            <Text style={styles.period}>{periodText}</Text>
            <Text style={styles.countdown}>{countdownText}</Text>
          </View>
        </View>
        <View style={styles.subLine}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {briefingReady ? (
            <View style={styles.badge}>
              <View style={styles.dot} />
              <Text style={styles.badgeText}>ready</Text>
            </View>
          ) : null}
        </View>
      </View>
      <ChevronRight size={16} color={colors.text.tertiary} strokeWidth={1.75} style={styles.chev} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    minHeight: 64,
  },
  divider: {
    borderBottomColor: colors.border.subtle,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pressed: { backgroundColor: colors.bg.elevated },
  body: { flex: 1 },

  topLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  symbol: {
    ...text.headlineMono,
    color: colors.text.primary,
    minWidth: 56,
  },
  sparkSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[2],
  },
  right: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space[3],
  },
  period: {
    ...text.subhead,
    color: colors.text.secondary,
  },
  countdown: {
    ...text.subhead,
    color: colors.text.primary,
    minWidth: 28,
    textAlign: 'right',
  },

  subLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  name: {
    ...text.footnote,
    color: colors.text.secondary,
    flex: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: space[2],
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent.default,
  },
  badgeText: {
    ...text.caption,
    color: colors.accent.default,
  },

  chev: { marginLeft: space[2] },
});
