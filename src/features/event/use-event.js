import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

function fmtClock(d) {
  if (!d) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }) + ' ET';
}

function fmtClockTime(d) {
  if (!d) return '';
  return d.toLocaleString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }) + ' ET';
}

function deltaSeconds(later, earlier) {
  if (!later || !earlier) return null;
  const ms = later.getTime() - earlier.getTime();
  return Math.max(0, Math.round(ms / 1000));
}

function shape(row) {
  if (!row) return null;
  const filedAt = row.filed_at ? new Date(row.filed_at) : null;
  const detectedAt = row.detected_at ? new Date(row.detected_at) : null;
  const pushedAt = row.pushed_at ? new Date(row.pushed_at) : null;
  const detectedDelta = deltaSeconds(detectedAt, filedAt);
  const pushedDelta = deltaSeconds(pushedAt, filedAt);

  return {
    id: row.id,
    ticker: row.ticker_symbol,
    name: row.ticker_name,
    period: row.fiscal_period,
    parseStatus: row.parse_status,
    expectedAt: row.expected_at,
    actualAt: row.filed_at,
    filedAt: fmtClock(filedAt),
    detectedAt: fmtClockTime(detectedAt),
    pushedAt: fmtClockTime(pushedAt),
    detectedDeltaSec: detectedDelta,
    pushedDeltaSec: pushedDelta,
    epsActual: row.eps_actual !== null ? Number(row.eps_actual) : null,
    epsEst: row.eps_est !== null ? Number(row.eps_est) : null,
    surprisePct: row.eps_surprise_pct !== null ? Number(row.eps_surprise_pct) : null,
    revenueActual: row.revenue_actual !== null ? Number(row.revenue_actual) / 1e9 : null,
    revenueEst: row.revenue_est !== null ? Number(row.revenue_est) / 1e9 : null,
    revenueSurprisePct: row.revenue_surprise_pct !== null ? Number(row.revenue_surprise_pct) : null,
    guidance: {
      direction: row.guidance_direction || 'none',
      detail: row.guidance_detail || '',
    },
    segments: Array.isArray(row.segments) ? row.segments : [],
    exhibitUrl: row.exhibit_url || null,
  };
}

export function useEvent(eventId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (!eventId) {
      setData(null);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      const { data: row, error: queryError } = await supabase
        .from('event_with_metrics_view')
        .select('*')
        .eq('id', eventId)
        .maybeSingle();
      if (cancelled) return;
      if (queryError) {
        if (__DEV__) console.warn('[useEvent] fetch failed', queryError.message);
        setError({ message: queryError.message, code: queryError.code });
        setData(null);
      } else {
        setData(shape(row));
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [eventId, refreshTick]);

  const refresh = () => setRefreshTick((n) => n + 1);

  return { data, loading, error, refresh };
}
