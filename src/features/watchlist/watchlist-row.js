import { Pressable, View, Text, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { Sparkline } from '../../components/sparkline';
import { colors, space, text } from '../../theme';
import { haptics } from '../../lib/haptics';

const SPARKLINE_COLOR_BY_TREND = {
  up: 'positive',
  down: 'negative',
  flat: 'secondary',
};

export function WatchlistRow({ symbol, name, nextEarnings, sparkline, briefingReady, trend, onPress, last = false }) {
  const sparkColor =
    SPARKLINE_COLOR_BY_TREND[trend] === 'positive'
      ? colors.signal.positive
      : SPARKLINE_COLOR_BY_TREND[trend] === 'negative'
      ? colors.signal.negative
      : colors.text.secondary;

  return (
    <Pressable
      onPress={() => { haptics.tap(); onPress?.(); }}
      accessibilityRole="button"
      accessibilityLabel={`${symbol}, ${name}, reports ${nextEarnings.date}, ${nextEarnings.daysAway} days`}
      style={({ pressed }) => [
        styles.row,
        !last && styles.divider,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.left}>
        <Text style={styles.symbol}>{symbol}</Text>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
      </View>
      <View style={styles.mid}>
        <Sparkline data={sparkline} width={64} height={20} color={sparkColor} strokeWidth={1.5} />
      </View>
      <View style={styles.right}>
        <Text style={styles.date}>{nextEarnings.date}</Text>
        <View style={styles.rightSub}>
          {briefingReady ? <View style={styles.dot} /> : null}
          <Text style={styles.days}>{nextEarnings.daysAway}d</Text>
        </View>
      </View>
      <ChevronRight size={16} color={colors.text.tertiary} strokeWidth={1.75} style={{ marginLeft: space[2] }} />
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
  left: { flex: 1, marginRight: space[3] },
  symbol: { ...text.headlineMono, color: colors.text.primary },
  name: { ...text.footnote, color: colors.text.secondary, marginTop: 2 },
  mid: { width: 64, marginRight: space[3], alignItems: 'center', justifyContent: 'center' },
  right: { alignItems: 'flex-end' },
  date: { ...text.subhead, color: colors.text.primary },
  rightSub: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent.default },
  days: { ...text.footnote, color: colors.text.tertiary },
});
