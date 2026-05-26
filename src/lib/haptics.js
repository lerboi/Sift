import * as Haptics from 'expo-haptics';
import { AccessibilityInfo } from 'react-native';

// reduce-motion gating is centralized here: tap + select are decorative and
// skipped when the user has reduced motion on. success/warning/error are
// confirmations the user actively needs (sign-in failed, item removed, etc)
// and fire regardless. matches the rule in learnings.md § Haptics.
let reducedMotion = false;
AccessibilityInfo.isReduceMotionEnabled?.().then((v) => { reducedMotion = !!v; }).catch(() => {});
AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v) => { reducedMotion = !!v; });

export const haptics = {
  tap:     () => (reducedMotion ? null : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  select:  () => (reducedMotion ? null : Haptics.selectionAsync()),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  error:   () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
};
