import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { LegalSection } from '../../components/legal-section';
import { colors, space, text } from '../../theme';

// placeholder copy — final terms go through solicitor review pre-launch.
export default function TermsScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Terms', headerLargeTitle: false }} />
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.scroll}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.draftPill}>
          <Text style={styles.draftText}>DRAFT — pre-launch review pending</Text>
        </View>

        <Text style={styles.lede}>
          These Terms of Service govern your use of Sift. By using the app you
          agree to these terms. If you do not agree, do not use the app.
        </Text>

        <LegalSection title="THE SERVICE">
          Sift provides educational research about publicly listed US-equity
          companies. The service is offered "as is" without warranty of any kind.
          See the Disclaimer in Settings for the full scope of what Sift does and
          does not provide.
        </LegalSection>

        <LegalSection title="YOUR ACCOUNT">
          You are responsible for keeping your account credentials secure and for
          any activity that occurs under your account. Notify support immediately
          if you suspect unauthorised access. You must be at least 18 years old to
          use Sift.
        </LegalSection>

        <LegalSection title="ACCEPTABLE USE">
          Do not attempt to circumvent rate limits, reverse-engineer the service,
          scrape data via automated means, or use Sift to redistribute SEC filings
          commercially. Do not use Sift in jurisdictions where the provision of
          educational research about securities would violate local law.
        </LegalSection>

        <LegalSection title="FEES AND SUBSCRIPTIONS">
          Sift may offer paid subscription tiers. Pricing, billing terms, and
          cancellation policy will appear in the subscription flow itself; auto-
          renewal terms are governed by the App Store / Play Store.
        </LegalSection>

        <LegalSection title="LIABILITY">
          To the maximum extent permitted by applicable law, Sift's liability for
          any claim arising from your use of the service is limited to the amount
          you paid Sift in the 12 months preceding the claim. Sift is not liable
          for any investment losses, lost profits, or consequential damages.
        </LegalSection>

        <LegalSection title="TERMINATION">
          You may stop using Sift and delete your account at any time. Sift may
          suspend or terminate accounts that violate these terms.
        </LegalSection>

        <LegalSection title="GOVERNING LAW">
          To be confirmed prior to public launch — likely England & Wales for the
          UK entity. Disputes will be resolved through the courts of that
          jurisdiction unless local consumer-protection law provides otherwise.
        </LegalSection>

        <LegalSection title="CHANGES">
          Material changes will be surfaced via in-app notice and require
          re-acknowledgement at next launch.
        </LegalSection>

        <LegalSection title="LAST UPDATED">
          Draft of 22 May 2026. The published version will replace this document
          before public launch.
        </LegalSection>

        <View style={styles.tailSpacer} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  scroll: { paddingHorizontal: space[4], paddingBottom: space[8] },
  draftPill: {
    marginTop: space[3],
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderLeftWidth: 3,
    borderLeftColor: colors.signal.warning,
    borderRadius: 4,
  },
  draftText: {
    ...text.micro,
    color: colors.signal.warning,
    letterSpacing: 0.5,
  },
  lede: {
    ...text.body,
    color: colors.text.primary,
    marginTop: space[4],
  },
  tailSpacer: { height: space[6] },
});
