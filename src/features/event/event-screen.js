import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, View, Text, StyleSheet, Share } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { ExternalLink, Share2 } from 'lucide-react-native';
import { Card } from '../../components/card';
import { MonoNumber } from '../../components/mono-number';
import { Pill } from '../../components/pill';
import { DisclaimerFooter } from '../../components/disclaimer-footer';
import { SettingsRow } from '../../components/settings-row';
import { colors, space, text } from '../../theme';
import { getEventMock } from './mock';
import { MetricTile } from './metric-tile';
import { CompareBar } from './compare-bar';

function classify(p) {
  if (p > 0.005) return { variant: 'positive', arrow: '▲', label: 'Reported beat' };
  if (p < -0.005) return { variant: 'negative', arrow: '▼', label: 'Reported miss' };
  return { variant: 'neutral', arrow: '━', label: 'In line' };
}

function fmtSurprise(p) {
  const pct = Math.abs(p * 100).toFixed(1);
  const sign = p > 0 ? '+' : p < 0 ? '−' : '';
  return `${sign}${pct}%`;
}

const fmtUSD = (n) => `$${n.toFixed(2)}`;
const fmtBillion = (n) => `$${n.toFixed(1)}B`;

const GUIDANCE = {
  raised:     { variant: 'positive', label: 'Guidance raised' },
  maintained: { variant: 'neutral',  label: 'Guidance maintained' },
  lowered:    { variant: 'negative', label: 'Guidance lowered' },
};

