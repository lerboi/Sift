// gc_stale_push_tokens — weekly Sunday 4am UTC.
// scheduled by sift-gc-stale-push-tokens cron job (migration 016).
//
// deletes push_tokens that haven't been refreshed in 30 days. the root layout
// useEffect upserts last_seen_at on every cold start, so a token that hasn't
// been seen in 30 days is either an uninstalled app or a permanently-revoked
// permission.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const STALENESS_DAYS = 30;

Deno.serve(async () => {
  const cutoff = new Date(Date.now() - STALENESS_DAYS * 86400000).toISOString();

  const { count, error } = await supabase
    .from("push_tokens")
    .delete({ count: "exact" })
    .lt("last_seen_at", cutoff);

  if (error) {
    console.error("gc failed", error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({
    ok: true,
    deleted: count ?? 0,
    cutoff,
    staleness_days: STALENESS_DAYS,
  }), { status: 200, headers: { "Content-Type": "application/json" } });
});
