import { Stack } from 'expo-router';
import { colors } from '../../src/theme';

// no header chrome on onboarding — each screen owns its own top bar.
export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg.base },
        animation: 'slide_from_right',
      }}
    />
  );
}
