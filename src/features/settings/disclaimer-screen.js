import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { LegalSection } from '../../components/legal-section';
import { colors, space, text } from '../../theme';

// canonical text per docs/architecture/compliance.md § The disclaimer.
// any change here must match that file (refresh annually).
export default function DisclaimerScreen() {
  return (
    <>
    <Stack.Screen options={{ title: 'Disclaimer', headerLargeTitle: false }} />
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.scroll}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Text style={styles.lede}>
        Sift provides general market information and educational content. Nothing
        in this app constitutes investment, financial, legal, or tax advice, or a
        personal recommendation. You are solely responsible for your investment
        decisions.
      </Text>

      <LegalSection title="WHAT SIFT DOES">
        Sift surfaces public information about US-listed companies (Russell 1000):
        scheduled earnings dates, parsed 8-K filings from SEC EDGAR, summaries of
        earnings call transcripts, and statistical model outputs derived from
        historical results. All content is presented for research and education.
      </LegalSection>

      <LegalSection title="WHAT SIFT DOES NOT DO">
        Sift is not a broker-dealer, investment adviser, or financial planner. Sift
        is not registered as an investment adviser in any jurisdiction. Sift does
        not provide personalised recommendations and has no knowledge of your
        portfolio, risk tolerance, goals, or financial situation. Sift does not
        execute trades.
      </LegalSection>

      <LegalSection title="PREDICTIONS AND PROBABILITIES">
        Probabilities surfaced in the app (e.g. "Model beat 65%") are statistical
        outputs derived from historical results, consensus estimate revisions,
        guidance language, and sector aggregates. They are calibrated against
        prior quarters; they are not forecasts of what will happen and they do not
        account for any individual's circumstances. A model output that something
        is "likely" or "expected" is a description of a probability distribution,
        not a recommendation to act.
      </LegalSection>

      <LegalSection title="PAST PERFORMANCE">
        Past performance — of a company, a model, or any signal shown in this app
        — is not indicative of future results. Backtest results, where shown, are
        hypothetical and do not represent real trading. Real-world execution
        introduces costs, slippage, and behavioural factors not modelled.
      </LegalSection>

      <LegalSection title="DATA SOURCES">
        Filings come from SEC EDGAR. Pricing and reference data may come from
        third-party providers. Sift does not guarantee the accuracy, completeness,
        or timeliness of any third-party data. Where Sift detects a data issue
        (stale source, parse failure), the affected surface is marked.
      </LegalSection>

      <LegalSection title="JURISDICTION">
        Sift is intended for residents of jurisdictions where the provision of
        educational research about publicly listed securities does not require
        registration as an investment adviser. Sift is not directed at residents
        of any jurisdiction where its distribution would be contrary to local law.
      </LegalSection>

      <LegalSection title="LAST UPDATED">
        This disclaimer was last reviewed on 22 May 2026. Material changes will
        be surfaced via in-app notice.
      </LegalSection>

      <View style={styles.tailSpacer} />
    </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  scroll: { paddingHorizontal: space[4], paddingBottom: space[8] },
  lede: {
    ...text.body,
    color: colors.text.primary,
    marginTop: space[3],
  },
  tailSpacer: { height: space[6] },
});
