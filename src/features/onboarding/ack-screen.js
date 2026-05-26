import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button } from '../../components/button';
import { Checkbox } from '../../components/checkbox';
import { LegalSection } from '../../components/legal-section';
import { haptics } from '../../lib/haptics';
import { ACK_KEY } from '../../lib/use-auth-routing';
import { colors, space, text } from '../../theme';

// scroll-to-enable threshold — content within this many pt of the bottom
// counts as "reached the bottom" (allows for bounce on iOS).
const SCROLL_END_THRESHOLD = 20;

export default function AckScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [scrolled, setScrolled] = useState(false);
  const [educationalAck, setEducationalAck] = useState(false);
  const [termsAck, setTermsAck] = useState(false);

  const canContinue = scrolled && educationalAck && termsAck;

  const onScroll = (e) => {
    if (scrolled) return;
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - SCROLL_END_THRESHOLD) {
      setScrolled(true);
    }
  };

  // local ack — moves to profiles.disclaimer_ack_at when the schema lands.
  const confirm = async () => {
    if (!canContinue) return;
    haptics.success();
    await AsyncStorage.setItem(ACK_KEY, new Date().toISOString());
    router.push('/notifications');
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Text style={styles.heading}>Before you start</Text>
        <Text style={styles.lede}>
          Read through, then acknowledge both items below to continue. This step exists for legal reasons and only appears once.
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        onScroll={onScroll}
        scrollEventThrottle={64}
        showsVerticalScrollIndicator
      >
        <Text style={styles.lede}>
          Sift provides general market information and educational content. Nothing
          in this app constitutes investment, financial, legal, or tax advice, or
          a personal recommendation. You are solely responsible for your investment
          decisions.
        </Text>

        <LegalSection title="WHAT YOU ARE AGREEING TO">
          By tapping Continue you confirm you have read this notice, the Privacy
          Policy, and the Terms of Service in full, and that you understand Sift
          is an educational research tool, not a broker, investment adviser, or
          trading platform.
        </LegalSection>

        <LegalSection title="WHAT SIFT WILL AND WILL NOT DO">
          Sift will surface filings, briefings, transcripts, and statistical
          predictions about publicly listed US companies. Sift will not execute
          trades, provide personalised advice, or contact you with marketing
          unrelated to the service. Sift does not know your portfolio, financial
          situation, goals, or risk tolerance.
        </LegalSection>

        <LegalSection title="PREDICTIONS — IMPORTANT">
          Predictions in Sift (e.g. "beat probability 65%") are calibrated
          statistical outputs, not forecasts of what will happen, and not
          recommendations to act. Past performance — of a company, a model, or
          a signal — is not indicative of future results.
        </LegalSection>

        <LegalSection title="JURISDICTION AND DATA">
          Sift is intended for residents of jurisdictions where the provision of
          educational research about publicly listed securities does not require
          registration as an investment adviser. Your account email and
          watchlist are stored in Supabase; the full privacy posture is in the
          Privacy Policy.
        </LegalSection>

        <LegalSection title="CHANGES TO THIS ACKNOWLEDGEMENT">
          If we make material changes to this acknowledgement, the Disclaimer,
          the Privacy Policy, or the Terms of Service, you will be prompted to
          read and re-acknowledge before continuing to use the app.
        </LegalSection>

        <Text style={styles.footnote}>
          Reviewed 22 May 2026. You can revisit the full Disclaimer, Privacy
          Policy, and Terms anytime from Settings.
        </Text>
      </ScrollView>

      <View style={styles.acks}>
        <View style={[styles.scrollHint, scrolled && styles.scrollHintDone]}>
          <Text style={[styles.scrollHintText, scrolled && styles.scrollHintTextDone]}>
            {scrolled ? '✓ Scrolled to the end' : 'Scroll to the end to enable the boxes'}
          </Text>
        </View>

        <Checkbox
          value={educationalAck}
          onChange={setEducationalAck}
          disabled={!scrolled}
          label="I understand Sift is educational research, not investment advice."
        />
        <Checkbox
          value={termsAck}
          onChange={setTermsAck}
          disabled={!scrolled}
          label="I agree to the Terms of Service and Privacy Policy."
        />

        <Button
          variant="primary"
          onPress={confirm}
          fullWidth
          disabled={!canContinue}
          accessibilityLabel="Continue to Sift"
        >
          Continue
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },

  header: {
    paddingHorizontal: space[5],
    paddingTop: space[3],
    paddingBottom: space[3],
  },
  heading: {
    ...text.title,
    color: colors.text.primary,
  },
  lede: {
    ...text.body,
    color: colors.text.secondary,
    marginTop: space[2],
  },

  scroll: {
    flex: 1,
    borderTopColor: colors.border.subtle,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.subtle,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  scrollContent: {
    paddingHorizontal: space[5],
    paddingVertical: space[4],
    paddingBottom: space[6],
  },
  footnote: {
    ...text.footnote,
    color: colors.text.tertiary,
    marginTop: space[6],
  },

  acks: {
    paddingHorizontal: space[5],
    paddingTop: space[4],
    paddingBottom: space[5],
    gap: space[2],
  },
  scrollHint: {
    paddingVertical: space[2],
    paddingHorizontal: space[3],
    backgroundColor: colors.bg.surface,
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: colors.signal.warning,
    marginBottom: space[2],
  },
  scrollHintDone: {
    borderLeftColor: colors.signal.positive,
  },
  scrollHintText: {
    ...text.footnote,
    color: colors.signal.warning,
  },
  scrollHintTextDone: {
    color: colors.signal.positive,
  },
});
