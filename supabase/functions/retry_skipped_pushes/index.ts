// retry_skipped_pushes — every 5 minutes.
// scheduled by sift-retry-skipped-pushes cron job (migration 016).
//
// picks up notifications.status='skipped_quiet' rows whose scheduled_for has
// elapsed and re-sends them via Expo Push. does NOT re-run the throttle /
// quiet-hours triggers (those already gated at original insert time).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  priority?: "normal" | "high";
  sound?: string;
}

async function sendExpoBatch(messages: ExpoMessage[]): Promise<{ sent: number; failed: number }> {
  if (messages.length === 0) return { sent: 0, failed: 0 };
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    try {
      const resp = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Accept-Encoding": "gzip",
        },
        body: JSON.stringify(batch),
      });
      if (resp.ok) sent += batch.length;
      else failed += batch.length;
    } catch (e) {
      console.error("expo batch failed", e);
      failed += batch.length;
    }
  }
  return { sent, failed };
}

const MAX_BATCH = 500;

Deno.serve(async () => {
  const nowIso = new Date().toISOString();

  const { data: due, error: queryErr } = await supabase
    .from("notifications")
    .select("id, user_id, kind, ticker_symbol, reference_id, title, body, deep_link")
    .eq("status", "skipped_quiet")
    .lte("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: true })
    .limit(MAX_BATCH);

  if (queryErr) {
    console.error("retry query failed", queryErr);
    return new Response(JSON.stringify({ ok: false, error: queryErr.message }), { status: 500 });
  }

  if (!due || due.length === 0) {
    return new Response(JSON.stringify({ ok: true, picked_up: 0 }), { status: 200 });
  }

  const userIds = Array.from(new Set(due.map((n) => n.user_id)));
  const { data: tokens } = await supabase
    .from("push_tokens")
    .select("user_id, token")
    .in("user_id", userIds);

  const tokensByUser = new Map<string, string[]>();
  for (const t of tokens ?? []) {
    const list = tokensByUser.get(t.user_id) ?? [];
    list.push(t.token);
    tokensByUser.set(t.user_id, list);
  }

  const messages: ExpoMessage[] = [];
  const idsSendable: string[] = [];
  const idsNoToken: string[] = [];

  for (const n of due) {
    const userTokens = tokensByUser.get(n.user_id) ?? [];
    if (userTokens.length === 0) {
      idsNoToken.push(n.id);
      continue;
    }
    for (const token of userTokens) {
      messages.push({
        to: token,
        title: n.title,
        body: n.body,
        data: { deep_link: n.deep_link, kind: n.kind, reference_id: n.reference_id },
        priority: n.kind === "event" ? "high" : "normal",
        sound: "default",
      });
    }
    idsSendable.push(n.id);
  }

  const summary = await sendExpoBatch(messages);

  // mark sendable rows as sent regardless of expo result; failed pushes are
  // surfaced via push receipts (future worker), not retried here.
  if (idsSendable.length > 0) {
    await supabase
      .from("notifications")
      .update({ status: "sent", sent_at: nowIso })
      .in("id", idsSendable);
  }

  // no-token rows → mark failed so the next gc reclaims them
  if (idsNoToken.length > 0) {
    await supabase
      .from("notifications")
      .update({ status: "failed", error: "no push token registered for user" })
      .in("id", idsNoToken);
  }

  return new Response(JSON.stringify({
    ok: true,
    picked_up: due.length,
    push_sent: summary.sent,
    push_failed: summary.failed,
    no_token: idsNoToken.length,
  }), { status: 200, headers: { "Content-Type": "application/json" } });
});
