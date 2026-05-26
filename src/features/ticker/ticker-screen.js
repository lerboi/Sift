import { useMemo, useRef, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Platform, Pressable } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { BookmarkPlus, BookmarkCheck } from 'lucide-react-native';
import { AppSheet } from '../../components/app-sheet';
import { DayHeader } from '../../components/day-header';
import { EventTimelineCard } from '../../components/event-timeline-card';
import { Sparkline } from '../../components/sparkline';
import { BriefingCard } from '../../components/briefing-card';
import { DisclaimerFooter } from '../../components/disclaimer-footer';
import { Button } from '../../components/button';
import { haptics } from '../../lib/haptics';
import { groupByDay } from '../../lib/dates';
import { colors, space, text } from '../../theme';
import { getTickerMock } from './mock';
import { TranscriptCard } from './transcript-card';

export default function TickerScreen() {
  const { ticker } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = getTickerMock(ticker);
  // tab-scoped — ticker detail lives in Watchlist's Stack (p11-8)
  const openEvent = (id) => router.push(`/watchlist/events/${id}`);

  const [onWatchlist, setOnWatchlist] = useState(false);
  const toggleWatchlist = () => {
    haptics.select();
    setOnWatchlist((v) => !v);
  };

  const methodologySheet = useRef(null);
  const openMethodology = () => {
    haptics.tap();
    methodologySheet.current?.expand();
  };

  // ctaHeight reserves bottom space so the sticky cta doesn't cover the last item
  const ctaHeight = 56 + (insets.bottom > 0 ? insets.bottom : space[3]);

  const timeline = useMemo(() => buildTimeline(t), [t]);
  const groups = useMemo(() => groupByDay(timeline), [timeline]);
  const change30d = useMemo(() => percentChange(t.sparkline), [t.sparkline]);
  const changeSign = change30d >= 0 ? '+' : '';

  return (
    <>
      <Stack.Screen options={{ title: t.symbol, headerLargeTitle: false }} />
      <View style={styles.root}>
        <ScrollView
          style={styles.scrollRoot}
          contentContainerStyle={[styles.scroll, { paddingBottom: ctaHeight + space[6] }]}
          contentInsetAdjustmentBehavior="automatic"
        >
          <View style={styles.hero}>
            <Text style={styles.symbol}>{t.symbol}</Text>
            <Text style={styles.subline}>{t.name} · {t.sector}</Text>
            <View style={styles.sparkRow}>
              <Sparkline data={t.sparkline} width={140} height={32} color={colors.text.secondary} />
              <Text style={styles.changeLabel}>{changeSign}{change30d.toFixed(1)}% 30d</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {groups.map((g) => (
            <View key={g.dateISO} style={styles.group}>
              <DayHeader iso={`${g.dateISO}T12:00:00`} />
              {g.items.map((item) => (
                <View key={item.id} style={styles.cardWrap}>
                  {renderItem(item, { onOpenEvent: openEvent, onInfoPress: openMethodology })}
                </View>
              ))}
            </View>
          ))}

          <DisclaimerFooter />
        </ScrollView>

        <BlurView
          intensity={Platform.OS === 'ios' ? 70 : 0}
          tint="dark"
          style={[
            styles.ctaBar,
            { paddingBottom: insets.bottom > 0 ? insets.bottom : space[3] },
          ]}
        >
          <Button
            variant={onWatchlist ? 'secondary' : 'primary'}
            onPress={toggleWatchlist}
            icon={
              onWatchlist
                ? <BookmarkCheck size={16} color={colors.text.primary} strokeWidth={1.75} />
                : <BookmarkPlus size={16} color={colors.accent.on} strokeWidth={1.75} />
            }
            fullWidth
            accessibilityLabel={onWatchlist ? `Remove ${t.symbol} from watchlist` : `Add ${t.symbol} to watchlist`}
          >
            {onWatchlist ? 'On watchlist' : 'Add to watchlist'}
          </Button>
        </BlurView>
      </View>

      <AppSheet ref={methodologySheet} snapPoints={['55%']}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>How this prediction works</Text>
          <Text style={styles.sheetBody}>
            Sift's beat-probability model uses the last 12 quarters of {t.symbol}'s
            results, the 30-day path of consensus EPS revisions, guidance language
            from the prior earnings call, and sector-aggregate momentum heading
            into the report.
          </Text>
          <Text style={styles.sheetBody}>
            The {Math.round(t.nextEarnings.beatProb * 100)}% you see is the
            calibrated probability that the company beats consensus EPS for{' '}
            {t.nextEarnings.period}. It is statistical — not a forecast of what
            will happen, and not personalised to any portfolio.
          </Text>
          <Text style={styles.sheetMuted}>
            Sift provides educational research only. Not investment advice. See
            the full disclaimer in Settings.
          </Text>
        </View>
      </AppSheet>
    </>
  );
}

