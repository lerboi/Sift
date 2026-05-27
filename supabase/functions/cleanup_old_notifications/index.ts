// cleanup_old_notifications — daily 3am UTC purge.
// scheduled by sift-cleanup-old-notifications cron job (migration 016).
//
// deletes notifications older than 30 days in a terminal state. keeps the
// in-app tray light, preserves recent rows for retries and audit.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const RETENTION_DAYS = 30;
const TERMINAL_STATUSES = ["sent", "delivered", "failed"];

Deno.serve(async () => {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400000).toISOString();

  const { count, error } = await supabase
    .from("notifications")
    .delete({ count: "exact" })
    .lt("created_at", cutoff)
    .in("status", TERMINAL_STATUSES);

  if (error) {
    console.error("cleanup failed", error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({
    ok: true,
    deleted: count ?? 0,
    cutoff,
    retention_days: RETENTION_DAYS,
  }), { status: 200, headers: { "Content-Type": "application/json" } });
});
