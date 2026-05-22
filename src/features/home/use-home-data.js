import { useCallback, useEffect, useState } from 'react';
import { MOCK_LIVE, MOCK_UPCOMING, MOCK_RECENT } from './mock';

// fake hook — swap for a supabase query once schema lands
export function useHomeData() {
  const [state, setState] = useState({
    live: [],
    upcoming: [],
    recent: [],
    loading: true,
    refreshing: false,
    error: null,
  });
  const [pending, setPending] = useState([]);

  const fetchOnce = useCallback((kind) => {
    setState((s) => ({ ...s, ...(kind === 'refresh' ? { refreshing: true } : { loading: true }) }));
    setTimeout(() => {
      setState({
        live: MOCK_LIVE,
        upcoming: MOCK_UPCOMING,
        recent: MOCK_RECENT,
        loading: false,
        refreshing: false,
        error: null,
      });
    }, kind === 'refresh' ? 600 : 800);
  }, []);

  useEffect(() => {
    fetchOnce('initial');
  }, [fetchOnce]);

  // simulate a new event arriving ~5s after first load completes
  useEffect(() => {
    if (state.loading) return;
    const t = setTimeout(() => {
      setPending([
        {
          ticker: 'AMD',
          period: 'Q1 26',
          when: 'just now',
          epsActual: 1.12,
          epsEst: 0.98,
          surprisePct: 0.143,
          isLive: true,
        },
      ]);
    }, 5000);
    return () => clearTimeout(t);
  }, [state.loading]);

  const refresh = useCallback(() => fetchOnce('refresh'), [fetchOnce]);

  const promotePending = useCallback(() => {
    setState((s) => ({ ...s, live: [...pending, ...s.live] }));
    setPending([]);
  }, [pending]);

  return { ...state, pending, refresh, promotePending };
}
