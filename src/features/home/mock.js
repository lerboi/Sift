// mock until backend exists. delete this file in one shot when wiring real data.
export const MOCK_LIVE = [
  {
    ticker: 'TSLA',
    period: 'Q1 26',
    when: '4m ago',
    epsActual: 0.78,
    epsEst: 0.71,
    surprisePct: 0.099,
    isLive: true,
  },
];

export const MOCK_UPCOMING = [
  { ticker: 'AAPL', period: 'Q1 26', when: 'in 2h',    epsEst: 1.98, beatProb: 0.65, briefingReady: true  },
  { ticker: 'MSFT', period: 'Q2 26', when: 'tomorrow', epsEst: 3.12, beatProb: 0.58, briefingReady: false },
  { ticker: 'NVDA', period: 'Q1 26', when: 'wed',      epsEst: 0.84, beatProb: 0.71, briefingReady: true  },
  { ticker: 'GOOG', period: 'Q1 26', when: 'thu',      epsEst: 2.15, beatProb: 0.49, briefingReady: false },
];

export const MOCK_RECENT = [
  {
    ticker: 'META',
    period: 'Q4 25',
    when: 'yesterday',
    epsActual: 6.43,
    epsEst: 6.21,
    surprisePct: 0.035,
  },
  {
    ticker: 'AMZN',
    period: 'Q4 25',
    when: 'yesterday',
    epsActual: 1.14,
    epsEst: 1.18,
    surprisePct: -0.034,
  },
];
