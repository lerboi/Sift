import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { formatDayHeader } from '../../lib/dates';
import { useWatchedBriefingsStream } from '../../lib/realtime/use-watched-briefings-stream';

// sparkline is fetched per-row inside WatchlistRow via useSparkline (B4).
// shape() no longer carries it on the row.

function shape(row, { now = new Date() } = {}) {
  const hasNext = !!row.next_expected_at;
  const period = row.next_fiscal_period || 'Q? 26';
  if (!hasNext) {
    return {
      symbol: row.symbol,
      name: row.name || row.symbol,
      sector: row.sector,
      nextEarnings: { period, date: '—', daysAway: 9999 },
      briefingReady: false,
      trend: 'flat',
    };
  }
  const d = new Date(row.next_expected_at);
  const diff = Math.max(0, Math.round((d - now) / 86400000));
  return {
    symbol: row.symbol,
    name: row.name || row.symbol,
    sector: row.sector,
    nextEarnings: {
      period,
      date: formatDayHeader(d.toISOString(), { now }).absolute,
      daysAway: diff,
    },
    briefingReady: !!row.briefing_ready,
    trend: 'flat',
  };
}

export function useWatchlist() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [watchlistId, setWatchlistId] = useState(null);

  const refresh = useCallback(async () => {
    setError(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData?.session?.user?.id;
    if (!uid) {
      setItems([]);
      setLoading(false);
      return;
    }

    const [{ data: wl, error: wlError }, { data: rows, error: rowsError }] = await Promise.all([
      supabase
        .from('watchlists')
        .select('id')
        .eq('user_id', uid)
        .eq('is_default', true)
        .maybeSingle(),
      supabase
        .from('watchlist_with_meta_view')
        .select('symbol, name, sector, added_at, sort_order, next_fiscal_period, next_expected_at, next_beat_probability, briefing_ready'),
    ]);

    if (wlError && __DEV__) console.warn('[useWatchlist] default lookup', wlError.message);
    if (rowsError && __DEV__) console.warn('[useWatchlist] view fetch', rowsError.message);

    if (rowsError && !rowsError.message?.includes('not exist')) {
      setError({ message: rowsError.message, code: rowsError.code });
    }

    setWatchlistId(wl?.id ?? null);
    setItems((rows ?? []).map((r) => shape(r)));
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const { data: sub } = supabase.auth.onAuthStateChange(() => refresh());
    return () => sub?.subscription?.unsubscribe?.();
  }, [refresh]);

  const add = useCallback(async (symbol) => {
    const sym = String(symbol).toUpperCase();
    if (!watchlistId) return;
    setItems((cur) => {
      if (cur.some((i) => i.symbol === sym)) return cur;
      return [
        {
          symbol: sym,
          name: sym,
          sector: null,
          nextEarnings: { period: 'Q? 26', date: '—', daysAway: 9999 },
          briefingReady: false,
          trend: 'flat',
        },
        ...cur,
      ];
    });
    const { error: insertError } = await supabase
      .from('watchlist_tickers')
      .insert({ watchlist_id: watchlistId, ticker_symbol: sym });
    if (insertError) {
      if (__DEV__) console.warn('[useWatchlist] add failed', insertError.message);
      setItems((cur) => cur.filter((i) => i.symbol !== sym));
      return;
    }
    refresh();
  }, [watchlistId, refresh]);

  const remove = useCallback(async (symbol) => {
    const sym = String(symbol).toUpperCase();
    if (!watchlistId) return;
    const previous = items;
    setItems((cur) => cur.filter((i) => i.symbol !== sym));
    const { error: deleteError } = await supabase
      .from('watchlist_tickers')
      .delete()
      .eq('watchlist_id', watchlistId)
      .eq('ticker_symbol', sym);
    if (deleteError) {
      if (__DEV__) console.warn('[useWatchlist] remove failed', deleteError.message);
      setItems(previous);
    }
  }, [watchlistId, items]);

  // realtime: re-fetch when any watched ticker's briefing flips to ready.
  // cheap re-render at MVP watchlist sizes (≤50 tickers).
  const symbols = useMemo(() => items.map((i) => i.symbol), [items]);
  useWatchedBriefingsStream(symbols, refresh);

  return { items, loading, error, add, remove, watchlistId, refresh };
}
