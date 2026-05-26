import { useCallback, useEffect, useState } from 'react';
import { MOCK_HOME_EVENTS, MOCK_PENDING_EVENT } from './mock';

// fake hook — swap for a supabase query once schema lands.
// when wiring real data, populate `error` with `{ message, code }` on fetch
// failure; home-screen.js consumes it via `<InlineError>` with a retry that
// calls `refresh()`.
export function useHomeData() {
  const [state, setState] = useState({
    events: [],
    loading: true,
    refreshing: false,
    error: null,
  });
  const [pending, setPending] = useState([]);

  const fetchOnce = useCallback((kind) => {
    setState((s) => ({ ...s, ...(kind === 'refresh' ? { refreshing: true } : { loading: true }) }));
    setTimeout(() => {
      setState({
        events: MOCK_HOME_EVENTS,
        loading: false,
        refreshing: false,
        error: null,
      });
    }, kind === 'refresh' ? 600 : 800);
  }, []);

  useEffect(() => {
    fetchOnce('initial');
  }, [fetchOnce]);

  // simulate a new live event arriving ~5s after first load
  useEffect(() => {
    if (state.loading) return;
    const t = setTimeout(() => setPending([MOCK_PENDING_EVENT]), 5000);
    return () => clearTimeout(t);
  }, [state.loading]);

  const refresh = useCallback(() => fetchOnce('refresh'), [fetchOnce]);

  const promotePending = useCallback(() => {
    setState((s) => ({ ...s, events: [...pending, ...s.events] }));
    setPending([]);
  }, [pending]);

  return { ...state, pending, refresh, promotePending };
}