// merges all of a ticker's content into one timeline-shaped array.
// each item has { id, kind, expectedAt|actualAt, payload } — payload is the
// original record. groupByDay reads expectedAt||actualAt as date, so we always
// expose at least one of those.
function buildTimeline(t) {
  const stream = [];
  if (t.nextEarnings?.expectedAt) {
    stream.push({
      id: `next-${t.symbol}`,
      kind: 'earnings-upcoming',
      expectedAt: t.nextEarnings.expectedAt,
      payload: t,
    });
  }
  for (const e of t.pastEvents ?? []) {
    stream.push({
      id: `evt-${e.id}`,
      kind: 'earnings-past',
      actualAt: e.actualAt,
      expectedAt: e.expectedAt,
      payload: { ...e, ticker: t.symbol, name: t.name },
    });
  }
  for (const b of t.pastBriefings ?? []) {
    stream.push({
      id: `brf-${b.id}`,
      kind: 'briefing',
      actualAt: b.publishedAt,
      payload: b,
    });
  }
  for (const tr of t.transcripts ?? []) {
    stream.push({
      id: `tr-${tr.id}`,
      kind: 'transcript',
      actualAt: tr.recordedAt,
      payload: tr,
    });
  }
  return stream;
}

function renderItem(item, { onOpenEvent, onInfoPress }) {
  if (item.kind === 'earnings-upcoming') {
    const t = item.payload;
    return (
      <EventTimelineCard
        state="upcoming"
        hideIdentity
        ticker={t.symbol}
        name={t.name}
        period={t.nextEarnings.period}
        expectedAt={t.nextEarnings.expectedAt}
        epsEst={t.nextEarnings.epsEst}
        beatProb={t.nextEarnings.beatProb}
        briefingReady
        onInfoPress={onInfoPress}
      />
    );
  }
  if (item.kind === 'earnings-past') {
    const e = item.payload;
    return (
      <EventTimelineCard
        state="past"
        hideIdentity
        ticker={e.ticker}
        name={e.name}
        period={e.period}
        expectedAt={e.expectedAt}
        actualAt={e.actualAt}
        epsActual={e.epsActual}
        epsEst={e.epsEst}
        surprisePct={e.surprisePct}
        onPress={() => onOpenEvent(e.id)}
        onOpenDetail={() => onOpenEvent(e.id)}
      />
    );
  }
  if (item.kind === 'briefing') {
    const b = item.payload;
    return <BriefingCard title={b.title} date={b.date} content={b.content} showDate={false} />;
  }
  if (item.kind === 'transcript') {
    const tr = item.payload;
    return (
      <TranscriptCard
        period={tr.period}
        date={tr.date}
        tone={tr.tone}
        novelTopics={tr.novelTopics}
        snippet={tr.snippet}
        showDate={false}
      />
    );
  }
  return null;
}

function percentChange(series) {
  if (!series?.length) return 0;
  const first = series[0];
  const last = series[series.length - 1];
  if (!first) return 0;
  return ((last - first) / first) * 100;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  scrollRoot: { flex: 1 },
  scroll: { padding: space[4] },
  ctaBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space[4],
    paddingTop: space[3],
    backgroundColor: Platform.OS === 'ios' ? 'rgba(11,15,23,0.6)' : colors.bg.base,
    borderTopColor: colors.border.subtle,
    borderTopWidth: StyleSheet.hairlineWidth,
  },

  hero: {
    marginBottom: space[3],
  },
  symbol: {
    ...text.displayLgMono,
    color: colors.text.primary,
  },
  subline: {
    ...text.subhead,
    color: colors.text.secondary,
    marginTop: space[1],
  },
  sparkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    marginTop: space[3],
  },
  changeLabel: {
    ...text.subheadMono,
    color: colors.text.secondary,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.subtle,
    marginVertical: space[4],
  },

  group: {
    marginTop: space[3],
  },
  cardWrap: {
    marginBottom: space[3],
  },

  sheet: { paddingHorizontal: space[5], paddingTop: space[3], gap: space[4] },
  sheetTitle: { ...text.title, color: colors.text.primary },
  sheetBody: { ...text.body, color: colors.text.secondary },
  sheetMuted: { ...text.footnote, color: colors.text.tertiary, marginTop: space[2] },
});
