import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

// returns the current authed user id or null. updates on auth state change.
export function useUserId() {
  const [userId, setUserId] = useState(null);
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setUserId(data?.session?.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);
  return userId;
}
