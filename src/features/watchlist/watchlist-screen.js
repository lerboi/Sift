import { useMemo, useRef, useState } from 'react';
import { ScrollView, View, Pressable, Text, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Bookmark, Trash2, Plus } from 'lucide-react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Card } from '../../components/card';
import { EmptyState } from '../../components/empty-state';
import { SortSelector } from '../../components/sort-selector';
import { InlineError } from '../../components/inline-error';
import { colors, space, text } from '../../theme';
import { haptics } from '../../lib/haptics';
import { WatchlistRow } from './watchlist-row';
import { AddTickerSheet } from './add-ticker-sheet';
import { useWatchlist } from './use-watchlist';

const SORT_OPTIONS = [
  { value: 'date',   label: 'Next earnings' },
  { value: 'alpha',  label: 'Alphabetical' },
  { value: 'recent', label: 'Recently added' },
];

function applySort(items, key) {
  if (key === 'alpha') return [...items].sort((a, b) => a.symbol.localeCompare(b.symbol));
  if (key === 'date')  return [...items].sort((a, b) => a.nextEarnings.daysAway - b.nextEarnings.daysAway);
  return items;
}

export default function WatchlistScreen() {
  const router = useRouter();
  const { items, loading, error, add, remove, refresh } = useWatchlist();
  const [sortKey, setSortKey] = useState('date');
  const addSheet = useRef(null);

  const sorted = useMemo(() => applySort(items, sortKey), [items, sortKey]);

  const onAdd = (symbol) => add(symbol);
  const onRemove = (symbol) => {
    haptics.warning();
    remove(symbol);
  };

  const openSheet = () => {
    haptics.tap();
    addSheet.current?.expand();
  };

  const openTicker = (symbol) => router.push(`/watchlist/${symbol}`);

  const screenOptions = {
    headerRight: () => (
      <Pressable
        onPress={openSheet}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Add ticker"
        style={({ pressed }) => pressed && { opacity: 0.6 }}
      >
        <Plus size={22} color={colors.accent.default} strokeWidth={2} />
      </Pressable>
    ),
  };

  if (error) {
    return (
      <>
        <Stack.Screen options={screenOptions} />
        <ScrollView
          style={styles.root}
          contentContainerStyle={styles.scrollEmpty}
          contentInsetAdjustmentBehavior="automatic"
        >
          <InlineError
            title="Couldn't load your watchlist"
            message={error.message}
            onRetry={refresh}
          />
        </ScrollView>
      </>
    );
  }

  if (!loading && items.length === 0) {
    return (
      <>
        <Stack.Screen options={screenOptions} />
        <ScrollView
          style={styles.root}
          contentContainerStyle={styles.scrollEmpty}
          contentInsetAdjustmentBehavior="automatic"
        >
          <EmptyState
            icon={<Bookmark size={28} color={colors.text.tertiary} strokeWidth={1.5} />}
            title="No tickers tracked yet"
            description="Add tickers to see upcoming earnings and 8-K filings on your home feed."
            cta={{ label: 'Add ticker', onPress: openSheet }}
          />
        </ScrollView>
        <AddTickerSheet ref={addSheet} onAdd={onAdd} excludeSymbols={items.map((i) => i.symbol)} />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={screenOptions} />
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.scroll}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.sortRow}>
          <SortSelector options={SORT_OPTIONS} value={sortKey} onChange={setSortKey} />
        </View>

        <Card padding={0} style={styles.card}>
          {sorted.map((item, i) => (
            <SwipeableRow key={item.symbol} onRemove={() => onRemove(item.symbol)}>
              <WatchlistRow
                {...item}
                onPress={() => openTicker(item.symbol)}
                last={i === sorted.length - 1}
              />
            </SwipeableRow>
          ))}
        </Card>
      </ScrollView>
      <AddTickerSheet ref={addSheet} onAdd={onAdd} excludeSymbols={items.map((i) => i.symbol)} />
    </>
  );
}

function SwipeableRow({ children, onRemove }) {
  const ref = useRef(null);
  const renderRight = () => (
    <Pressable
      onPress={() => {
        onRemove();
        ref.current?.close();
      }}
      accessibilityRole="button"
      accessibilityLabel="Remove from watchlist"
      style={styles.removeAction}
    >
      <Trash2 size={20} color={colors.accent.on} strokeWidth={1.75} />
      <Text style={styles.removeText}>Remove</Text>
    </Pressable>
  );
  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={2}
      rightThreshold={40}
      renderRightActions={renderRight}
      overshootRight={false}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  scroll: { padding: space[4], paddingBottom: space[8] },
  scrollEmpty: { flexGrow: 1, justifyContent: 'center' },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: space[3],
    paddingHorizontal: space[2],
  },
  card: { overflow: 'hidden' },
  removeAction: {
    width: 96,
    backgroundColor: colors.signal.negative,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  removeText: {
    ...text.caption,
    color: colors.accent.on,
    fontFamily: 'Inter_500Medium',
  },
});
