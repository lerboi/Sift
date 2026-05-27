import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { subscribeToNotifications } from '../../lib/realtime/notifications-bus';
import { useWatchedBriefingsStream } from '../../lib/realtime/use-watched-briefings-stream';

function formatFiscalPeriod(p) {
  if (!p) return '';
  const m = String(p).match(/^(Q[1-4])-(\d{4})$/);
  if (!m) return p;
  return `${m[1]} ${m[2].slice(-2)}`;
}

function shape(row) {
  const obj = {
    state: row.state,
    ticker: row.ticker_symbol,
    name: row.ticker_name,
    period: formatFiscalPeriod(row.fiscal_period),
    expectedAt: row.expected_at,
    actualAt: row.actual_at,
    referenceId: row.reference_id,
  };
  if (row.state === 'upcoming') {
    obj.epsEst = row.eps_est !== null ? Number(row.eps_est) : null;
    obj.beatProb = row.beat_probability !== null ? Number(row.beat_probability) : null;
    obj.briefingReady = !!row.briefing_ready;
  } else {
    obj.epsActual = row.eps_actual !== null ? Number(row.eps_actual) : null;
    obj.epsEst = row.eps_est !== null ? Number(row.eps_est) : null;
    obj.surprisePct = row.surprise_pct !== null ? Number(row.surprise_pct) : 0;
  }
  return obj;
}

export function useHomeData() {
  const [state, setState] = useState({
    events: [],
    loading: true,
    refreshing: false,
    error: null,
  });
  const [pending, setPending] = useState([]);

  const fetchOnce = useCallback(async (kind) => {
    setState((s) => ({
      ...s,
      ...(kind === 'refresh' ? { refreshing: true } : { loading: true }),
      error: null,
    }));

    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData?.session?.user?.id;
    if (!uid) {
      setState({ events: [], loading: false, refreshing: false, error: null });
      return;
    }

    const { data, error } = await supabase.rpc('home_events_for_user', { p_user_id: uid });
    if (error) {
      if (__DEV__) console.warn('[useHomeData] rpc failed', error.message);
      setState({
        events: [],
        loading: false,
        refreshing: false,
        error: { message: error.message, code: error.code },
      });
      return;
    }

    setState({
      events: (data ?? []).map(shape),
      loading: false,
      refreshing: false,
      error: null,
    });
  }, []);

  useEffect(() => {
    fetchOnce('initial');
    const { data: sub } = supabase.auth.onAuthStateChange(() => fetchOnce('initial'));
    return () => sub?.subscription?.unsubscribe?.();
  }, [fetchOnce]);

  const refresh = useCallback(() => fetchOnce('refresh'), [fetchOnce]);

  // realtime: notifications bus pushes a token into pending so the new-events
  // pill arms. token shape is intentionally minimal — only what NewEventsPill
  // reads via .length and what promotePending needs to fire a refresh. we do
  // NOT shape these into renderable EventTimelineCard rows, because the cards
  // need full metric fields that aren't on a notification row (epsActual etc).
  useEffect(() => {
    return subscribeToNotifications((row) => {
      setPending((cur) => [
        { id: row.id, ticker: row.ticker_symbol, ts: row.created_at },
        ...cur,
      ]);
    });
  }, []);

  // realtime: briefings becoming ready for watched tickers → re-fetch.
  // simpler than mutating events in place; sub-second re-render at MVP scale.
  const watchedSymbols = useMemo(
    () => Array.from(new Set(state.events.map((e) => e.ticker))).filter(Boolean),
    [state.events],
  );
  useWatchedBriefingsStream(watchedSymbols, () => fetchOnce('refresh'));

  // promote: clear the pending pill, then re-fetch the real RPC so the new
  // rows land with full metric fields. (we don't splice the synth tokens into
  // events — they don't carry the metrics EventTimelineCard requires.)
  const promotePending = useCallback(() => {
    setPending([]);
    fetchOnce('refresh');
  }, [fetchOnce]);

  return { ...state, pending, refresh, promotePending };
}
