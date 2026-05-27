import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

// status: 'loading' | 'unauthed' | 'unonboarded' | 'authed'
export function useAuthRouting() {
  const router = useRouter();
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (cancelled) return;

      const session = sessionData?.session;
      if (!session) {
        setStatus('unauthed');
        return;
      }

      // safe fallback: profiles table may not exist yet (pre-migration apply).
      // treating that as 'unonboarded' routes to /welcome which is the harmless path.
      const { data, error } = await supabase
        .from('profiles')
        .select('disclaimer_ack_at')
        .eq('id', session.user.id)
        .maybeSingle();
      if (cancelled) return;

      if (error) {
        if (__DEV__) console.warn('[useAuthRouting] profile fetch failed', error.message);
        setStatus('unonboarded');
        return;
      }

      if (!data?.disclaimer_ack_at) setStatus('unonboarded');
      else setStatus('authed');
    }

    check();
    const { data: sub } = supabase.auth.onAuthStateChange(() => check());
    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthed') router.replace('/sign-in');
    else if (status === 'unonboarded') router.replace('/welcome');
    else router.replace('/today');
  }, [status, router]);

  return status;
}
