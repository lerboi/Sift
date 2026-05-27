import { supabase } from '../../../lib/supabase';

// fallback list mirrors migration 004's bootstrap seed. used when supabase
// isn't reachable (offline, pre-migration apply) so the app still renders
// names and basic search.
const FALLBACK = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corporation' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation' },
  { symbol: 'GOOG', name: 'Alphabet Inc.' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.' },
  { symbol: 'META', name: 'Meta Platforms, Inc.' },
  { symbol: 'TSLA', name: 'Tesla, Inc.' },
  { symbol: 'AMD',  name: 'Advanced Micro Devices, Inc.' },
  { symbol: 'AVGO', name: 'Broadcom Inc.' },
  { symbol: 'NFLX', name: 'Netflix, Inc.' },
  { symbol: 'CRM',  name: 'Salesforce, Inc.' },
  { symbol: 'ORCL', name: 'Oracle Corporation' },
  { symbol: 'ADBE', name: 'Adobe Inc.' },
  { symbol: 'INTC', name: 'Intel Corporation' },
  { symbol: 'COST', name: 'Costco Wholesale Corporation' },
  { symbol: 'WMT',  name: 'Walmart Inc.' },
  { symbol: 'JPM',  name: 'JPMorgan Chase & Co.' },
  { symbol: 'BAC',  name: 'Bank of America Corporation' },
  { symbol: 'V',    name: 'Visa Inc.' },
];

// module-level cache; populated by searchTickers and prefetchCompanyNames.
const nameCache = new Map(FALLBACK.map((t) => [t.symbol, t.name]));

export function getCompanyName(symbol) {
  const s = String(symbol).toUpperCase();
  return nameCache.get(s) ?? `${s} Corp.`;
}

export async function searchTickers(query, excludeSymbols = [], limit = 12) {
  const trimmed = String(query || '').trim();
  const exclude = new Set(excludeSymbols);

  if (!trimmed) {
    return FALLBACK.filter((t) => !exclude.has(t.symbol)).slice(0, limit);
  }

  const upper = trimmed.toUpperCase();
  const { data, error } = await supabase
    .from('tickers')
    .select('symbol, name')
    .or(`symbol.ilike.${upper}%,name.ilike.%${trimmed}%`)
    .eq('is_active', true)
    .limit(limit + excludeSymbols.length);

  if (error || !data) {
    if (error && __DEV__) console.warn('[ticker-catalog] supabase search failed, falling back', error.message);
    return FALLBACK.filter((t) => {
      if (exclude.has(t.symbol)) return false;
      return t.symbol.startsWith(upper) || t.name.toUpperCase().includes(upper);
    }).slice(0, limit);
  }

  for (const t of data) nameCache.set(t.symbol, t.name);
  return data.filter((t) => !exclude.has(t.symbol)).slice(0, limit);
}

export async function prefetchCompanyNames(symbols) {
  if (!Array.isArray(symbols) || symbols.length === 0) return;
  const wanted = symbols
    .map((s) => String(s).toUpperCase())
    .filter((s) => !nameCache.has(s));
  if (wanted.length === 0) return;
  const { data, error } = await supabase
    .from('tickers')
    .select('symbol, name')
    .in('symbol', wanted);
  if (error || !data) return;
  for (const t of data) nameCache.set(t.symbol, t.name);
}
