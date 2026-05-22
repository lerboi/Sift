import { Platform, View, StyleSheet } from 'react-native';
import { colors } from '../theme';

// mobile-only product; web is dev convenience — constrain to phone width
export function WebFrame({ children }) {
  if (Platform.OS !== 'web') return children;
  return (
    <View style={styles.outer}>
      <View style={styles.inner}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.bg.inset,
  },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: 430,
    backgroundColor: colors.bg.base,
  },
});
