// notify_user_event — fan-out from db trigger to per-user notifications + expo push.
//
// invoked by trigger_notify_fan_out (migration 015) with the payload:
//   { kind: 'briefing' | 'event' | 'transcript',
//     ticker_symbol: string,
//     reference_id: string }
//
// flow:
//   1. find watchers (users whose watchlist contains ticker_symbol)
//   2. filter by per-user notify_* preference + compliance copy gate
//   3. INSERT notifications (db triggers handle throttle + quiet hours)
//   4. POST batches to Expo Push for rows not skipped_quiet
//
// returns 200 with a summary; 500 only on hard backend errors.
// throttle exceptions (P0001) are filtered per-row and logged, not retried.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

type Kind = "briefing" | "event" | "transcript";

interface FanOutPayload {
  kind: Kind;
  ticker_symbol: string;
  reference_id: string;
}

interface BuiltNotification {
  title: string;
  body: string;
  deepLink: string;
}

// compliance forbidden-word filter per docs/architecture/compliance.md
// — anything flagged blocks the notification and routes for review.
const FORBIDDEN = /\b(advice|recommend(?:s|ation)?|should\s+(?:buy|sell)|will\s+(?:rise|fall|moon|tank)|guaranteed|sure\s+thing|risk[- ]free|can'?t\s+lose|buy\s+now|sell\s+now|your\s+stocks?|your\s+portfolio\s+recommendation)\b/i;

function complianceCheck(...strings: (string | undefined | null)[]): string | null {
  for (const s of strings) {
    if (!s) continue;
    const match = FORBIDDEN.exec(s);
    if (match) return match[0];
  }
  return null;
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env");
}

const supabase: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function buildNotification(kind: Kind, refId: string, ticker: string): Promise<BuiltNotification | null> {
  if (kind === "briefing") {
    const { data: b } = await supabase
      .from("briefings")
      .select("id, fiscal_period, beat_probability, expected_release_at")
      .eq("id", refId)
      .maybeSingle();
    if (!b) return null;
    const periodDisplay = formatFiscalPeriod(b.fiscal_period);
    const beatPct = b.beat_probability != null ? Math.round(Number(b.beat_probability) * 100) : null;
    return {
      title: `${ticker} ${periodDisplay} briefing ready`,
      body: beatPct != null
        ? `Model beat probability ${beatPct}%. Open to see the setup.`
        : "Tap to open the pre-earnings briefing.",
      // route to ticker detail — briefings appear in that screen's timeline.
      // event detail expects an event uuid; passing a briefing id 404s.
      deepLink: `sift://watchlist/${ticker}`,
    };
  }
  if (kind === "event") {
    const { data: e } = await supabase
      .from("event_with_metrics_view")
      .select("id, fiscal_period, eps_actual, eps_est, eps_surprise_pct")
      .eq("id", refId)
      .maybeSingle();
    if (!e) return null;
    const periodDisplay = formatFiscalPeriod(e.fiscal_period);
    const surprise = e.eps_surprise_pct != null ? Number(e.eps_surprise_pct) : 0;
    const direction = surprise > 0.005 ? "beat" : surprise < -0.005 ? "missed" : "met";
    const sign = surprise > 0 ? "+" : surprise < 0 ? "−" : "";
    const display = Math.abs(surprise * 100).toFixed(1);
    return {
      title: `${ticker} ${periodDisplay} — reported`,
      body: `${direction.toUpperCase()} consensus by ${sign}${display}% EPS.`,
      deepLink: `sift://today/events/${e.id}`,
    };
  }
  // transcript
  const { data: t } = await supabase
    .from("transcripts")
    .select("id, fiscal_period, transcript_analysis(tone)")
    .eq("id", refId)
    .maybeSingle();
  if (!t) return null;
  const periodDisplay = formatFiscalPeriod(t.fiscal_period);
  const tone = (t as { transcript_analysis: { tone: string } | null }).transcript_analysis?.tone;
  return {
    title: `${ticker} ${periodDisplay} transcript`,
    body: tone ? `Post-call analysis ready. Tone: ${tone}.` : "Post-call analysis ready.",
    deepLink: `sift://watchlist/${ticker}`,
  };
}

function formatFiscalPeriod(p: string | null | undefined): string {
  if (!p) return "";
  const m = String(p).match(/^(Q[1-4])-(\d{4})$/);
  if (!m) return p;
  return `${m[1]} ${m[2].slice(-2)}`;
}

function prefColumnForKind(kind: Kind): string {
  if (kind === "briefing") return "notify_briefings";
  if (kind === "event") return "notify_events";
  return "notify_transcripts";
}

interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  priority?: "default" | "normal" | "high";
  sound?: string;
}

