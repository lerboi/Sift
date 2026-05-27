import { forwardRef, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetTextInput, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { Search } from 'lucide-react-native';
import { colors, space, radius, text } from '../../theme';
import { haptics } from '../../lib/haptics';
import { searchTickers } from './ticker-catalog';

const SNAP = ['75%'];
const DEBOUNCE_MS = 120;

export const AddTickerSheet = forwardRef(function AddTickerSheet(
  { onAdd, excludeSymbols = [] },
  ref,
) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const data = await searchTickers(query, excludeSymbols, 12);
      if (!cancelled) setResults(data);
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, excludeSymbols]);

  const handleAdd = (symbol) => {
    haptics.success();
    onAdd?.(symbol);
    setQuery('');
    ref?.current?.close?.();
  };

  return (
    <BottomSheet
      ref={ref}
      index={-1}
      snapPoints={SNAP}
      enablePanDownToClose
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
      backdropComponent={(props) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.6} />
      )}
    >
      <BottomSheetView style={styles.content}>
        <Text style={styles.title}>Add ticker</Text>

        <View style={styles.searchRow}>
          <Search size={18} color={colors.text.tertiary} strokeWidth={1.75} />
          <BottomSheetTextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Search symbol or name"
            placeholderTextColor={colors.text.tertiary}
            autoCapitalize="characters"
            autoCorrect={false}
          />
        </View>

        <View style={styles.list}>
          {results.length === 0 ? (
            <Text style={styles.noResults}>No matches for &ldquo;{query}&rdquo;. Try a symbol like AAPL.</Text>
          ) : (
            results.map((t, i) => (
              <Pressable
                key={t.symbol}
                onPress={() => handleAdd(t.symbol)}
                accessibilityRole="button"
                accessibilityLabel={`Add ${t.symbol}, ${t.name}`}
                style={({ pressed }) => [
                  styles.resultRow,
                  i !== results.length - 1 && styles.divider,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.symbol}>{t.symbol}</Text>
                <Text style={styles.name} numberOfLines={1}>{t.name}</Text>
              </Pressable>
            ))
          )}
        </View>
      </BottomSheetView>
    </BottomSheet>
  );
});

const styles = StyleSheet.create({
  sheetBg: {
    backgroundColor: colors.bg.elevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  handle: { backgroundColor: colors.border.strong, width: 36, height: 4 },
  content: { flex: 1, paddingHorizontal: space[5], paddingTop: space[3] },
  title: { ...text.title, color: colors.text.primary, marginBottom: space[4] },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    backgroundColor: colors.bg.inset,
    borderColor: colors.border.subtle,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  input: {
    ...text.body,
    color: colors.text.primary,
    flex: 1,
    padding: 0,
  },
  list: { marginTop: space[4] },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingVertical: space[3],
    gap: space[3],
  },
  divider: {
    borderBottomColor: colors.border.subtle,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pressed: { opacity: 0.6 },
  symbol: { ...text.headlineMono, color: colors.text.primary, width: 72 },
  name: { ...text.subhead, color: colors.text.secondary, flex: 1 },
  noResults: {
    ...text.subhead,
    color: colors.text.tertiary,
    paddingVertical: space[4],
    textAlign: 'center',
  },
});
