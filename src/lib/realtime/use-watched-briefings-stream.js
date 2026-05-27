import { useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';

// subscribe to briefings UPDATEs where the symbol is in the watched list. on
// status → 'ready' transitions, fires onReady(briefing). consumer typically
// re-fetches its data (watchlist view, today RPC) and re-renders.
//
// the channel filter `ticker_symbol=in.(...)` only supports ~100 values per
// supabase realtime spec; if a user ever exceeds that, this hook silently
// skips the filter (relies on RLS to gate, which is correct but noisier).
export function useWatchedBriefingsStream(symbols, onReady) {
  const symbolsKey = Array.isArray(symbols) ? symbols.slice().sort().join(',') : '';
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    if (!symbolsKey) return undefined;
    const list = symbolsKey.split(',').filter(Boolean);
    if (list.length === 0) return undefined;

    const useFilter = list.length <= 100;
    const filter = useFilter ? `ticker_symbol=in.(${list.join(',')})` : undefined;

    const channel = supabase
      .channel(`watched-briefings:${symbolsKey}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'briefings',
          ...(filter ? { filter } : {}),
        },
        (payload) => {
          if (payload.new?.status === 'ready' && payload.old?.status !== 'ready') {
            onReadyRef.current?.(payload.new);
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [symbolsKey]);
}
