import { useRef, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Platform, Pressable } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { BookmarkPlus, BookmarkCheck, Info } from 'lucide-react-native';
import { AppSheet } from '../../components/app-sheet';
import { Card } from '../../components/card';
import { Pill } from '../../components/pill';
import { Sparkline } from '../../components/sparkline';
import { MonoNumber } from '../../components/mono-number';
import { BriefingCard } from '../../components/briefing-card';
import { DisclaimerFooter } from '../../components/disclaimer-footer';
import { Button } from '../../components/button';
import { haptics } from '../../lib/haptics';
import { colors, space, text } from '../../theme';
import { getTickerMock } from './mock';
import { PastEventRow } from './past-event-row';
import { TranscriptCard } from './transcript-card';

export default function TickerScreen() {
  const { ticker } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = getTickerMock(ticker);
  const openEvent = (id) => router.push(`/events/${id}`);

  // mock watchlist state — wire to supabase later
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

  // reserve space below the scroll content for the floating cta
  const ctaHeight = 56 + (insets.bottom > 0 ? insets.bottom : space[3]);

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
          <Text style={styles.name}>{t.name}</Text>
          <View style={styles.metaRow}>
            <Pill variant="neutral" size="sm">{t.sector}</Pill>
            <View style={{ flex: 1 }} />
            <Sparkline data={t.sparkline} width={100} height={28} color={colors.text.secondary} />
          </View>
        </View>

        <Text style={styles.sectionLabel}>UP NEXT</Text>
        <Card>
          <View style={styles.row}>
            <Text style={styles.upNextPeriod}>{t.nextEarnings.period}</Text>
            <View style={{ flex: 1 }} />
            <Text style={styles.upNextWhen}>{t.nextEarnings.when}</Text>
          </View>
          <View style={[styles.row, { marginTop: space[3] }]}>
            <Text style={styles.upNextLabel}>EPS est </Text>
            <MonoNumber value={`$${t.nextEarnings.epsEst.toFixed(2)}`} size="body" />
            <Text style={styles.sep}>  •  </Text>
            <Text style={styles.predArrow}>▲ </Text>
            <MonoNumber
              value={`${Math.round(t.nextEarnings.beatProb * 100)}%`}
              size="body"
              accessibilityLabel={`${Math.round(t.nextEarnings.beatProb * 100)} percent predicted beat probability`}
            />
            <Pressable
              onPress={openMethodology}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="How this prediction works"
              style={({ pressed }) => [styles.infoBtn, pressed && { opacity: 0.6 }]}
            >
              <Info size={14} color={colors.text.tertiary} strokeWidth={1.75} />
            </Pressable>
          </View>
          <Text style={styles.predHint}>Model confidence based on prior 12 quarters · not a recommendation</Text>
        </Card>

        <Text style={styles.sectionLabel}>PAST BRIEFINGS</Text>
        <View style={styles.cardStack}>
          {t.pastBriefings.map((b) => (
            <BriefingCard key={b.id} title={b.title} date={b.date} content={b.content} />
          ))}
        </View>

        <Text style={styles.sectionLabel}>PAST EVENTS</Text>
        <Card padding={0}>
          {t.pastEvents.map((e, i) => (
            <PastEventRow
              key={e.id}
              {...e}
              onPress={() => openEvent(e.id)}
              last={i === t.pastEvents.length - 1}
            />
          ))}
        </Card>

        <Text style={styles.sectionLabel}>TRANSCRIPTS</Text>
        <View style={styles.cardStack}>
          {t.transcripts.map((tr) => (
            <TranscriptCard key={tr.id} {...tr} />
          ))}
        </View>

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
    // BlurView paints background on iOS; android falls back to translucent dark
    backgroundColor: Platform.OS === 'ios' ? 'rgba(11,15,23,0.6)' : colors.bg.base,
    borderTopColor: colors.border.subtle,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  hero: {
    marginBottom: space[5],
  },
  symbol: {
    ...text.displayLgMono,
    color: colors.text.primary,
  },
  name: {
    ...text.subhead,
    color: colors.text.secondary,
    marginTop: space[1],
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space[4],
  },
  sectionLabel: {
    ...text.micro,
    color: colors.text.tertiary,
    letterSpacing: 0.5,
    marginBottom: space[3],
    marginTop: space[4],
  },
  row: { flexDirection: 'row', alignItems: 'baseline' },
  upNextPeriod: { ...text.headline, color: colors.text.primary },
  upNextWhen: { ...text.subhead, color: colors.text.tertiary },
  upNextLabel: { ...text.subhead, color: colors.text.secondary },
  sep: { ...text.subhead, color: colors.text.tertiary },
  predArrow: { ...text.bodyMono, color: colors.accent.default },
  predHint: {
    ...text.footnote,
    color: colors.text.tertiary,
    marginTop: space[3],
  },
  cardStack: { gap: space[3] },
  infoBtn: { marginLeft: space[2], padding: 2 },
  sheet: { paddingHorizontal: space[5], paddingTop: space[3], gap: space[4] },
  sheetTitle: { ...text.title, color: colors.text.primary },
  sheetBody: { ...text.body, color: colors.text.secondary },
  sheetMuted: { ...text.footnote, color: colors.text.tertiary, marginTop: space[2] },
});
