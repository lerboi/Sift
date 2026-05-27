import { useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { broadcastNotification } from './notifications-bus';

// subscribe to notifications inserts for the current user. fires
// broadcastNotification(row) on each new INSERT; downstream consumers (e.g.
// useHomeData) subscribe to the bus and react. RLS filters the channel so the
// user only ever sees their own rows.
export function useNotificationsStream(userId) {
  useEffect(() => {
    if (!userId) return undefined;
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => broadcastNotification(payload.new),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);
}
