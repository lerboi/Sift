import { useMemo, useState } from 'react';
import { ScrollView, View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Activity, Search, X } from 'lucide-react-native';
import { EventCard } from '../../components/event-card';
import { EmptyState } from '../../components/empty-state';
import { FilterChip } from '../../components/filter-chip';
import { colors, space, radius, text } from '../../theme';
import { MOCK_EVENTS, filterEvents, groupByDate } from './mock';

const SCOPES = [
  { value: 'all',       label: 'All' },
  { value: 'watchlist', label: 'Watchlist' },
];

const OUTCOMES = [
  { value: 'all',    label: 'All outcomes' },
  { value: 'beat',   label: 'Beats' },
  { value: 'miss',   label: 'Misses' },
  { value: 'inline', label: 'In line' },
];

export default function EventsScreen() {
  const router = useRouter();
  const [scope, setScope] = useState('all');
  const [outcome, setOutcome] = useState('all');
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const filtered = filterEvents(MOCK_EVENTS, scope, outcome, query);
    return groupByDate(filtered);
  }, [scope, outcome, query]);

  const openEvent = (id) => router.push(`/events/${id}`);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.scroll}
      contentInsetAdjustmentBehavior="automatic"
    >
      <View style={styles.searchRow}>
        <Search size={16} color={colors.text.tertiary} strokeWidth={1.75} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search ticker"
          placeholderTextColor={colors.text.tertiary}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 ? (
          <Pressable
            onPress={() => setQuery('')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <X size={16} color={colors.text.tertiary} strokeWidth={1.75} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.filterRow}>
        {SCOPES.map((s) => (
          <FilterChip
            key={s.value}
            label={s.label}
            selected={scope === s.value}
            onPress={() => setScope(s.value)}
          />
        ))}
        <View style={styles.divider} />
        {OUTCOMES.map((o) => (
          <FilterChip
            key={o.value}
            label={o.label}
            selected={outcome === o.value}
            onPress={() => setOutcome(o.value)}
          />
        ))}
      </View>

      {groups.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon={<Activity size={28} color={colors.text.tertiary} strokeWidth={1.5} />}
            title="No events match"
            description="Try a broader filter — switch back to All outcomes, or expand the scope from Watchlist to All."
          />
        </View>
      ) : (
        groups.map((g) => (
          <View key={g.label} style={styles.group}>
            <Text style={styles.dateLabel}>{g.label}</Text>
            {g.items.map((e) => (
              <View key={e.id} style={styles.cardWrap}>
                <EventCard
                  ticker={e.ticker}
                  period={e.period}
                  when={e.when}
                  epsActual={e.epsActual}
                  epsEst={e.epsEst}
                  surprisePct={e.surprisePct}
                  onPress={() => openEvent(e.id)}
                />
              </View>
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  scroll: { paddingHorizontal: space[4], paddingBottom: space[8] },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    backgroundColor: colors.bg.surface,
    borderColor: colors.border.subtle,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    marginTop: space[3],
  },
  searchInput: {
    ...text.body,
    color: colors.text.primary,
    flex: 1,
    padding: 0,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
    paddingVertical: space[3],
  },
  divider: {
    width: 1,
    backgroundColor: colors.border.subtle,
    marginHorizontal: space[1],
  },
  group: { marginTop: space[4] },
  dateLabel: {
    ...text.micro,
    color: colors.text.tertiary,
    letterSpacing: 0.5,
    marginBottom: space[3],
  },
  cardWrap: { marginBottom: space[3] },
  emptyWrap: { minHeight: 360, justifyContent: 'center' },
});
