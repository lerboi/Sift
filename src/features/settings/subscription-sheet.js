import { forwardRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AppSheet } from '../../components/app-sheet';
import { Button } from '../../components/button';
import { haptics } from '../../lib/haptics';
import { colors, space, text } from '../../theme';

// stub until RevenueCat wires in phase 12. communicates intent without faking
// subscription state — every user is on "Free" today.
export const SubscriptionSheet = forwardRef(function SubscriptionSheet(_, ref) {
  const close = () => {
    haptics.tap();
    ref.current?.close();
  };
  return (
    <AppSheet ref={ref} snapPoints={['42%']}>
      <View style={styles.sheet}>
        <Text style={styles.title}>Subscriptions coming soon</Text>
        <Text style={styles.body}>
          Sift will offer a paid tier before public launch. The free plan keeps
          watchlist, briefings, and live filing alerts; the paid tier will add
          deeper history, more concurrent tickers, and earlier model predictions.
        </Text>
        <Text style={styles.body}>
          Pricing and rollout dates will appear here when the tier ships.
        </Text>
        <Button variant="secondary" onPress={close} fullWidth accessibilityLabel="Close">
          Got it
        </Button>
      </View>
    </AppSheet>
  );
});

const styles = StyleSheet.create({
  sheet: {
    paddingHorizontal: space[5],
    paddingTop: space[3],
    gap: space[3],
  },
  title: { ...text.title, color: colors.text.primary },
  body: { ...text.body, color: colors.text.secondary },
});
