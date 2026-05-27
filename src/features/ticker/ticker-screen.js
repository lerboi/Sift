import { useMemo, useRef } from 'react';
import { ScrollView, View, Text, StyleSheet, Platform } from 'react-native';
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
import { InlineError } from '../../components/inline-error';
import { Button } from '../../components/button';
import { haptics } from '../../lib/haptics';
import { groupByDay } from '../../lib/dates';
import { colors, space, text } from '../../theme';
import { useTickerDetail } from './use-ticker-detail';
import { useSparkline } from '../watchlist/use-sparkline';
import { TranscriptCard } from './transcript-card';

export default function TickerScreen() {
  const { ticker } = useLocalSearchParams();
  const symbol = String(ticker || '').toUpperCase();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { meta, timeline, loading, error, onWatchlist, toggleWatchlist, refresh } = useTickerDetail(symbol);
  const sparkline = useSparkline(symbol);

  const openEvent = (id) => router.push(`/watchlist/events/${id}`);

  const methodologySheet = useRef(null);
  const openMethodology = () => {
    haptics.tap();
    methodologySheet.current?.expand();
  };

  const onToggle = () => {
    haptics.select();
    toggleWatchlist();
  };

  const ctaHeight = 56 + (insets.bottom > 0 ? insets.bottom : space[3]);

  // map server timeline shape onto groupByDay's expected fields
  const groupable = useMemo(() => timeline.map((item) => ({
    ...item,
    expectedAt: item.kind === 'earnings-upcoming' ? item.occurredAt : null,
    actualAt: item.kind === 'earnings-upcoming' ? null : item.occurredAt,
  })), [timeline]);
  const groups = useMemo(() => groupByDay(groupable), [groupable]);
  const change30d = useMemo(() => percentChange(sparkline), [sparkline]);
  const changeSign = change30d >= 0 ? '+' : '';

  const nextUpcoming = useMemo(
    () => timeline.find((i) => i.kind === 'earnings-upcoming') || null,
    [timeline],
  );

  if (error) {
    return (
      <>
        <Stack.Screen options={{ title: symbol, headerLargeTitle: false }} />
        <ScrollView style={styles.root} contentContainerStyle={styles.centerScroll}>
          <InlineError title={`Couldn't load ${symbol}`} message={error.message} onRetry={refresh} />
        </ScrollView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: symbol, headerLargeTitle: false }} />
      <View style={styles.root}>
        <ScrollView
          style={styles.scrollRoot}
          contentContainerStyle={[styles.scroll, { paddingBottom: ctaHeight + space[6] }]}
          contentInsetAdjustmentBehavior="automatic"
        >
          <View style={styles.hero}>
            <Text style={styles.symbol}>{symbol}</Text>
            <Text style={styles.subline}>
              {meta?.name ?? symbol}{meta?.sector ? ` · ${meta.sector}` : ''}
            </Text>
            <View style={styles.sparkRow}>
              <Sparkline data={sparkline} width={140} height={32} color={colors.text.secondary} />
              <Text style={styles.changeLabel}>{changeSign}{change30d.toFixed(1)}% 30d</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {!loading && groups.length === 0 ? (
            <Text style={styles.emptyLine}>
              No upcoming or recent earnings for {symbol} yet.
            </Text>
          ) : null}

          {groups.map((g) => (
            <View key={g.dateISO} style={styles.group}>
              <DayHeader iso={`${g.dateISO}T12:00:00`} />
              {g.items.map((item) => (
                <View key={item.id} style={styles.cardWrap}>
                  {renderItem(item, { symbol, name: meta?.name ?? symbol, onOpenEvent: openEvent, onInfoPress: openMethodology })}
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
            onPress={onToggle}
            icon={
              onWatchlist
                ? <BookmarkCheck size={16} color={colors.text.primary} strokeWidth={1.75} />
                : <BookmarkPlus size={16} color={colors.accent.on} strokeWidth={1.75} />
            }
            fullWidth
            accessibilityLabel={onWatchlist ? `Remove ${symbol} from watchlist` : `Add ${symbol} to watchlist`}
          >
            {onWatchlist ? 'On watchlist' : 'Add to watchlist'}
          </Button>
        </BlurView>
      </View>

      <AppSheet ref={methodologySheet} snapPoints={['55%']}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>How this prediction works</Text>
          <Text style={styles.sheetBody}>
            Sift's beat-probability model uses the last 12 quarters of {symbol}'s
            results, the 30-day path of consensus EPS revisions, guidance language
            from the prior earnings call, and sector-aggregate momentum heading
            into the report.
          </Text>
          {nextUpcoming?.payload.beatProb != null ? (
            <Text style={styles.sheetBody}>
              The {Math.round(nextUpcoming.payload.beatProb * 100)}% you see is the
              calibrated probability that the company beats consensus EPS for{' '}
              {nextUpcoming.payload.period}. It is statistical — not a forecast of
              what will happen, and not personalised to any portfolio.
            </Text>
          ) : null}
          <Text style={styles.sheetMuted}>
            Sift provides educational research only. Not investment advice. See
            the full disclaimer in Settings.
          </Text>
        </View>
      </AppSheet>
    </>
  );
}

function renderItem(item, { symbol, name, onOpenEvent, onInfoPress }) {
  if (item.kind === 'earnings-upcoming') {
    const p = item.payload;
    return (
      <EventTimelineCard
        state="upcoming"
        hideIdentity
        ticker={symbol}
        name={name}
        period={p.period}
        expectedAt={p.expectedAt}
        epsEst={p.epsEst}
        beatProb={p.beatProb}
        briefingReady
        onInfoPress={onInfoPress}
      />
    );
  }
  if (item.kind === 'earnings-past') {
    const p = item.payload;
    return (
      <EventTimelineCard
        state="past"
        hideIdentity
        ticker={symbol}
        name={name}
        period={p.period}
        expectedAt={p.expectedAt}
        actualAt={p.actualAt}
        epsActual={p.epsActual}
        epsEst={p.epsEst}
        surprisePct={p.surprisePct}
        onPress={() => onOpenEvent(item.id)}
        onOpenDetail={() => onOpenEvent(item.id)}
      />
    );
  }
  if (item.kind === 'briefing') {
    const p = item.payload;
    return <BriefingCard title={p.title} date={p.date} content={p.content} showDate={false} />;
  }
  if (item.kind === 'transcript') {
    const p = item.payload;
    return (
      <TranscriptCard
        period={p.period}
        date={p.date}
        tone={p.tone}
        novelTopics={p.novelTopics}
        snippet={p.snippet}
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
  centerScroll: { flexGrow: 1, justifyContent: 'center', padding: space[5] },
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

  hero: { marginBottom: space[3] },
  symbol: { ...text.displayLgMono, color: colors.text.primary },
  subline: { ...text.subhead, color: colors.text.secondary, marginTop: space[1] },
  sparkRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], marginTop: space[3] },
  changeLabel: { ...text.subheadMono, color: colors.text.secondary },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.subtle,
    marginVertical: space[4],
  },

  emptyLine: {
    ...text.body,
    color: colors.text.tertiary,
    textAlign: 'center',
    paddingVertical: space[6],
  },

  group: { marginTop: space[3] },
  cardWrap: { marginBottom: space[3] },

  sheet: { paddingHorizontal: space[5], paddingTop: space[3], gap: space[4] },
  sheetTitle: { ...text.title, color: colors.text.primary },
  sheetBody: { ...text.body, color: colors.text.secondary },
  sheetMuted: { ...text.footnote, color: colors.text.tertiary, marginTop: space[2] },
});
