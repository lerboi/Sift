import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, View, Text, StyleSheet, Share } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { ExternalLink, Share2 } from 'lucide-react-native';
import { Card } from '../../components/card';
import { MonoNumber } from '../../components/mono-number';
import { Pill } from '../../components/pill';
import { DisclaimerFooter } from '../../components/disclaimer-footer';
import { SettingsRow } from '../../components/settings-row';
import { InlineError } from '../../components/inline-error';
import { EmptyState } from '../../components/empty-state';
import { colors, space, text } from '../../theme';
import { useEvent } from './use-event';
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

const fmtUSD = (n) => `$${Number(n).toFixed(2)}`;
const fmtBillion = (n) => `$${Number(n).toFixed(1)}B`;

const GUIDANCE = {
  raised:     { variant: 'positive', label: 'Guidance raised' },
  maintained: { variant: 'neutral',  label: 'Guidance maintained' },
  lowered:    { variant: 'negative', label: 'Guidance lowered' },
  withdrawn:  { variant: 'negative', label: 'Guidance withdrawn' },
  none:       { variant: 'neutral',  label: 'No guidance update' },
};

function formatFiscalPeriod(p) {
  if (!p) return '';
  const m = String(p).match(/^(Q[1-4])-(\d{4})$/);
  if (!m) return p;
  return `${m[1]} ${m[2].slice(-2)}`;
}

