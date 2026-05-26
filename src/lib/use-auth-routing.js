import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';

// device-local ack flag. moves to profiles.disclaimer_ack_at on a real backend
// table later. read by useAuthRouting; written by the ack screen on confirm.
export const ACK_KEY = 'sift.disclaimer_ack_at';

// status: 'loading' | 'unauthed' | 'unonboarded' | 'authed'
export function useAuthRouting() {
  const router = useRouter();
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const [{ data }, ack] = await Promise.all([
        supabase.auth.getSession(),
        AsyncStorage.getItem(ACK_KEY),
      ]);
      if (cancelled) return;
      if (!data?.session) setStatus('unauthed');
      else if (!ack) setStatus('unonboarded');
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
