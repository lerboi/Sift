import { View, StyleSheet } from 'react-native';
import { colors, space } from '../theme';

// thin row of dots; active dot in accent.default, others in text.tertiary at low opacity
export function PageDots({ count, current }) {
  return (
    <View style={styles.row} accessibilityRole="adjustable" accessibilityValue={{ now: current + 1, min: 1, max: count }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.dot, i === current && styles.active]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.text.tertiary,
    opacity: 0.5,
  },
  active: {
    width: 18,
    backgroundColor: colors.accent.default,
    opacity: 1,
  },
});
