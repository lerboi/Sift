import { useEffect, useState } from 'react';
import { ScrollView, View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Search, X, ChevronRight } from 'lucide-react-native';
import { Card } from '../../components/card';
import { MonoNumber } from '../../components/mono-number';
import { DisclaimerFooter } from '../../components/disclaimer-footer';
import { searchTickers } from '../watchlist/ticker-catalog';
import { supabase } from '../../../lib/supabase';
import { colors, space, radius, text } from '../../theme';
import { haptics } from '../../lib/haptics';
import { formatDayHeader, formatEventTime } from '../../lib/dates';

const SEARCH_DEBOUNCE_MS = 140;

// 'Q1-2026' (sortable, server) → 'Q1 26' (display, client)
function formatFiscalPeriod(p) {
  if (!p) return '';
  const m = String(p).match(/^(Q[1-4])-(\d{4})$/);
  if (!m) return p;
  return `${m[1]} ${m[2].slice(-2)}`;
}

function shapeExpected(row) {
  return {
    ticker: row.ticker_symbol,
    name: row.ticker_name,
    period: formatFiscalPeriod(row.fiscal_period),
    expectedAt: row.expected_release_at,
    beatProb: Number(row.beat_probability ?? 0),
    expectedMovePct: Number(row.expected_move_pct ?? 0),
  };
}

function shapeSurprise(row) {
  return {
    id: row.event_id,
    ticker: row.ticker_symbol,
    name: row.ticker_name,
    period: formatFiscalPeriod(row.fiscal_period),
    actualAt: row.actual_at,
    surprisePct: Number(row.surprise_pct ?? 0),
  };
}

