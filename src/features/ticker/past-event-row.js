import { Pressable, View, Text, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { MonoNumber } from '../../components/mono-number';
import { colors, space, text } from '../../theme';
import { haptics } from '../../lib/haptics';

function fmtEPS(n) {
  return `$${n.toFixed(2)}`;
}

function fmtSurprise(p) {
  const pct = (p * 100).toFixed(1);
  const sign = p >= 0 ? '+' : '';
  return `${sign}${pct}%`;
}

export function PastEventRow({
  period,
  date,
  epsActual,
  epsEst,
  surprisePct,
  onPress,
  last = false,
}) {
  const beat = surprisePct > 0;
  const miss = surprisePct < 0;
  const arrow = beat ? '▲' : miss ? '▼' : '━';
  const surpriseColor = beat
    ? colors.signal.positive
    : miss
    ? colors.signal.negative
    : colors.signal.neutral;

  const a11y = `${period} reported ${fmtEPS(epsActual)} versus estimate ${fmtEPS(epsEst)}, ${fmtSurprise(surprisePct).replace('%', ' percent')} surprise`;

  return (
    <Pressable
      onPress={() => { haptics.tap(); onPress?.(); }}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [
        styles.row,
        !last && styles.divider,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.left}>
        <Text style={styles.period}>{period}</Text>
        <Text style={styles.date}>{date}</Text>
      </View>
      <View style={styles.middle}>
        <MonoNumber value={fmtEPS(epsActual)} size="headline" />
        <Text style={styles.vs}>vs {fmtEPS(epsEst)}</Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.surprise, { color: surpriseColor }]}>
          {arrow} {fmtSurprise(surprisePct)}
        </Text>
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
    minHeight: 60,
  },
  divider: {
    borderBottomColor: colors.border.subtle,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pressed: { backgroundColor: colors.bg.elevated },
  left: { width: 86 },
  middle: { flex: 1, marginLeft: space[2] },
  right: { alignItems: 'flex-end' },
  period: { ...text.headline, color: colors.text.primary },
  date: { ...text.footnote, color: colors.text.tertiary, marginTop: 2 },
  vs: { ...text.footnote, color: colors.text.tertiary, marginTop: 2 },
  surprise: { ...text.headlineMono },
});
