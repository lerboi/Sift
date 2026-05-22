import { useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet, RefreshControl } from 'react-native';
import { Bookmark } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { EarningsCard } from '../../components/earnings-card';
import { EventCard } from '../../components/event-card';
import { DisclaimerFooter } from '../../components/disclaimer-footer';
import { EmptyState } from '../../components/empty-state';
import { NewEventsPill } from '../../components/new-events-pill';
import { haptics } from '../../lib/haptics';
import { colors, space, text } from '../../theme';
import { useHomeData } from './use-home-data';
import { HomeSkeleton } from './home-skeleton';

export default function HomeScreen() {
  const router = useRouter();
  const { live, upcoming, recent, loading, refreshing, refresh, pending, promotePending } = useHomeData();

  // fire a light haptic exactly when a new event lands while user is on screen
  useEffect(() => {
    if (pending.length > 0) haptics.tap();
  }, [pending.length]);

  const openTicker = (ticker) => router.push(`/watchlist/${ticker}`);
  const openEvent = (eventId) => router.push(`/events/${eventId}`);

  const isEmpty = !loading && live.length === 0 && upcoming.length === 0 && recent.length === 0;

  const showPill = !loading && !isEmpty && pending.length > 0;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.scroll, isEmpty && styles.scrollEmpty]}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      stickyHeaderIndices={[0]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          tintColor={colors.text.tertiary}
        />
      }
    >
      {/* sticky slot — always renders so index 0 is stable; pill is conditional */}
      <View style={styles.pillSlot} pointerEvents="box-none">
        {showPill ? (
          <NewEventsPill count={pending.length} onTap={promotePending} />
        ) : null}
      </View>

      {loading ? (
        <HomeSkeleton />
      ) : isEmpty ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon={<Bookmark size={28} color={colors.text.tertiary} strokeWidth={1.5} />}
            title="Nothing on your radar yet"
            description="Add a ticker in Watchlist to see upcoming earnings and live filings here."
          />
        </View>
      ) : (
        <>
          {live.length > 0 ? (
            <Section label="LIVE NOW">
              {live.map((e) => (
                <View key={e.ticker} style={styles.cardWrap}>
                  <EventCard {...e} onPress={() => openEvent(e.ticker)} />
                </View>
              ))}
            </Section>
          ) : null}

          {upcoming.length > 0 ? (
            <Section label="UPCOMING" first={live.length === 0}>
              {upcoming.map((e) => (
                <View key={e.ticker} style={styles.cardWrap}>
                  <EarningsCard {...e} onPress={() => openTicker(e.ticker)} />
                </View>
              ))}
            </Section>
          ) : null}

          {recent.length > 0 ? (
            <Section label="RECENT">
              {recent.map((e) => (
                <View key={e.ticker} style={styles.cardWrap}>
                  <EventCard {...e} onPress={() => openEvent(e.ticker)} />
                </View>
              ))}
            </Section>
          ) : null}

          <DisclaimerFooter />
        </>
      )}
    </ScrollView>
  );
}

function Section({ label, first, children }) {
  const isLive = label === 'LIVE NOW';
  return (
    <View style={[styles.section, first && styles.sectionFirst]}>
      <View style={styles.sectionLabelRow}>
        {isLive ? <View style={styles.liveDot} /> : null}
        <Text style={[styles.sectionLabel, isLive && styles.sectionLabelLive]}>{label}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  scroll: {
    paddingHorizontal: space[4],
    paddingBottom: space[8],
  },
  scrollEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyWrap: { minHeight: 400 },
  pillSlot: {
    // transparent sticky container; collapses to 0-height when no pill
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  section: {
    marginTop: space[5],
  },
  sectionFirst: {
    marginTop: space[2],
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: space[3],
  },
  sectionLabel: {
    ...text.micro,
    color: colors.text.tertiary,
    letterSpacing: 0.5,
  },
  sectionLabelLive: {
    color: colors.signal.negative,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.signal.negative,
  },
  cardWrap: {
    marginBottom: space[3],
  },
});