export default function EventScreen() {
  const { event_id } = useLocalSearchParams();
  const ev = getEventMock(event_id);
  const c = classify(ev.surprisePct);
  const display = fmtSurprise(ev.surprisePct);

  const openFiling = () => {
    WebBrowser.openBrowserAsync(ev.exhibitUrl, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET });
  };

  const shareEvent = () => {
    const body =
      `${ev.ticker} ${ev.period} earnings — ${c.label.toLowerCase()}\n` +
      `EPS ${fmtUSD(ev.epsActual)} vs ${fmtUSD(ev.epsEst)} estimate (${display})\n` +
      `Revenue ${fmtBillion(ev.revenueActual)} vs ${fmtBillion(ev.revenueEst)} estimate (${fmtSurprise(ev.revenueSurprisePct)})\n` +
      `Guidance ${ev.guidance.direction}.\n\n` +
      `Via Sift — educational research, not investment advice.`;
    Share.share({ message: body });
  };

  return (
    <>
      <Stack.Screen options={{ title: `${ev.ticker} ${ev.period}`, headerLargeTitle: false }} />
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.scroll}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.hero}>
          <Pill variant={c.variant} size="md">{c.arrow} {c.label}</Pill>
          <MonoNumber
            value={display}
            size="displayLg"
            color={colors.text.primary}
            accessibilityLabel={`${c.label}, ${display.replace('%', ' percent').replace('+', 'up ').replace('−', 'down ')} EPS surprise`}
            style={styles.heroNumber}
          />
          <Text style={styles.heroCaption}>EPS surprise vs estimate</Text>
          <Text style={styles.heroFiled}>{ev.filedAt}</Text>
        </View>

        <Text style={styles.sectionLabel}>METRICS</Text>
        <View style={styles.metricGrid}>
          <MetricTile
            label="EPS"
            actual={ev.epsActual}
            estimate={ev.epsEst}
            surprisePct={ev.surprisePct}
            formatter={fmtUSD}
          />
          <MetricTile
            label="REVENUE"
            actual={ev.revenueActual}
            estimate={ev.revenueEst}
            surprisePct={ev.revenueSurprisePct}
            formatter={fmtBillion}
          />
        </View>

        <Text style={styles.sectionLabel}>ACTUAL vs ESTIMATE</Text>
        <Card>
          <View style={styles.compareStack}>
            <CompareBar
              label="EPS"
              actual={ev.epsActual}
              estimate={ev.epsEst}
              surprisePct={ev.surprisePct}
              formatter={fmtUSD}
            />
            <CompareBar
              label="REVENUE"
              actual={ev.revenueActual}
              estimate={ev.revenueEst}
              surprisePct={ev.revenueSurprisePct}
              formatter={fmtBillion}
            />
          </View>
        </Card>

        <Text style={styles.sectionLabel}>GUIDANCE</Text>
        <Card>
          <View style={styles.guidanceRow}>
            <Pill variant={(GUIDANCE[ev.guidance.direction] ?? GUIDANCE.maintained).variant} size="md">
              {(GUIDANCE[ev.guidance.direction] ?? GUIDANCE.maintained).label}
            </Pill>
          </View>
          <Text style={styles.guidanceDetail}>{ev.guidance.detail}</Text>
        </Card>

        <Text style={styles.sectionLabel}>FILING TIMELINE</Text>
        <Card>
          {(() => {
            // proof of latency: 8-K hits EDGAR → Sift detects → pushed to device
            const steps = [
              { label: '8-K filed on EDGAR',  time: ev.filedAt,    delta: null },
              { label: 'Detected by Sift',    time: ev.detectedAt, delta: '+8s' },
              { label: 'Pushed to your device', time: ev.pushedAt, delta: '+14s' },
            ];
            return steps.map((s, i) => {
              const last = i === steps.length - 1;
              return (
                <View key={i} style={styles.timelineStep}>
                  <View style={styles.timelineCol}>
                    <View style={[styles.timelineDot, last && styles.timelineDotFinal]} />
                    {!last ? <View style={styles.timelineLine} /> : null}
                  </View>
                  <View style={styles.timelineBody}>
                    <Text style={styles.timelineLabel}>{s.label}</Text>
                    <Text style={styles.timelineTime}>
                      {s.time}
                      {s.delta ? <Text style={styles.timelineDelta}>  ·  {s.delta} after filing</Text> : null}
                    </Text>
                  </View>
                </View>
              );
            });
          })()}
          <View style={styles.timelineNote}>
            <Pill variant="positive" size="sm">within 15s target</Pill>
          </View>
        </Card>

        <Text style={styles.sectionLabel}>SEGMENTS</Text>
        <Card padding={0}>
          {ev.segments.map((s, i) => {
            const delta = (s.actual - s.est) / s.est;
            const beat = delta > 0.005;
            const miss = delta < -0.005;
            const arrow = beat ? '▲' : miss ? '▼' : '━';
            const col = beat ? colors.signal.positive : miss ? colors.signal.negative : colors.signal.neutral;
            const last = i === ev.segments.length - 1;
            return (
              <View key={s.name} style={[styles.segRow, !last && styles.segDivider]}>
                <View style={styles.segLeft}>
                  <Text style={styles.segName}>{s.name}</Text>
                  <Text style={styles.segEst}>vs {fmtBillion(s.est)}</Text>
                </View>
                <View style={styles.segMid}>
                  <MonoNumber value={fmtBillion(s.actual)} size="headline" />
                </View>
                <Text style={[styles.segDelta, { color: col }]}>{arrow} {fmtSurprise(delta)}</Text>
              </View>
            );
          })}
        </Card>

        <Text style={styles.sectionLabel}>SOURCE</Text>
        <Card padding={0}>
          <SettingsRow
            icon={<ExternalLink size={18} color={colors.text.secondary} strokeWidth={1.75} />}
            label="View original Exhibit 99.1"
            onPress={openFiling}
          />
          <SettingsRow
            icon={<Share2 size={18} color={colors.text.secondary} strokeWidth={1.75} />}
            label="Share"
            onPress={shareEvent}
            last
          />
        </Card>

        <DisclaimerFooter />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  scroll: { padding: space[4], paddingBottom: space[8] },
  hero: {
    alignItems: 'center',
    paddingVertical: space[6],
  },
  heroNumber: { marginTop: space[3] },
  heroCaption: { ...text.subhead, color: colors.text.secondary, marginTop: space[2] },
  heroFiled: { ...text.footnote, color: colors.text.tertiary, marginTop: space[1] },
  sectionLabel: {
    ...text.micro,
    color: colors.text.tertiary,
    letterSpacing: 0.5,
    marginTop: space[5],
    marginBottom: space[3],
  },
  metricGrid: {
    flexDirection: 'row',
    gap: space[3],
  },
  compareStack: { gap: space[4] },
  timelineStep: { flexDirection: 'row', gap: space[3] },
  timelineCol: { width: 12, alignItems: 'center' },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent.default,
    marginTop: 6,
  },
  timelineDotFinal: { backgroundColor: colors.signal.positive },
  timelineLine: {
    flex: 1,
    width: 1,
    backgroundColor: colors.border.default,
    marginVertical: 4,
  },
  timelineBody: { flex: 1, paddingBottom: space[4] },
  timelineLabel: { ...text.headline, color: colors.text.primary },
  timelineTime: { ...text.footnote, color: colors.text.tertiary, marginTop: 2 },
  timelineDelta: { ...text.footnoteMono, color: colors.text.secondary },
  timelineNote: { alignItems: 'flex-start', marginTop: space[2] },
  guidanceRow: { flexDirection: 'row' },
  guidanceDetail: { ...text.body, color: colors.text.secondary, marginTop: space[3] },
  segRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    minHeight: 56,
  },
  segDivider: {
    borderBottomColor: colors.border.subtle,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  segLeft: { width: 110 },
  segMid: { flex: 1 },
  segName: { ...text.headline, color: colors.text.primary },
  segEst: { ...text.footnote, color: colors.text.tertiary, marginTop: 2 },
  segDelta: { ...text.subheadMono },
});
