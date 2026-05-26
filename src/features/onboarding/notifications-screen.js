import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { Bell, BellOff, Clock } from 'lucide-react-native';
import { Button } from '../../components/button';
import { haptics } from '../../lib/haptics';
import { colors, space, text } from '../../theme';

const POINTS = [
  {
    Icon: Bell,
    title: 'Three kinds of pushes',
    body: 'Pre-earnings briefings the morning of a report. 8-K filing alerts the moment a filing drops. Post-call transcript highlights when the call ends.',
  },
  {
    Icon: BellOff,
    title: 'Throttled hard',
    body: 'Maximum three notifications per ticker per day. The first earnings filing wins; follow-up amendments are batched.',
  },
  {
    Icon: Clock,
    title: 'Quiet hours respected',
    body: "We won't ping you overnight. Set your quiet hours in Settings and we batch everything until morning.",
  },
];

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [requesting, setRequesting] = useState(false);

  const finish = () => router.push('/first-tickers');

  const allow = async () => {
    setRequesting(true);
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === 'granted') haptics.success();
      else haptics.tap();
    } catch {
      // expo go has reduced notification support since sdk 53; gracefully no-op
      haptics.tap();
    } finally {
      setRequesting(false);
      finish();
    }
  };
  const skip = () => {
    haptics.tap();
    finish();
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.content}>
        <Text style={styles.heading}>Stay in the loop</Text>
        <Text style={styles.lede}>
          Sift's value comes from being faster than refreshing your brokerage app. To do that, we need to ping you.
        </Text>

        <View style={styles.points}>
          {POINTS.map((p, i) => (
            <Point key={i} {...p} />
          ))}
        </View>

        <Text style={styles.controlNote}>
          You can change any of this later in Settings, including turning notifications off entirely.
        </Text>
      </View>

      <View style={styles.bottom}>
        <Button
          variant="primary"
          onPress={allow}
          loading={requesting}
          fullWidth
          accessibilityLabel="Allow notifications"
        >
          Allow notifications
        </Button>
        <Pressable
          onPress={skip}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Skip for now"
          style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.skipText}>Maybe later</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Point({ Icon, title, body }) {
  return (
    <View style={styles.point}>
      <View style={styles.iconWrap}>
        <Icon size={20} color={colors.accent.default} strokeWidth={1.5} />
      </View>
      <View style={styles.pointBody}>
        <Text style={styles.pointTitle}>{title}</Text>
        <Text style={styles.pointText}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  content: {
    flex: 1,
    paddingHorizontal: space[5],
    paddingTop: space[6],
  },
  heading: { ...text.displaySm, color: colors.text.primary },
  lede: {
    ...text.body,
    color: colors.text.secondary,
    marginTop: space[2],
    marginBottom: space[6],
  },

  points: { gap: space[5] },
  point: {
    flexDirection: 'row',
    gap: space[4],
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  pointBody: { flex: 1 },
  pointTitle: { ...text.headline, color: colors.text.primary, marginBottom: space[1] },
  pointText: { ...text.body, color: colors.text.secondary },

  controlNote: {
    ...text.footnote,
    color: colors.text.tertiary,
    marginTop: space[6],
  },

  bottom: {
    paddingHorizontal: space[5],
    paddingTop: space[3],
    paddingBottom: space[6],
    gap: space[3],
    alignItems: 'center',
  },
  skipBtn: { paddingVertical: space[2] },
  skipText: { ...text.body, color: colors.text.tertiary },
});
