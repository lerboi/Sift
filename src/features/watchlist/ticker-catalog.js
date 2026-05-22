// mock searchable ticker list — replace with supabase `tickers` table query
export const TICKER_CATALOG = [
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

export function searchCatalog(query, excludeSymbols = []) {
  const q = query.trim().toUpperCase();
  const exclude = new Set(excludeSymbols);
  return TICKER_CATALOG.filter((t) => {
    if (exclude.has(t.symbol)) return false;
    if (q === '') return true;
    return t.symbol.startsWith(q) || t.name.toUpperCase().includes(q);
  }).slice(0, 12);
}
