// mock until backend exists. event timestamps now carry expectedAt/actualAt
// (ISO8601, local-time). briefings/transcripts gain timestamp fields in a
// follow-up tick (R6 sub-item) when the ticker timeline rewrite needs them.
const SECTORS = {
  AAPL: 'Technology',
  MSFT: 'Technology',
  NVDA: 'Semiconductors',
  GOOG: 'Communication Services',
  META: 'Communication Services',
  AMZN: 'Consumer Discretionary',
  TSLA: 'Consumer Discretionary',
  AMD: 'Semiconductors',
};

const NAMES = {
  AAPL: 'Apple Inc.',
  MSFT: 'Microsoft Corporation',
  NVDA: 'NVIDIA Corporation',
  GOOG: 'Alphabet Inc.',
  META: 'Meta Platforms Inc.',
  AMZN: 'Amazon.com, Inc.',
  TSLA: 'Tesla, Inc.',
  AMD: 'Advanced Micro Devices, Inc.',
};

// stable per-ticker sparkline (30 days)
function fakeSeries(ticker) {
  let seed = 0;
  for (let i = 0; i < ticker.length; i++) seed = (seed * 31 + ticker.charCodeAt(i)) & 0xffff;
  const out = [];
  let v = 100;
  for (let i = 0; i < 30; i++) {
    seed = (seed * 9301 + 49297) & 0xffff;
    const delta = ((seed % 100) - 50) / 50; // -1..+1
    v += delta;
    out.push(v);
  }
  return out;
}

export function getTickerMock(ticker) {
  const symbol = String(ticker).toUpperCase();
  return {
    symbol,
    name: NAMES[symbol] ?? `${symbol} Corp.`,
    sector: SECTORS[symbol] ?? 'Unknown',
    sparkline: fakeSeries(symbol),
    nextEarnings: {
      period: 'Q1 26',
      when: 'in 2h',
      expectedAt: '2026-05-22T16:00:00',
      epsEst: 1.98,
      beatProb: 0.65,
    },
    transcripts: [
      {
        id: 't3',
        period: 'Q3 25 call',
        date: 'Nov 1, 2025',
        recordedAt: '2025-11-01T17:00:00',
        tone: 'neutral',
        novelTopics: ['foundry diversification', 'services pricing power'],
        snippet:
          'Beat by 8.1%. Tone notably more cautious on China demand vs Q2; raised FY guidance midpoint by $0.10. Analysts pushed three times on the AI roadmap without commitment.',
      },
      {
        id: 't2',
        period: 'Q2 25 call',
        date: 'Aug 1, 2025',
        recordedAt: '2025-08-01T17:00:00',
        tone: 'bullish',
        novelTopics: ['AI features as line item'],
        snippet:
          'Beat by 3.5%, miss on services revenue (–1.2%). Tone unchanged vs Q1. First mention of "AI features" as a distinct line item; refused to quantify hardware refresh impact.',
      },
      {
        id: 't1',
        period: 'Q1 25 call',
        date: 'May 2, 2025',
        recordedAt: '2025-05-02T17:00:00',
        tone: 'bearish',
        novelTopics: [],
        snippet:
          'In-line print, guidance trimmed at low end. Defensive language on services, several "we expect headwinds" formulations. No new strategic initiatives flagged.',
      },
    ],
    pastEvents: [
      { id: 'e4', period: 'Q3 25', date: 'Nov 1, 2025', expectedAt: '2025-11-01T16:00:00', actualAt: '2025-11-01T16:02:00', epsActual: 2.18, epsEst: 2.10, surprisePct: 0.038 },
      { id: 'e3', period: 'Q2 25', date: 'Aug 1, 2025', expectedAt: '2025-08-01T16:00:00', actualAt: '2025-08-01T16:01:00', epsActual: 1.40, epsEst: 1.39, surprisePct: 0.007 },
      { id: 'e2', period: 'Q1 25', date: 'May 2, 2025', expectedAt: '2025-05-02T16:00:00', actualAt: '2025-05-02T16:00:00', epsActual: 1.53, epsEst: 1.50, surprisePct: 0.020 },
      { id: 'e1', period: 'Q4 24', date: 'Feb 1, 2025', expectedAt: '2025-02-01T16:00:00', actualAt: '2025-02-01T16:03:00', epsActual: 2.40, epsEst: 2.10, surprisePct: 0.143 },
      { id: 'e0', period: 'Q3 24', date: 'Nov 2, 2024', expectedAt: '2024-11-02T16:00:00', actualAt: '2024-11-02T16:00:00', epsActual: 1.64, epsEst: 1.60, surprisePct: 0.025 },
    ],
    pastBriefings: [
      {
        id: 'b3',
        title: 'Q4 25 pre-earnings briefing',
        date: 'Feb 1, 2026',
        publishedAt: '2026-02-01T09:00:00',
        content:
          'Consensus EPS $1.98, revenue $122.4B. Five-quarter beat streak; last call guidance was for high single-digit services growth. Watch for iPhone unit commentary given the new India lineup, and gross margin trajectory now that the foundry mix has shifted. Options market implies a ±4.1% move.',
      },
      {
        id: 'b2',
        title: 'Q3 25 post-call summary',
        date: 'Nov 2, 2025',
        publishedAt: '2025-11-02T09:00:00',
        content:
          'Beat EPS by 8.1%, beat revenue by 1.7%. Tone notably more cautious on China demand vs Q2; raised FY guidance midpoint by $0.10. Novel topics: foundry diversification, services pricing power. No mention of generative AI roadmap — analysts pushed three times without commitment.',
      },
      {
        id: 'b1',
        title: 'Q2 25 post-call summary',
        date: 'Aug 1, 2025',
        publishedAt: '2025-08-02T09:00:00',
        content:
          'Beat EPS by 3.5%, miss on services revenue (–1.2%). Tone unchanged vs Q1. Guidance: in-line with consensus. Notable: first mention of "AI features" as a distinct line item; refused to quantify hardware refresh impact.',
      },
    ],
  };
}
