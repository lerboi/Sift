import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import { colors, text } from '../../../src/theme';

export default function WatchlistLayout() {
  return (
    <Stack
      screenOptions={{
        headerLargeTitle: Platform.OS === 'ios',
        headerTransparent: Platform.OS === 'ios',
        headerBlurEffect: 'systemUltraThinMaterialDark',
        headerLargeTitleStyle: { ...text.displaySm, color: colors.text.primary },
        headerTitleStyle: { ...text.headline, color: colors.text.primary },
        headerStyle: Platform.OS === 'android' ? { backgroundColor: colors.bg.base } : undefined,
        headerTintColor: colors.accent.default,
        contentStyle: { backgroundColor: colors.bg.base },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Watchlist' }} />
    </Stack>
  );
}