async function sendExpoPush(messages: ExpoMessage[]): Promise<{ sent: number; failed: number }> {
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
      console.error("expo push batch failed", e);
      failed += batch.length;
    }
  }
  return { sent, failed };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  let payload: FanOutPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), { status: 400 });
  }

  const { kind, ticker_symbol, reference_id } = payload;
  if (!kind || !ticker_symbol || !reference_id) {
    return new Response(JSON.stringify({ error: "missing required fields" }), { status: 400 });
  }

  // 1. find users watching this ticker
  const { data: watchers, error: watchersErr } = await supabase
    .from("watchlist_tickers")
    .select("watchlist:watchlists!inner(user_id)")
    .eq("ticker_symbol", ticker_symbol);

  if (watchersErr) {
    console.error("watchers lookup failed", watchersErr);
    return new Response(JSON.stringify({ error: watchersErr.message }), { status: 500 });
  }

  const userIds = Array.from(new Set(
    (watchers ?? [])
      .map((w) => (w as { watchlist: { user_id: string } | null }).watchlist?.user_id)
      .filter((u): u is string => !!u),
  ));

  if (userIds.length === 0) {
    return new Response(JSON.stringify({ inserted: 0, sent: 0, reason: "no watchers" }), { status: 200 });
  }

  // 2. filter by preference
  const prefColumn = prefColumnForKind(kind);
  const { data: profiles, error: profilesErr } = await supabase
    .from("profiles")
    .select(`id, ${prefColumn}`)
    .in("id", userIds);

  if (profilesErr) {
    console.error("profiles lookup failed", profilesErr);
    return new Response(JSON.stringify({ error: profilesErr.message }), { status: 500 });
  }

  const wanters = (profiles ?? [])
    .filter((p) => (p as Record<string, unknown>)[prefColumn] === true)
    .map((p) => (p as { id: string }).id);

  if (wanters.length === 0) {
    return new Response(JSON.stringify({ inserted: 0, sent: 0, reason: "no wanters" }), { status: 200 });
  }

  // 3. build notification content + compliance gate
  const content = await buildNotification(kind, reference_id, ticker_symbol);
  if (!content) {
    return new Response(JSON.stringify({ error: "reference row not found", kind, reference_id }), { status: 404 });
  }

  const flagged = complianceCheck(content.title, content.body);
  if (flagged) {
    console.warn("compliance filter blocked notification", { flagged, content, kind, ticker_symbol });
    return new Response(JSON.stringify({
      inserted: 0,
      sent: 0,
      reason: "compliance_blocked",
      flagged,
    }), { status: 200 });
  }

  // 4. INSERT notifications one row at a time — throttle trigger raises per-row
  // and we want to track per-user failures without failing the batch.
  let inserted = 0;
  const insertedRows: { user_id: string; id: string; status: string }[] = [];
  for (const userId of wanters) {
    const { data: row, error: insertErr } = await supabase
      .from("notifications")
      .insert({
        user_id: userId,
        kind,
        ticker_symbol,
        reference_id,
        reference_kind: kind,
        title: content.title,
        body: content.body,
        deep_link: content.deepLink,
      })
      .select("id, status")
      .single();
    if (insertErr) {
      if (insertErr.code === "P0001") {
        // throttle exceeded — expected, not an error
        continue;
      }
      console.warn("notification insert failed", { userId, error: insertErr.message });
      continue;
    }
    inserted += 1;
    insertedRows.push({ user_id: userId, id: row.id, status: row.status });
  }

  // 5. fetch push tokens for users whose notification was not skipped_quiet
  const sendableUserIds = insertedRows.filter((r) => r.status !== "skipped_quiet").map((r) => r.user_id);
  let sentSummary = { sent: 0, failed: 0 };
  if (sendableUserIds.length > 0) {
    const { data: tokens, error: tokensErr } = await supabase
      .from("push_tokens")
      .select("user_id, token")
      .in("user_id", sendableUserIds);

    if (tokensErr) {
      console.warn("push token lookup failed", tokensErr);
    } else {
      const messages: ExpoMessage[] = (tokens ?? []).map((t) => ({
        to: t.token,
        title: content.title,
        body: content.body,
        data: { deep_link: content.deepLink, kind, reference_id },
        priority: kind === "event" ? "high" : "normal",
        sound: "default",
      }));
      sentSummary = await sendExpoPush(messages);

      if (sentSummary.sent > 0) {
        // mark notifications as sent (best-effort; receipts handled by a future worker)
        const nowIso = new Date().toISOString();
        await supabase
          .from("notifications")
          .update({ status: "sent", sent_at: nowIso })
          .in("id", insertedRows.filter((r) => r.status !== "skipped_quiet").map((r) => r.id));
      }
    }
  }

  return new Response(JSON.stringify({
    inserted,
    skipped_quiet: insertedRows.filter((r) => r.status === "skipped_quiet").length,
    push_sent: sentSummary.sent,
    push_failed: sentSummary.failed,
  }), { status: 200, headers: { "Content-Type": "application/json" } });
});
