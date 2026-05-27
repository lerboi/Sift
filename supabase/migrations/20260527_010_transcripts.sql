-- 010 — transcripts + transcript_segments + transcript_analysis
-- + ticker_detail_timeline rpc
-- per-call text + embedded segments + llm analysis. embedding dimension 1536
-- locks us to openai text-embedding-3-small or cohere embed-v3 default.

create table public.transcripts (
  id              uuid primary key default gen_random_uuid(),
  ticker_symbol   text not null references public.tickers(symbol) on update cascade,
  fiscal_period   text not null,
  call_date       date not null,
  source          text not null,                                       -- 'earningscalls' | 'api_ninjas' | 'motley_fool'
  storage_path    text not null,                                       -- raw text in storage
  fetched_at      timestamptz not null default now(),
  created_at      timestamptz not null default now(),

  constraint transcripts_unique_per_period unique (ticker_symbol, fiscal_period)
);

create index idx_transcripts_ticker_call_date on public.transcripts (ticker_symbol, call_date desc);

alter table public.transcripts enable row level security;
create policy "all auth read transcripts"
  on public.transcripts for select to authenticated using (true);

create table public.transcript_segments (
  id             uuid primary key default gen_random_uuid(),
  transcript_id  uuid not null references public.transcripts(id) on delete cascade,
  segment_order  integer not null,
  speaker        text,
  role           speaker_role not null default 'other',
  content        text not null,
  embedding      vector(1536),
  created_at     timestamptz not null default now(),

  constraint transcript_segments_unique_order unique (transcript_id, segment_order)
);

create index idx_transcript_segments_transcript on public.transcript_segments (transcript_id, segment_order);
-- hnsw for approximate nearest-neighbour (novelty detection).
-- recall ~95% out of the box; tune m / ef_construction only if observed bad.
create index idx_transcript_segments_embedding
  on public.transcript_segments using hnsw (embedding vector_cosine_ops);

alter table public.transcript_segments enable row level security;
create policy "all auth read transcript_segments"
  on public.transcript_segments for select to authenticated using (true);

create table public.transcript_analysis (
  transcript_id      uuid primary key references public.transcripts(id) on delete cascade,
  tone               tone not null,
  tone_score         numeric(5, 4),
  novel_topics       jsonb,
  guidance_changes   jsonb,
  summary_md         text,
  model_version_id   uuid,                                              -- FK added in B9
  generated_at       timestamptz not null default now()
);

alter table public.transcript_analysis enable row level security;
create policy "all auth read transcript_analysis"
  on public.transcript_analysis for select to authenticated using (true);

-- ticker_detail_timeline: unions everything a single ticker's screen needs
-- into one flat ordered list. payload is jsonb so each kind can shape its own
-- fields without altering the rpc signature. security invoker so the
-- per-table rls (briefings status=ready, events parse_status, etc) applies.

create or replace function public.ticker_detail_timeline(p_symbol text)
returns table (
  item_id      uuid,
  kind         text,
  occurred_at  timestamptz,
  payload      jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
  -- upcoming briefings (status = ready, expected after now)
  select
    b.id  as item_id,
    'earnings-upcoming'::text as kind,
    b.expected_release_at as occurred_at,
    jsonb_build_object(
      'fiscal_period',       b.fiscal_period,
      'beat_probability',    b.beat_probability,
      'expected_release_at', b.expected_release_at,
      'consensus_eps',       b.consensus_eps,
      'surprise_prediction', b.surprise_prediction
    )
  from public.briefings b
  where b.ticker_symbol = upper(p_symbol)
    and b.status = 'ready'
    and b.expected_release_at > now()

  union all

  -- past parsed events with metrics
  select
    e.id, 'earnings-past',
    e.filed_at,
    jsonb_build_object(
      'fiscal_period',       e.fiscal_period,
      'expected_at',         e.expected_at,
      'actual_at',           e.filed_at,
      'eps_actual',          m.eps_actual,
      'eps_est',             m.eps_est,
      'surprise_pct',        m.eps_surprise_pct,
      'revenue_actual',      m.revenue_actual,
      'revenue_est',         m.revenue_est,
      'revenue_surprise_pct', m.revenue_surprise_pct,
      'guidance_direction',  m.guidance_direction,
      'guidance_detail',     m.guidance_detail,
      'segments',            m.segments
    )
  from public.events e
  join public.event_metrics m on m.event_id = e.id
  where e.ticker_symbol = upper(p_symbol)
    and e.parse_status = 'parsed'

  union all

  -- past briefings (status=ready, expected_release_at already passed)
  select
    b.id, 'briefing',
    coalesce(b.generated_at, b.expected_release_at),
    jsonb_build_object(
      'title',           'Post-call briefing — ' || b.fiscal_period,
      'content_md',      b.content_md,
      'generated_at',    b.generated_at,
      'fiscal_period',   b.fiscal_period,
      'prompt_version',  b.prompt_version
    )
  from public.briefings b
  where b.ticker_symbol = upper(p_symbol)
    and b.status = 'ready'
    and b.expected_release_at <= now()

  union all

  -- transcripts (with optional analysis)
  select
    t.id, 'transcript',
    t.call_date::timestamptz,
    jsonb_build_object(
      'fiscal_period', t.fiscal_period,
      'call_date',     t.call_date,
      'tone',          ta.tone,
      'tone_score',    ta.tone_score,
      'novel_topics',  ta.novel_topics,
      'summary_md',    ta.summary_md
    )
  from public.transcripts t
  left join public.transcript_analysis ta on ta.transcript_id = t.id
  where t.ticker_symbol = upper(p_symbol)

  order by occurred_at desc;
$$;

-- seed: one transcript + analysis for AAPL Q4-2025 (matches the events seed).
with t as (
  insert into public.transcripts (ticker_symbol, fiscal_period, call_date, source, storage_path)
  values ('AAPL', 'Q4-2025', (current_date - 14)::date, 'earningscalls', 'transcripts/aapl-q4-2025.txt')
  on conflict (ticker_symbol, fiscal_period) do nothing
  returning id
)
insert into public.transcript_analysis (
  transcript_id, tone, tone_score, novel_topics, guidance_changes, summary_md
)
select
  t.id,
  'neutral'::tone,
  0.12,
  '["foundry diversification","services pricing power"]'::jsonb,
  '{"direction":"raised","previous":"maintained","detail":"FY midpoint +$0.10"}'::jsonb,
  E'## AAPL — Q4 25 call summary\n\nBeat EPS by 8.1%, revenue +1.7%. Tone shifted slightly cautious on China demand vs Q3 ''25. FY guidance midpoint raised by $0.10. Analysts pushed three times on the AI roadmap without commitment.\n\n_Educational use only. Not investment advice._'
from t;
