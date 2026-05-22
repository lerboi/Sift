import { View, Text, StyleSheet } from 'react-native';
import { Skeleton } from '../../components/skeleton';
import { colors, space, text, radius } from '../../theme';

export function HomeSkeleton() {
  return (
    <View>
      <View style={styles.section}>
        <Text style={styles.label}>UPCOMING</Text>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.card}>
            <View style={styles.row}>
              <Skeleton width={64} height={16} />
              <View style={{ width: space[3] }} />
              <Skeleton width={48} height={12} />
              <View style={{ flex: 1 }} />
              <Skeleton width={56} height={12} />
            </View>
            <View style={[styles.row, { marginTop: space[3] }]}>
              <Skeleton width={120} height={14} />
              <View style={{ flex: 1 }} />
              <Skeleton width={60} height={14} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space[2] },
  label: {
    ...text.micro,
    color: colors.text.tertiary,
    letterSpacing: 0.5,
    marginBottom: space[3],
  },
  card: {
    backgroundColor: colors.bg.surface,
    borderColor: colors.border.subtle,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space[4],
    marginBottom: space[3],
  },
  row: { flexDirection: 'row', alignItems: 'center' },
});
