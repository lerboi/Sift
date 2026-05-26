// mock until backend exists. all copy here is compliance-sensitive — see
// redesign-2026-05-22.md § "Open uncertainties" for the rationale on
// "Model" prefixes and "expected" qualifiers on predictions.

// model-driven predictions for upcoming reports — cross-market, not just watchlist
export const MOCK_BIGGEST_EXPECTED = [
  { ticker: 'NVDA', name: 'NVIDIA Corporation', period: 'Q1 26', expectedAt: '2026-05-27T16:00:00', beatProb: 0.71, expectedMovePct: 0.052 },
  { ticker: 'AAPL', name: 'Apple Inc.',         period: 'Q1 26', expectedAt: '2026-05-22T16:00:00', beatProb: 0.65, expectedMovePct: 0.031 },
  { ticker: 'CRWD', name: 'CrowdStrike Holdings', period: 'Q1 26', expectedAt: '2026-05-28T16:00:00', beatProb: 0.62, expectedMovePct: 0.075 },
  { ticker: 'GOOG', name: 'Alphabet Inc.',      period: 'Q1 26', expectedAt: '2026-05-28T16:00:00', beatProb: 0.49, expectedMovePct: 0.028 },
];

// raw counts of reporters by sector this week — no model involvement
export const MOCK_SECTOR_HEAT = [
  { sector: 'Technology',             reporting: 12 },
  { sector: 'Consumer Discretionary', reporting:  7 },
  { sector: 'Financials',             reporting:  5 },
  { sector: 'Healthcare',             reporting:  3 },
  { sector: 'Industrials',            reporting:  2 },
];

// actual results across the market — no predictions, just historical record
export const MOCK_BIGGEST_SURPRISES = [
  { ticker: 'CRWD', name: 'CrowdStrike Holdings',   period: 'Q4 25', actualAt: '2026-05-21T16:00:00', surprisePct:  0.184, id: 'discover-crwd-q4' },
  { ticker: 'AMD',  name: 'Advanced Micro Devices', period: 'Q1 26', actualAt: '2026-05-21T16:00:00', surprisePct: -0.082, id: 'discover-amd-q1'  },
  { ticker: 'INTC', name: 'Intel Corporation',      period: 'Q1 26', actualAt: '2026-05-20T16:00:00', surprisePct: -0.063, id: 'discover-intc-q1' },
  { ticker: 'NFLX', name: 'Netflix, Inc.',          period: 'Q1 26', actualAt: '2026-05-21T16:00:00', surprisePct:  0.121, id: 'discover-nflx-q1' },
];
