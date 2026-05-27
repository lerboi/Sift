import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

const FALLBACK = [100, 100, 100, 100, 100];
const cache = new Map();
const pending = new Map();

async function fetchSparkline(symbol, days) {
  const key = `${symbol}-${days}`;
  if (cache.has(key)) return cache.get(key);
  if (pending.has(key)) return pending.get(key);

  const promise = (async () => {
    const { data, error } = await supabase.rpc('ticker_sparkline', {
      p_symbol: symbol,
      p_days: days,
    });
    if (error || !data || data.length === 0) {
      if (error && __DEV__) console.warn('[useSparkline] rpc failed for', symbol, error.message);
      cache.set(key, FALLBACK);
      pending.delete(key);
      return FALLBACK;
    }
    const closes = data.map((r) => Number(r.close)).filter((n) => Number.isFinite(n));
    const out = closes.length > 0 ? closes : FALLBACK;
    cache.set(key, out);
    pending.delete(key);
    return out;
  })();

  pending.set(key, promise);
  return promise;
}

export function useSparkline(symbol, days = 30) {
  const initial = symbol ? cache.get(`${symbol}-${days}`) : null;
  const [data, setData] = useState(initial || FALLBACK);

  useEffect(() => {
    if (!symbol) return undefined;
    let cancelled = false;
    fetchSparkline(symbol, days).then((d) => {
      if (!cancelled) setData(d);
    });
    return () => { cancelled = true; };
  }, [symbol, days]);

  return data;
}
