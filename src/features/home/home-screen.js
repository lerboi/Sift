import { useEffect, useMemo } from 'react';
import { ScrollView, View, StyleSheet, RefreshControl } from 'react-native';
import { Bookmark } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { DayHeader } from '../../components/day-header';
import { EventTimelineCard } from '../../components/event-timeline-card';
import { DisclaimerFooter } from '../../components/disclaimer-footer';
import { EmptyState } from '../../components/empty-state';
import { InlineError } from '../../components/inline-error';
import { NewEventsPill } from '../../components/new-events-pill';
import { haptics } from '../../lib/haptics';
import { groupByDay } from '../../lib/dates';
import { colors, space } from '../../theme';
import { useHomeData } from './use-home-data';
import { HomeSkeleton } from './home-skeleton';

export default function HomeScreen() {
  const router = useRouter();
  const { events, loading, refreshing, refresh, pending, promotePending, error } = useHomeData();

  // fire a light haptic exactly when a new event lands while user is on screen
  useEffect(() => {
    if (pending.length > 0) haptics.tap();
  }, [pending.length]);

  const groups = useMemo(() => groupByDay(events), [events]);

  const openTicker = (ticker) => router.push(`/watchlist/${ticker}`);
  // tab-scoped so Today stays highlighted on drill (p11-8)
  const openEvent = (ticker) => router.push(`/today/events/${ticker}`);

  const isEmpty = !loading && events.length === 0;
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
      <View style={styles.pillSlot} pointerEvents="box-none">
        {showPill ? <NewEventsPill count={pending.length} onTap={promotePending} /> : null}
      </View>

      {error ? (
        <View style={styles.errorWrap}>
          <InlineError message={error.message ?? 'Could not load events.'} code={error.code} onRetry={refresh} />
        </View>
      ) : null}

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
          {groups.map((g) => (
            <View key={g.dateISO} style={styles.group}>
              <DayHeader iso={isoFromGroup(g)} />
              {g.items.map((e) => {
                const primary = () => (e.state === 'upcoming' ? openTicker(e.ticker) : openEvent(e.ticker));
                return (
                  <View key={`${e.ticker}-${e.period}`} style={styles.cardWrap}>
                    <EventTimelineCard
                      {...e}
                      onPress={primary}
                      onOpenDetail={() => openEvent(e.ticker)}
                      onBriefingPress={primary}
                    />
                  </View>
                );
              })}
            </View>
          ))}
          <DisclaimerFooter />
        </>
      )}
    </ScrollView>
  );
}

// groupByDay strips _date but keeps dateISO ("YYYY-MM-DD"). DayHeader wants ISO
// with a time component so new Date() parses it consistently — append midday.
function isoFromGroup(g) {
  return `${g.dateISO}T12:00:00`;
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
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  errorWrap: { marginTop: space[3] },
  group: {
    marginTop: space[5],
  },
  cardWrap: {
    marginBottom: space[3],
  },
});
