import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { ThemeProvider, DarkTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
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

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
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
  );
}
