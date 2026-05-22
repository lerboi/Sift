import { useRef, useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Bookmark, Trash2, Plus } from 'lucide-react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Card } from '../../components/card';
import { EmptyState } from '../../components/empty-state';
import { colors, space, radius, text } from '../../theme';
import { haptics } from '../../lib/haptics';
import { MOCK_WATCHLIST, groupByWeek } from './mock';
import { WatchlistRow } from './watchlist-row';
import { AddTickerSheet } from './add-ticker-sheet';
import { TICKER_CATALOG } from './ticker-catalog';

export default function WatchlistScreen() {
  const router = useRouter();
  const [items, setItems] = useState(MOCK_WATCHLIST);
  const addSheet = useRef(null);

  const remove = (symbol) => {
    haptics.warning();
    setItems((cur) => cur.filter((i) => i.symbol !== symbol));
  };

  const add = (symbol) => {
    const entry = TICKER_CATALOG.find((t) => t.symbol === symbol);
    if (!entry) return;
    // mock — real flow seeds from supabase. days/period filled with placeholders.
    setItems((cur) => [
      {
        symbol: entry.symbol,
        name: entry.name,
        nextEarnings: { period: 'Q? 26', date: '—', daysAway: 99 },
        sparkline: [100, 100, 100, 100, 100],
        briefingReady: false,
        trend: 'flat',
      },
      ...cur,
    ]);
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

  if (items.length === 0) {
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
        <AddTickerSheet ref={addSheet} onAdd={add} excludeSymbols={items.map((i) => i.symbol)} />
      </>
    );
  }

  const groups = groupByWeek(items);

  return (
    <>
      <Stack.Screen options={screenOptions} />
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.scroll}
        contentInsetAdjustmentBehavior="automatic"
      >
        {groups.map((g) => (
          <View key={g.label} style={styles.group}>
            <Text style={styles.label}>{g.label}</Text>
            <Card padding={0} style={styles.card}>
              {g.items.map((item, i) => (
                <SwipeableRow key={item.symbol} onRemove={() => remove(item.symbol)}>
                  <WatchlistRow
                    {...item}
                    onPress={() => openTicker(item.symbol)}
                    last={i === g.items.length - 1}
                  />
                </SwipeableRow>
              ))}
            </Card>
          </View>
        ))}
      </ScrollView>
      <AddTickerSheet ref={addSheet} onAdd={add} excludeSymbols={items.map((i) => i.symbol)} />
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
  group: { marginBottom: space[5] },
  label: {
    ...text.micro,
    color: colors.text.tertiary,
    letterSpacing: 0.5,
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
