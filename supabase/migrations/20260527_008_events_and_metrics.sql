-- 008 — events + event_metrics + view + seed
-- 8-K filings (today; future 10-Q/10-K). metrics one-to-one with events, split
-- because extraction is a distinct pipeline step that lags the event insert.

create table public.events (
  id                uuid primary key default gen_random_uuid(),
  ticker_symbol     text not null references public.tickers(symbol) on update cascade,
  accession_number  text not null,
  form_type         text not null,
  item_number       text,
  fiscal_period     text not null,
  source            event_source not null default 'edgar',
  expected_at       timestamptz,
  filed_at          timestamptz not null,
  detected_at       timestamptz not null default now(),
  parsed_at         timestamptz,
  pushed_at         timestamptz,
  exhibit_url       text,
  storage_path      text,
  parse_status      parse_status not null default 'pending',
  parse_error       text,
  created_at        timestamptz not null default now(),

  constraint events_accession_unique unique (accession_number)
);

create index idx_events_ticker_filed_desc on public.events (ticker_symbol, filed_at desc);
create index idx_events_filed_at_desc     on public.events (filed_at desc);
create index idx_events_parse_status      on public.events (parse_status) where parse_status <> 'parsed';
create index idx_events_ticker_period     on public.events (ticker_symbol, fiscal_period);

alter table public.events enable row level security;

create policy "all auth read events"
  on public.events for select
  to authenticated
  using (parse_status in ('parsed', 'failed'));

create table public.event_metrics (
  event_id              uuid primary key references public.events(id) on delete cascade,
  eps_actual            numeric(10, 4),
  eps_est               numeric(10, 4),
  eps_surprise_pct      numeric(10, 6) generated always as (
    case when eps_est is null or eps_est = 0 then null
         else (eps_actual - eps_est) / eps_est end
  ) stored,
  revenue_actual        numeric(18, 2),
  revenue_est           numeric(18, 2),
  revenue_surprise_pct  numeric(10, 6) generated always as (
    case when revenue_est is null or revenue_est = 0 then null
         else (revenue_actual - revenue_est) / revenue_est end
  ) stored,
  guidance_direction    guidance_direction,
  guidance_detail       text,
  segments              jsonb,
  extracted_by_model_id uuid,
  extracted_at          timestamptz not null default now()
);

-- partial index on the generated column for the "biggest recent surprises"
-- query path (B15). null filtered out because surprise % is null when est is.
create index idx_event_metrics_surprise
  on public.event_metrics (eps_surprise_pct)
  where eps_surprise_pct is not null;

alter table public.event_metrics enable row level security;

-- parent-checked: only visible if parent event row is visible.
create policy "all auth read event_metrics"
  on public.event_metrics for select
  to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = event_id and e.parse_status = 'parsed'
    )
  );

-- view: flattened event row with metrics joined. used by event-screen.
create or replace view public.event_with_metrics_view as
select
  e.id,
  e.ticker_symbol,
  t.name             as ticker_name,
  t.sector,
  e.fiscal_period,
  e.source,
  e.expected_at,
  e.filed_at,
  e.detected_at,
  e.parsed_at,
  e.pushed_at,
  e.exhibit_url,
  e.parse_status,
  m.eps_actual,
  m.eps_est,
  m.eps_surprise_pct,
  m.revenue_actual,
  m.revenue_est,
  m.revenue_surprise_pct,
  m.guidance_direction,
  m.guidance_detail,
  m.segments
from public.events e
join public.tickers t        on t.symbol   = e.ticker_symbol
left join public.event_metrics m on m.event_id = e.id
where e.parse_status in ('parsed', 'failed');

-- seed: 3 past parsed events with full metrics so event-screen renders end-to-end.
-- accession_number values are real-formatted (XXXXXXXXXX-YY-NNNNNN) but synthetic;
-- they will not resolve on EDGAR. exhibit_url points to a real example so the
-- "view source" link is testable.