export default function DiscoverScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState([]);
  const [biggestExpected, setBiggestExpected] = useState([]);
  const [sectorHeat, setSectorHeat] = useState([]);
  const [biggestSurprises, setBiggestSurprises] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [expectedRes, sectorRes, surpriseRes] = await Promise.all([
        supabase.rpc('discover_biggest_expected', { p_limit: 4 }),
        supabase.rpc('discover_sector_heat'),
        supabase.rpc('discover_biggest_surprises', { p_days: 7, p_limit: 4 }),
      ]);
      if (cancelled) return;
      if (expectedRes.error && __DEV__) console.warn('[discover] expected', expectedRes.error.message);
      if (sectorRes.error && __DEV__) console.warn('[discover] sector_heat', sectorRes.error.message);
      if (surpriseRes.error && __DEV__) console.warn('[discover] surprises', surpriseRes.error.message);
      setBiggestExpected((expectedRes.data ?? []).map(shapeExpected));
      setSectorHeat((sectorRes.data ?? []).map((r) => ({ sector: r.sector, reporting: Number(r.reporting) })));
      setBiggestSurprises((surpriseRes.data ?? []).map(shapeSurprise));
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setMatches([]);
      return undefined;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      const data = await searchTickers(trimmed, [], 8);
      if (!cancelled) setMatches(data);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const openTicker = (symbol) => {
    haptics.tap();
    router.push(`/watchlist/${symbol}`);
  };
  const openEvent = (id) => {
    haptics.tap();
    router.push(`/discover/events/${id}`);
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.scroll}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.searchRow}>
        <Search size={16} color={colors.text.tertiary} strokeWidth={1.75} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search any ticker"
          placeholderTextColor={colors.text.tertiary}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
            <X size={16} color={colors.text.tertiary} strokeWidth={1.75} />
          </Pressable>
        ) : null}
      </View>

      {matches.length > 0 ? (
        <Card padding={0} style={styles.card}>
          {matches.map((m, i) => (
            <Pressable
              key={m.symbol}
              onPress={() => openTicker(m.symbol)}
              accessibilityRole="button"
              accessibilityLabel={`Open ${m.symbol}, ${m.name}`}
              style={({ pressed }) => [
                styles.searchRowResult,
                i !== matches.length - 1 && styles.divider,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.resultSym}>{m.symbol}</Text>
              <Text style={styles.resultName} numberOfLines={1}>{m.name}</Text>
              <ChevronRight size={14} color={colors.text.tertiary} strokeWidth={1.75} />
            </Pressable>
          ))}
        </Card>
      ) : null}

      {/* compliance: "Model" prefix + "expected" qualifier — no advisory verbs */}
      <SectionLabel>MODEL — BIGGEST EXPECTED MOVES THIS WEEK</SectionLabel>
      <Card padding={0} style={styles.card}>
        {biggestExpected.length === 0 ? (
          <Text style={styles.emptyRail}>No expected reports this week.</Text>
        ) : biggestExpected.map((e, i) => (
          <Pressable
            key={`${e.ticker}-${e.period}`}
            onPress={() => openTicker(e.ticker)}
            accessibilityRole="button"
            accessibilityLabel={`${e.ticker} ${e.name}, reports ${formatDayHeader(e.expectedAt).absolute}, model beat probability ${Math.round(e.beatProb * 100)} percent, expected move ${(e.expectedMovePct * 100).toFixed(1)} percent`}
            style={({ pressed }) => [
              styles.expectedRow,
              i !== biggestExpected.length - 1 && styles.divider,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.expectedTop}>
              <Text style={styles.symInline}>{e.ticker}</Text>
              <Text style={styles.periodInline}>{e.period}</Text>
              <View style={styles.spacer} />
              <Text style={styles.whenInline}>{whenLabel(e.expectedAt)}</Text>
            </View>
            <View style={styles.expectedBottom}>
              <Text style={styles.metricLabel}>Model beat </Text>
              <MonoNumber value={`${Math.round(e.beatProb * 100)}%`} size="subhead" color={colors.text.primary} />
              <Text style={styles.sep}>  ·  </Text>
              <Text style={styles.metricLabel}>±</Text>
              <MonoNumber value={`${(e.expectedMovePct * 100).toFixed(1)}%`} size="subhead" color={colors.text.primary} />
              <Text style={styles.metricLabel}> expected</Text>
            </View>
          </Pressable>
        ))}
      </Card>

      <SectionLabel>REPORTING THIS WEEK BY SECTOR</SectionLabel>
      <Card padding={0} style={styles.card}>
        {sectorHeat.length === 0 ? (
          <Text style={styles.emptyRail}>No sector reports scheduled this week.</Text>
        ) : sectorHeat.map((s, i) => (
          <View
            key={s.sector}
            accessibilityRole="text"
            accessibilityLabel={`${s.sector}, ${s.reporting} companies reporting`}
            style={[
              styles.sectorRow,
              i !== sectorHeat.length - 1 && styles.divider,
            ]}
          >
            <Text style={styles.sectorName}>{s.sector}</Text>
            <View style={styles.spacer} />
            <MonoNumber value={String(s.reporting)} size="subhead" color={colors.text.secondary} />
          </View>
        ))}
      </Card>

      <SectionLabel>BIGGEST RECENT SURPRISES — MARKET</SectionLabel>
      <Card padding={0} style={styles.card}>
        {biggestSurprises.length === 0 ? (
          <Text style={styles.emptyRail}>No recent surprises to surface.</Text>
        ) : biggestSurprises.map((e, i) => {
          const beat = e.surprisePct > 0;
          const color = beat ? colors.signal.positive : colors.signal.negative;
          const arrow = beat ? '▲' : '▼';
          const sign = beat ? '+' : '';
          return (
            <Pressable
              key={e.id}
              onPress={() => openEvent(e.id)}
              accessibilityRole="button"
              accessibilityLabel={`${e.ticker} ${e.name}, ${e.period}, ${(e.surprisePct * 100).toFixed(1)} percent ${beat ? 'beat' : 'miss'}`}
              style={({ pressed }) => [
                styles.surpriseRow,
                i !== biggestSurprises.length - 1 && styles.divider,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.surpriseLeft}>
                <Text style={styles.symInline}>{e.ticker}</Text>
                <Text style={styles.periodInline}>{e.period}</Text>
              </View>
              <View style={styles.spacer} />
              <Text style={[styles.arrow, { color }]}>{arrow}</Text>
              <MonoNumber value={`${sign}${(e.surprisePct * 100).toFixed(1)}%`} size="subhead" color={color} />
              <Text style={[styles.outcomeQual, { color }]}> {beat ? 'beat' : 'miss'}</Text>
            </Pressable>
          );
        })}
      </Card>

      <Text style={styles.complianceLine}>
        Model predictions are educational. Sift does not provide investment advice.
      </Text>
      <DisclaimerFooter />
    </ScrollView>
  );
}

function SectionLabel({ children }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

// "TUE MAY 26 · 4:00 PM ET" — compact one-liner for upcoming rows
function whenLabel(iso) {
  const dh = formatDayHeader(iso);
  return `${dh.weekday} ${dh.absolute} · ${formatEventTime(iso)}`;
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

  card: { overflow: 'hidden', marginTop: space[3] },

  sectionLabel: {
    ...text.micro,
    color: colors.text.tertiary,
    letterSpacing: 0.6,
    marginTop: space[5],
    marginBottom: space[1],
    paddingHorizontal: space[2],
  },

  divider: {
    borderBottomColor: colors.border.subtle,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pressed: { backgroundColor: colors.bg.elevated },

  searchRowResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  resultSym: { ...text.headlineMono, color: colors.text.primary, minWidth: 56 },
  resultName: { ...text.subhead, color: colors.text.secondary, flex: 1 },

  expectedRow: {
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  expectedTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space[2],
  },
  expectedBottom: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
  },
  emptyRail: {
    ...text.footnote,
    color: colors.text.tertiary,
    textAlign: 'center',
    paddingVertical: space[4],
    paddingHorizontal: space[4],
  },

  symInline: { ...text.headlineMono, color: colors.text.primary },
  periodInline: { ...text.subhead, color: colors.text.secondary },
  whenInline: { ...text.footnote, color: colors.text.tertiary },
  spacer: { flex: 1 },
  metricLabel: { ...text.subhead, color: colors.text.secondary },
  sep: { ...text.subhead, color: colors.text.tertiary },

  sectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  sectorName: { ...text.body, color: colors.text.primary },

  surpriseRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space[2],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  surpriseLeft: { flexDirection: 'row', alignItems: 'baseline', gap: space[2] },
  arrow: { ...text.headlineMono, marginRight: 2 },
  outcomeQual: { ...text.subhead },

  complianceLine: {
    ...text.footnote,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: space[5],
    paddingHorizontal: space[4],
  },
});
