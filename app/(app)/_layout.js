import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Bookmark, Compass, Settings as SettingsIcon } from 'lucide-react-native';
import { colors, text } from '../../src/theme';

export default function AppLayout() {
  const insets = useSafeAreaInsets();
  // base tab content height (icon + label) — 52 on ios, 56 on android
  const baseHeight = Platform.OS === 'ios' ? 52 : 56;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bg.surface,
          borderTopColor: colors.border.subtle,
          borderTopWidth: 1,
          height: baseHeight + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 6,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.accent.default,
        tabBarInactiveTintColor: colors.text.secondary,
        tabBarLabelStyle: {
          ...text.micro,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="watchlist"
        options={{
          title: 'Watchlist',
          tabBarIcon: ({ color, size }) => <Bookmark size={size} color={color} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color, size }) => <Compass size={size} color={color} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          // events folder retained for the detail route `/events/[event_id]`;
          // hide it from the tab bar — it's not a destination, only drill-down.
          href: null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <SettingsIcon size={size} color={color} strokeWidth={1.75} />,
        }}
      />
    </Tabs>
  );
}