with seed_events as (
  insert into public.events (
    ticker_symbol, accession_number, form_type, item_number, fiscal_period,
    source, expected_at, filed_at, detected_at, parsed_at, pushed_at,
    exhibit_url, parse_status
  )
  values
    ('AAPL', '0000320193-26-000010', '8-K', '2.02', 'Q4-2025',
     'edgar', now() - interval '14 days', now() - interval '14 days' + interval '2 minutes',
     now() - interval '14 days' + interval '2 minutes 8 seconds',
     now() - interval '14 days' + interval '2 minutes 12 seconds',
     now() - interval '14 days' + interval '2 minutes 14 seconds',
     'https://www.sec.gov/Archives/edgar/data/320193/000032019326000010/aapl-20260128.htm',
     'parsed'),

    ('NVDA', '0001045810-26-000023', '8-K', '2.02', 'Q4-2025',
     'edgar', now() - interval '7 days', now() - interval '7 days' + interval '90 seconds',
     now() - interval '7 days' + interval '92 seconds',
     now() - interval '7 days' + interval '95 seconds',
     now() - interval '7 days' + interval '97 seconds',
     'https://www.sec.gov/Archives/edgar/data/1045810/000104581026000023/nvda-20260225.htm',
     'parsed'),

    ('TSLA', '0001318605-26-000018', '8-K', '2.02', 'Q1-2026',
     'edgar', now() - interval '3 days', now() - interval '3 days' + interval '4 minutes',
     now() - interval '3 days' + interval '4 minutes 5 seconds',
     now() - interval '3 days' + interval '4 minutes 9 seconds',
     now() - interval '3 days' + interval '4 minutes 11 seconds',
     'https://www.sec.gov/Archives/edgar/data/1318605/000131860526000018/tsla-20260420.htm',
     'parsed')

  on conflict (accession_number) do nothing
  returning id, ticker_symbol
)
insert into public.event_metrics (
  event_id, eps_actual, eps_est, revenue_actual, revenue_est,
  guidance_direction, guidance_detail, segments
)
select
  e.id,
  case e.ticker_symbol
    when 'AAPL' then 2.14
    when 'NVDA' then 1.18
    when 'TSLA' then 0.59
  end,
  case e.ticker_symbol
    when 'AAPL' then 1.98
    when 'NVDA' then 1.05
    when 'TSLA' then 0.65
  end,
  case e.ticker_symbol
    when 'AAPL' then 124300000000
    when 'NVDA' then 28200000000
    when 'TSLA' then 27100000000
  end,
  case e.ticker_symbol
    when 'AAPL' then 122400000000
    when 'NVDA' then 26000000000
    when 'TSLA' then 28000000000
  end,
  case e.ticker_symbol
    when 'AAPL' then 'raised'::guidance_direction
    when 'NVDA' then 'raised'::guidance_direction
    when 'TSLA' then 'maintained'::guidance_direction
  end,
  case e.ticker_symbol
    when 'AAPL' then 'FY guidance midpoint raised by $0.10'
    when 'NVDA' then 'Data Center revenue guidance for next quarter raised ~6%'
    when 'TSLA' then 'Full-year delivery range maintained; capex bias higher'
  end,
  case e.ticker_symbol
    when 'AAPL' then '[{"name":"Services","actual":24.5,"est":23.8},{"name":"iPhone","actual":67.1,"est":66.0},{"name":"Wearables","actual":11.9,"est":12.3}]'::jsonb
    when 'NVDA' then '[{"name":"Data Center","actual":22.7,"est":20.8},{"name":"Gaming","actual":3.1,"est":3.0},{"name":"Automotive","actual":0.45,"est":0.40}]'::jsonb
    when 'TSLA' then '[{"name":"Automotive","actual":22.6,"est":23.5},{"name":"Energy","actual":3.1,"est":2.9},{"name":"Services","actual":1.4,"est":1.6}]'::jsonb
  end
from seed_events e;
