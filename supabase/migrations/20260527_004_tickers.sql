-- 004 — tickers
-- issuer catalog. globally readable, service-role writeable. seed with a
-- 20-ticker bootstrap so the app has something to render on first push;
-- full russell-1000 ingest is via scripts/build_ticker_seed.py + seed.sql.

create table public.tickers (
  symbol            text primary key,
  name              text not null,
  cik               text not null,
  exchange          text not null,
  sector            text not null,
  industry          text,
  market_cap_class  text not null default 'large',
  is_active         boolean not null default true,
  updated_at        timestamptz not null default now(),

  constraint tickers_symbol_uppercase check (symbol = upper(symbol)),
  constraint tickers_cik_format       check (cik ~ '^[0-9]{10}$'),
  constraint tickers_market_cap_class check (market_cap_class in ('small','mid','large','mega'))
);

create index idx_tickers_sector    on public.tickers (sector) where is_active;
create index idx_tickers_cik       on public.tickers (cik);
create index idx_tickers_is_active on public.tickers (is_active);

alter table public.tickers enable row level security;

create policy "all auth read tickers"
  on public.tickers for select
  to authenticated
  using (true);

create trigger set_updated_at_tickers
  before update on public.tickers
  for each row
  execute function moddatetime(updated_at);

-- bootstrap seed: a stable 20-ticker set with real CIKs so the EDGAR worker
-- has something to call against from day one. matches the prior TICKER_CATALOG
-- mock in src/features/watchlist/ticker-catalog.js. full russell 1000 follows
-- via supabase/seed.sql (db reset) or a one-off script run against the remote.
insert into public.tickers (symbol, name, cik, exchange, sector, industry, market_cap_class) values
  ('AAPL', 'Apple Inc.',                       '0000320193', 'NASDAQ', 'Information Technology', 'Technology Hardware, Storage & Peripherals', 'mega'),
  ('MSFT', 'Microsoft Corporation',            '0000789019', 'NASDAQ', 'Information Technology', 'Software',                                    'mega'),
  ('NVDA', 'NVIDIA Corporation',               '0001045810', 'NASDAQ', 'Information Technology', 'Semiconductors',                              'mega'),
  ('GOOG', 'Alphabet Inc. (Class C)',          '0001652044', 'NASDAQ', 'Communication Services', 'Interactive Media & Services',                'mega'),
  ('GOOGL','Alphabet Inc. (Class A)',          '0001652044', 'NASDAQ', 'Communication Services', 'Interactive Media & Services',                'mega'),
  ('AMZN', 'Amazon.com, Inc.',                 '0001018724', 'NASDAQ', 'Consumer Discretionary', 'Broadline Retail',                            'mega'),
  ('META', 'Meta Platforms, Inc.',             '0001326801', 'NASDAQ', 'Communication Services', 'Interactive Media & Services',                'mega'),
  ('TSLA', 'Tesla, Inc.',                      '0001318605', 'NASDAQ', 'Consumer Discretionary', 'Automobile Manufacturers',                    'mega'),
  ('AMD',  'Advanced Micro Devices, Inc.',     '0000002488', 'NASDAQ', 'Information Technology', 'Semiconductors',                              'large'),
  ('AVGO', 'Broadcom Inc.',                    '0001730168', 'NASDAQ', 'Information Technology', 'Semiconductors',                              'mega'),
  ('NFLX', 'Netflix, Inc.',                    '0001065280', 'NASDAQ', 'Communication Services', 'Entertainment',                               'large'),
  ('CRM',  'Salesforce, Inc.',                 '0001108524', 'NYSE',   'Information Technology', 'Software',                                    'large'),
  ('ORCL', 'Oracle Corporation',               '0001341439', 'NYSE',   'Information Technology', 'Software',                                    'large'),
  ('ADBE', 'Adobe Inc.',                       '0000796343', 'NASDAQ', 'Information Technology', 'Software',                                    'large'),
  ('INTC', 'Intel Corporation',                '0000050863', 'NASDAQ', 'Information Technology', 'Semiconductors',                              'large'),
  ('COST', 'Costco Wholesale Corporation',     '0000909832', 'NASDAQ', 'Consumer Staples',       'Consumer Staples Merchandise Retail',         'large'),
  ('WMT',  'Walmart Inc.',                     '0000104169', 'NYSE',   'Consumer Staples',       'Consumer Staples Merchandise Retail',         'mega'),
  ('JPM',  'JPMorgan Chase & Co.',             '0000019617', 'NYSE',   'Financials',             'Diversified Banks',                           'mega'),
  ('BAC',  'Bank of America Corporation',      '0000070858', 'NYSE',   'Financials',             'Diversified Banks',                           'large'),
  ('V',    'Visa Inc.',                        '0001403161', 'NYSE',   'Financials',             'Transaction & Payment Processing Services',   'mega')
on conflict (symbol) do nothing;
