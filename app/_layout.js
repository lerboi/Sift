import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { ThemeProvider, DarkTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from '@expo-google-fonts/jetbrains-mono';
import { colors } from '../src/theme';
import { WebFrame } from '../src/components/web-frame';
import { useAuthRouting } from '../src/lib/use-auth-routing';
import { useUserId } from '../src/lib/use-user-id';
import { registerPushTokenIfPossible } from '../src/lib/push-tokens';
import { useNotificationsStream } from '../src/lib/realtime/use-notifications-stream';

// override react-navigation default light theme — otherwise navigators paint white above transparent headers
const SiftNavTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg.base,
    card: colors.bg.surface,
    text: colors.text.primary,
    border: colors.border.subtle,
    primary: colors.accent.default,
    notification: colors.signal.negative,
  },
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });

  const authStatus = useAuthRouting();
  const userId = useUserId();
  const ready = fontsLoaded && authStatus !== 'loading';

  // notifications realtime: broadcasts to the notifications bus when a new row
  // lands. consumed by useHomeData for the new-events pill (and any future
  // toast / inbox surface).
  useNotificationsStream(authStatus === 'authed' ? userId : null);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // re-register the device push token on every cold start once we're authed.
  // upsert keeps last_seen_at fresh so gc_stale_push_tokens (B13) doesn't reap
  // an active device.
  useEffect(() => {
    if (authStatus === 'authed') registerPushTokenIfPossible();
  }, [authStatus]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={SiftNavTheme}>
          <WebFrame>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.bg.base },
              }}
            />
          </WebFrame>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
