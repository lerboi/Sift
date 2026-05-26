import { forwardRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AppSheet } from '../../components/app-sheet';
import { Button } from '../../components/button';
import { haptics } from '../../lib/haptics';
import { colors, space, text } from '../../theme';

// destructive-action friction. real sign-out wires in phase 10 (auth flow);
// today the confirm handler is the consumer's stub.
export const SignOutSheet = forwardRef(function SignOutSheet({ onConfirm }, ref) {
  const cancel = () => {
    haptics.tap();
    ref.current?.close();
  };
  const confirm = () => {
    haptics.warning();
    onConfirm?.();
    ref.current?.close();
  };
  return (
    <AppSheet ref={ref} snapPoints={['38%']}>
      <View style={styles.sheet}>
        <Text style={styles.title}>Sign out?</Text>
        <Text style={styles.body}>
          You'll be signed out of all sessions on this device. Your watchlist and
          preferences are saved to your account and will return when you sign back in.
        </Text>
        <Button variant="destructive" onPress={confirm} fullWidth accessibilityLabel="Confirm sign out">
          Sign out
        </Button>
        <Button variant="ghost" onPress={cancel} fullWidth accessibilityLabel="Cancel">
          Cancel
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
  body: {
    ...text.body,
    color: colors.text.secondary,
    marginBottom: space[2],
  },
});
