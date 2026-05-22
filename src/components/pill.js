import { View, Text, StyleSheet } from 'react-native';
import { colors, space, radius, text } from '../theme';

// signal variants: positive/negative/neutral/warning/info
export function Pill({ children, variant = 'neutral', size = 'md' }) {
  const v = VARIANTS[variant] ?? VARIANTS.neutral;
  const s = SIZES[size] ?? SIZES.md;
  return (
    <View style={[styles.base, s.container, { backgroundColor: v.bg }]}>
      <Text style={[s.text, { color: v.fg }]} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

const VARIANTS = {
  accent:   { bg: colors.accent.muted,    fg: colors.accent.default },
  neutral:  { bg: colors.bg.elevated,     fg: colors.text.secondary },
  positive: { bg: 'rgba(74, 222, 128, 0.12)',  fg: colors.signal.positive },
  negative: { bg: 'rgba(248, 113, 113, 0.12)', fg: colors.signal.negative },
  warning:  { bg: 'rgba(251, 191, 36, 0.12)',  fg: colors.signal.warning },
  info:     { bg: colors.accent.muted,    fg: colors.signal.info },
};

const SIZES = {
  sm: {
    container: { paddingHorizontal: space[2], paddingVertical: 2, minHeight: 20 },
    text: text.caption,
  },
  md: {
    container: { paddingHorizontal: space[3], paddingVertical: 4, minHeight: 24 },
    text: { ...text.caption, fontFamily: 'Inter_500Medium' },
  },
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
