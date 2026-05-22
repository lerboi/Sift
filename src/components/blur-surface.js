import { Platform, View, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors } from '../theme';

// android blur is heavy below sdk 31 — fall back to a translucent solid
const USE_BLUR = Platform.OS === 'ios' || (Platform.OS === 'android' && Platform.Version >= 31);

export function BlurSurface({
  children,
  intensity = 70,
  tint = 'dark',
  style,
}) {
  if (!USE_BLUR) {
    return <View style={[styles.fallback, style]}>{children}</View>;
  }
  return (
    <BlurView intensity={intensity} tint={tint} style={[StyleSheet.absoluteFill, style]}>
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: colors.bg.elevated,
    opacity: 0.95,
  },
});
