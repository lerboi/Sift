// MOCK_HOME_EVENTS + MOCK_PENDING_EVENT removed in B7 — useHomeData now reads
// from supabase.rpc('home_events_for_user'). pending events will arrive via
// realtime subscription in B14 (useNotificationsStream).