function deltaLabel(sec) {
  if (sec == null) return null;
  if (sec < 60) return `+${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s === 0 ? `+${m}m` : `+${m}m ${s}s`;
}

export default function EventScreen() {
  const { event_id } = useLocalSearchParams();
  const { data: ev, loading, error, refresh } = useEvent(event_id);

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: '', headerLargeTitle: false }} />
        <View style={[styles.root, styles.center]} />
      </>
    );
  }

  if (error) {
    return (
      <>
        <Stack.Screen options={{ title: 'Event', headerLargeTitle: false }} />
        <ScrollView style={styles.root} contentContainerStyle={styles.centerScroll}>
          <InlineError title="Couldn't load event" message={error.message} onRetry={refresh} />
        </ScrollView>
      </>
    );
  }

  if (!ev) {
    return (
      <>
        <Stack.Screen options={{ title: 'Event', headerLargeTitle: false }} />
        <ScrollView style={styles.root} contentContainerStyle={styles.centerScroll}>
          <EmptyState
            title="Event not found"
            description="The filing you're looking for isn't available. It may have been removed or the link is stale."
          />
        </ScrollView>
      </>
    );
  }

  const hasMetrics = ev.epsActual != null && ev.surprisePct != null;
  const isFailed = ev.parseStatus === 'failed' || !hasMetrics;
  const c = hasMetrics ? classify(ev.surprisePct) : null;
  const display = hasMetrics ? fmtSurprise(ev.surprisePct) : '—';
  const periodDisplay = formatFiscalPeriod(ev.period);

  const openFiling = () => {
    if (!ev.exhibitUrl) return;
    WebBrowser.openBrowserAsync(ev.exhibitUrl, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET });
  };

  const shareEvent = () => {
    const body =
      `${ev.ticker} ${periodDisplay} earnings — ${c.label.toLowerCase()}\n` +
      `EPS ${fmtUSD(ev.epsActual)} vs ${fmtUSD(ev.epsEst)} estimate (${display})\n` +
      `Revenue ${fmtBillion(ev.revenueActual)} vs ${fmtBillion(ev.revenueEst)} estimate (${fmtSurprise(ev.revenueSurprisePct)})\n` +
      `Guidance ${ev.guidance.direction}.\n\n` +
      `Via Sift — educational research, not investment advice.`;
    Share.share({ message: body });
  };

  const timelineSteps = [
    { label: '8-K filed on EDGAR',    time: ev.filedAt,    delta: null },
    { label: 'Detected by Sift',      time: ev.detectedAt, delta: deltaLabel(ev.detectedDeltaSec) },
    { label: 'Pushed to your device', time: ev.pushedAt,   delta: deltaLabel(ev.pushedDeltaSec) },
  ].filter((s) => s.time);

  const guidanceMeta = GUIDANCE[ev.guidance.direction] ?? GUIDANCE.none;

  return (
    <>
      <Stack.Screen options={{ title: `${ev.ticker} ${periodDisplay}`, headerLargeTitle: false }} />
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.scroll}
        contentInsetAdjustmentBehavior="automatic"
      >
        {isFailed ? (
          <View style={styles.hero}>
            <Pill variant="negative" size="md">Filing couldn't be parsed</Pill>
            <Text style={[styles.heroCaption, { marginTop: space[4] }]}>
              The 8-K was detected but the extraction step couldn't recover the EPS / revenue figures. Tap the source link below to view the original filing.
            </Text>
            {ev.filedAt ? <Text style={styles.heroFiled}>{ev.filedAt}</Text> : null}
          </View>
        ) : (
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
        )}

        {ev.epsActual != null && ev.revenueActual != null ? (
          <>
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
                <CompareBar label="EPS"     actual={ev.epsActual}     estimate={ev.epsEst}     surprisePct={ev.surprisePct}        formatter={fmtUSD} />
                <CompareBar label="REVENUE" actual={ev.revenueActual} estimate={ev.revenueEst} surprisePct={ev.revenueSurprisePct} formatter={fmtBillion} />
              </View>
            </Card>
          </>
        ) : null}

        <Text style={styles.sectionLabel}>GUIDANCE</Text>
        <Card>
          <View style={styles.guidanceRow}>
            <Pill variant={guidanceMeta.variant} size="md">{guidanceMeta.label}</Pill>
          </View>
          {ev.guidance.detail ? <Text style={styles.guidanceDetail}>{ev.guidance.detail}</Text> : null}
        </Card>

        {timelineSteps.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>FILING TIMELINE</Text>
            <Card>
              {timelineSteps.map((s, i) => {
                const last = i === timelineSteps.length - 1;
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
              })}
              {ev.pushedDeltaSec != null && ev.pushedDeltaSec <= 15 ? (
                <View style={styles.timelineNote}>
                  <Pill variant="positive" size="sm">within 15s target</Pill>
                </View>
              ) : null}
            </Card>
          </>
        ) : null}

        {ev.segments.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>SEGMENTS</Text>
            <Card padding={0}>
              {ev.segments.map((s, i) => {
                const actualN = Number(s.actual);
                const estN = Number(s.est);
                const delta = estN === 0 ? 0 : (actualN - estN) / estN;
                const beat = delta > 0.005;
                const miss = delta < -0.005;
                const arrow = beat ? '▲' : miss ? '▼' : '━';
                const col = beat ? colors.signal.positive : miss ? colors.signal.negative : colors.signal.neutral;
                const last = i === ev.segments.length - 1;
                return (
                  <View key={s.name + i} style={[styles.segRow, !last && styles.segDivider]}>
                    <View style={styles.segLeft}>
                      <Text style={styles.segName}>{s.name}</Text>
                      <Text style={styles.segEst}>vs {fmtBillion(estN)}</Text>
                    </View>
                    <View style={styles.segMid}>
                      <MonoNumber value={fmtBillion(actualN)} size="headline" />
                    </View>
                    <Text style={[styles.segDelta, { color: col }]}>{arrow} {fmtSurprise(delta)}</Text>
                  </View>
                );
              })}
            </Card>
          </>
        ) : null}

        <Text style={styles.sectionLabel}>SOURCE</Text>
        <Card padding={0}>
          {ev.exhibitUrl ? (
            <SettingsRow
              icon={<ExternalLink size={18} color={colors.text.secondary} strokeWidth={1.75} />}
              label="View original Exhibit 99.1"
              onPress={openFiling}
            />
          ) : null}
          {hasMetrics ? (
            <SettingsRow
              icon={<Share2 size={18} color={colors.text.secondary} strokeWidth={1.75} />}
              label="Share"
              onPress={shareEvent}
              last
            />
          ) : null}
        </Card>

        <DisclaimerFooter />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  scroll: { padding: space[4], paddingBottom: space[8] },
  center: { alignItems: 'center', justifyContent: 'center' },
  centerScroll: { flexGrow: 1, justifyContent: 'center', padding: space[5] },
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
