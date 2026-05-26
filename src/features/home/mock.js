// mock until backend exists. delete in one shot when wiring real data.
// flat list — every item has a `state` ('upcoming' | 'live' | 'past') so
// <EventTimelineCard> can render directly without consumer-side bucketing.
import { getCompanyName } from '../watchlist/ticker-catalog';

function entry(e) {
  return { ...e, name: getCompanyName(e.ticker) };
}

export const MOCK_HOME_EVENTS = [
  entry({
    state: 'live',
    ticker: 'TSLA',
    period: 'Q1 26',
    expectedAt: '2026-05-22T16:00:00',
    actualAt:   '2026-05-22T15:56:00',
    epsActual: 0.78,
    epsEst: 0.71,
    surprisePct: 0.099,
    briefingReady: true,
  }),
  entry({
    state: 'upcoming',
    ticker: 'AAPL',
    period: 'Q1 26',
    expectedAt: '2026-05-22T16:00:00',
    epsEst: 1.98,
    beatProb: 0.65,
    briefingReady: true,
  }),
  entry({
    state: 'upcoming',
    ticker: 'MSFT',
    period: 'Q2 26',
    expectedAt: '2026-05-25T16:00:00', // r1b: was sat may 23 (weekend); moved to mon
    epsEst: 3.12,
    beatProb: 0.58,
    briefingReady: false,
  }),
  entry({
    state: 'upcoming',
    ticker: 'NVDA',
    period: 'Q1 26',
    expectedAt: '2026-05-27T16:00:00',
    epsEst: 0.84,
    beatProb: 0.71,
    briefingReady: true,
  }),
  entry({
    state: 'upcoming',
    ticker: 'GOOG',
    period: 'Q1 26',
    expectedAt: '2026-05-28T16:00:00',
    epsEst: 2.15,
    beatProb: 0.49,
    briefingReady: false,
  }),
  entry({
    state: 'past',
    ticker: 'META',
    period: 'Q4 25',
    expectedAt: '2026-05-21T16:00:00',
    actualAt:   '2026-05-21T16:00:00',
    epsActual: 6.43,
    epsEst: 6.21,
    surprisePct: 0.035,
    guidance: { direction: 'maintained', detail: 'FY guidance unchanged' },
  }),
  entry({
    state: 'past',
    ticker: 'AMZN',
    period: 'Q4 25',
    expectedAt: '2026-05-21T16:00:00',
    actualAt:   '2026-05-21T15:55:00',
    epsActual: 1.14,
    epsEst: 1.18,
    surprisePct: -0.034,
    guidance: { direction: 'lowered', detail: 'AWS margin guide trimmed' },
  }),
];

// a single new event that arrives ~5s after first load (live, AMD beat)
export const MOCK_PENDING_EVENT = entry({
  state: 'live',
  ticker: 'AMD',
  period: 'Q1 26',
  expectedAt: '2026-05-22T16:00:00',
  actualAt:   '2026-05-22T16:14:00',
  epsActual: 1.12,
  epsEst: 0.98,
  surprisePct: 0.143,
  briefingReady: false,
});
