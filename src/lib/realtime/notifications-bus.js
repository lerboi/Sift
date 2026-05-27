// tiny pub/sub for cross-screen notification arrivals. the root-level
// useNotificationsStream subscribes to supabase realtime and calls broadcast;
// any screen (Today, future toast surface) can subscribe via subscribe().
//
// kept as a module-level singleton (no react context) so subscribers can
// register/unregister without re-rendering the provider tree.

const listeners = new Set();

export function subscribeToNotifications(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function broadcastNotification(row) {
  for (const fn of listeners) {
    try { fn(row); } catch (e) { if (__DEV__) console.warn('[notif-bus] listener threw', e); }
  }
}
