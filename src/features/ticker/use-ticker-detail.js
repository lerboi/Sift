import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useTickerEventsStream } from '../../lib/realtime/use-ticker-events-stream';

function formatFiscalPeriod(p) {
  if (!p) return '';
  const m = String(p).match(/^(Q[1-4])-(\d{4})$/);
  if (!m) return p;
  return `${m[1]} ${m[2].slice(-2)}`;
}

function fmtCardDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function shapeTimelineRow(row) {
  const p = row.payload || {};
  const period = formatFiscalPeriod(p.fiscal_period);

  if (row.kind === 'earnings-upcoming') {
    return {
      id: row.item_id,
      kind: row.kind,
      occurredAt: row.occurred_at,
      payload: {
        fiscal_period: p.fiscal_period,
        period,
        expectedAt: p.expected_release_at,
        epsEst: p.consensus_eps !== null ? Number(p.consensus_eps) : null,
        beatProb: p.beat_probability !== null ? Number(p.beat_probability) : null,
      },
    };
  }
  if (row.kind === 'earnings-past') {
    return {
      id: row.item_id,
      kind: row.kind,
      occurredAt: row.occurred_at,
      payload: {
        period,
        expectedAt: p.expected_at,
        actualAt: p.actual_at,
        epsActual: p.eps_actual !== null ? Number(p.eps_actual) : null,
        epsEst: p.eps_est !== null ? Number(p.eps_est) : null,
        surprisePct: p.surprise_pct !== null ? Number(p.surprise_pct) : 0,
      },
    };
  }
  if (row.kind === 'briefing') {
    return {
      id: row.item_id,
      kind: row.kind,
      occurredAt: row.occurred_at,
      payload: {
        title: p.title || `Briefing — ${period}`,
        date: fmtCardDate(p.generated_at || row.occurred_at),
        content: p.content_md || '',
      },
    };
  }
  if (row.kind === 'transcript') {
    return {
      id: row.item_id,
      kind: row.kind,
      occurredAt: row.occurred_at,
      payload: {
        period: `${period} call`,
        date: fmtCardDate(p.call_date),
        tone: p.tone || 'neutral',
        novelTopics: Array.isArray(p.novel_topics) ? p.novel_topics : [],
        snippet: p.summary_md || '',
      },
    };
  }
  return null;
}

export function useTickerDetail(symbol) {
  const sym = String(symbol || '').toUpperCase();
  const [meta, setMeta] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [watchlistId, setWatchlistId] = useState(null);
  const [onWatchlist, setOnWatchlist] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!sym) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData?.session?.user?.id;

    const [tickerRes, timelineRes, watchlistRes] = await Promise.all([
      supabase.from('tickers').select('symbol, name, sector').eq('symbol', sym).maybeSingle(),
      supabase.rpc('ticker_detail_timeline', { p_symbol: sym }),
      uid
        ? supabase.from('watchlists').select('id').eq('user_id', uid).eq('is_default', true).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (tickerRes.error && __DEV__) console.warn('[useTickerDetail] ticker', tickerRes.error.message);
    if (timelineRes.error && __DEV__) console.warn('[useTickerDetail] timeline', timelineRes.error.message);

    if (timelineRes.error) {
      setError({ message: timelineRes.error.message, code: timelineRes.error.code });
    }

    setMeta(tickerRes.data ? { symbol: tickerRes.data.symbol, name: tickerRes.data.name, sector: tickerRes.data.sector } : { symbol: sym, name: sym, sector: '—' });

    const rows = (timelineRes.data || []).map(shapeTimelineRow).filter(Boolean);
    setTimeline(rows);

    const wid = watchlistRes.data?.id ?? null;
    setWatchlistId(wid);
    if (wid) {
      const { data: wt } = await supabase
        .from('watchlist_tickers')
        .select('ticker_symbol')
        .eq('watchlist_id', wid)
        .eq('ticker_symbol', sym)
        .maybeSingle();
      setOnWatchlist(!!wt);
    }

    setLoading(false);
  }, [sym]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const toggleWatchlist = useCallback(async () => {
    if (!watchlistId) return;
    const next = !onWatchlist;
    setOnWatchlist(next);
    if (next) {
      const { error: insertError } = await supabase
        .from('watchlist_tickers')
        .insert({ watchlist_id: watchlistId, ticker_symbol: sym });
      if (insertError && insertError.code !== '23505') {
        if (__DEV__) console.warn('[useTickerDetail] add failed', insertError.message);
        setOnWatchlist(false);
      }
    } else {
      const { error: deleteError } = await supabase
        .from('watchlist_tickers')
        .delete()
        .eq('watchlist_id', watchlistId)
        .eq('ticker_symbol', sym);
      if (deleteError) {
        if (__DEV__) console.warn('[useTickerDetail] remove failed', deleteError.message);
        setOnWatchlist(true);
      }
    }
  }, [watchlistId, onWatchlist, sym]);

  // realtime: any event change for this ticker → refresh the timeline.
  useTickerEventsStream(sym, fetchAll);

  return { meta, timeline, loading, error, onWatchlist, toggleWatchlist, refresh: fetchAll };
}
