import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import { colors, text } from '../../../src/theme';

// events folder is detail-only (no index, no tab) — Stack provides back nav
// for the [event_id] route reached from Today and ticker detail.
export default function EventsLayout() {
  return (
    <Stack
      screenOptions={{
        headerTransparent: Platform.OS === 'ios',
        headerBlurEffect: 'systemUltraThinMaterialDark',
        headerTitleStyle: { ...text.headline, color: colors.text.primary },
        headerStyle: Platform.OS === 'android' ? { backgroundColor: colors.bg.base } : undefined,
        headerTintColor: colors.accent.default,
        contentStyle: { backgroundColor: colors.bg.base },
      }}
    />
  );
}
