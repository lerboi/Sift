import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { LegalSection } from '../../components/legal-section';
import { colors, space, text } from '../../theme';

// placeholder copy — final privacy policy goes through solicitor review pre-launch
// per docs/architecture/compliance.md § "When the v2 / SaaS launch comes".
export default function PrivacyScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Privacy', headerLargeTitle: false }} />
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.scroll}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.draftPill}>
          <Text style={styles.draftText}>DRAFT — pre-launch review pending</Text>
        </View>

        <Text style={styles.lede}>
          This Privacy Policy describes how Sift collects, uses, and protects
          information when you use the Sift mobile app.
        </Text>

        <LegalSection title="WHAT WE COLLECT">
          Account information (email address) when you sign up. Your watchlist of
          tickers and notification preferences when you set them. Anonymous usage
          analytics about which screens you visit and which features you use; no
          content of what you read or watch is collected.
        </LegalSection>

        <LegalSection title="WHAT WE DO NOT COLLECT">
          Sift does not access your contacts, calendar, photos, location, microphone,
          or camera. Sift does not collect information about your brokerage accounts,
          trades, positions, or any other financial data.
        </LegalSection>

        <LegalSection title="HOW WE USE IT">
          To deliver the service: show your watchlist, send notifications you opt
          into, generate briefings for the tickers you track. To improve the product:
          aggregated analytics inform which features get attention. We do not sell
          your data and do not share it with advertisers.
        </LegalSection>

        <LegalSection title="WHERE IT LIVES">
          Account and watchlist data is stored in Supabase (EU-region project for
          users in the EU/UK; US-region for users in the Americas). Push tokens are
          stored only as long as your device is registered for notifications.
          Backups are retained for 30 days.
        </LegalSection>

        <LegalSection title="YOUR RIGHTS">
          You can export or delete your data at any time from Settings. Where
          applicable (UK/EU), you have rights under GDPR including access,
          rectification, erasure, and objection. Contact requests at
          privacy@sift.app.
        </LegalSection>

        <LegalSection title="THIRD PARTIES">
          Sift uses Anthropic for briefing generation, OpenAI as a fallback,
          Supabase for storage, Modal for compute, Expo for push notifications.
          Their respective privacy policies govern data they process on Sift's
          behalf.
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
