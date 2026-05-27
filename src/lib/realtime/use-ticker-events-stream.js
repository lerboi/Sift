import { useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';

// subscribe to per-ticker events table changes. onChange is called for any
// INSERT or UPDATE on events filtered to the symbol; the consumer typically
// re-fetches the ticker_detail_timeline RPC on each call.
//
// onChange is held in a ref so callers passing an inline lambda don't cause
// channel churn on every parent render.
export function useTickerEventsStream(symbol, onChange) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!symbol) return undefined;
    const channel = supabase
      .channel(`ticker-events:${symbol}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: `ticker_symbol=eq.${symbol}`,
        },
        (payload) => onChangeRef.current?.(payload),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [symbol]);
}
