import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, space, text } from '../../theme';

// shared chrome for onboarding screens — right-aligned Skip text-button.
// pair with the screen's own SafeAreaView-paddingTop so this sits below the
// status bar.
export function OnboardingTopBar({ onSkip, label = 'Skip', accessibilityLabel = 'Skip onboarding' }) {
  return (
    <View style={styles.row}>
      <View style={styles.spacer} />
      <Pressable
        onPress={onSkip}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => pressed && { opacity: 0.6 }}
      >
        <Text style={styles.text}>{label}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    minHeight: 44,
  },
  spacer: { flex: 1 },
  text: { ...text.body, color: colors.accent.default },
});
