-- 014 — llm_calls + data_source_status
-- append-only audit + provider-health observability. service_role only.
-- no client RLS policies → invisible to authenticated/anon (default deny).

create table public.llm_calls (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null,                                   -- 'briefing' | 'extraction' | 'transcript_summary' | 'tone'
  provider        text not null,                                   -- 'anthropic' | 'openai'
  model           text not null,                                   -- 'claude-haiku-4-5' | 'gpt-4o-mini'
  prompt_version  text,
  input_tokens    integer,
  output_tokens   integer,
  cost_usd        numeric(10, 6),
  latency_ms      integer,
  success         boolean not null,
  error           text,
  reference_id    uuid,
  reference_kind  text,
  created_at      timestamptz not null default now()
);

create index idx_llm_calls_created_at on public.llm_calls (created_at desc);
create index idx_llm_calls_kind_model on public.llm_calls (kind, model);

alter table public.llm_calls enable row level security;
-- no select / insert / update / delete policies — service_role only.
-- admin dashboard later can add a role-claim-gated select policy.

create table public.data_source_status (
  source              text primary key,                            -- 'edgar' | 'finnhub' | 'earningscalls' | ...
  last_success_at     timestamptz,
  last_error_at       timestamptz,
  last_error          text,
  success_count_24h   integer not null default 0,
  error_count_24h     integer not null default 0,
  updated_at          timestamptz not null default now()
);

alter table public.data_source_status enable row level security;
-- service_role only, like llm_calls. admin ui later may relax.

-- bootstrap the source rows so modal heartbeat upserts always have a row.
insert into public.data_source_status (source) values
  ('edgar'),
  ('finnhub'),
  ('earningscalls')
on conflict (source) do nothing;
