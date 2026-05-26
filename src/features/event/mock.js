// mock until backend exists. delete this file in one shot when wiring real data.
// expectedAt = scheduled report time; actualAt = filing time (2 min lag here).
// filedAt/detectedAt/pushedAt strings retained for the timeline strip ui.
export function getEventMock(id) {
  const upper = String(id ?? '').toUpperCase();
  return {
    id: upper,
    ticker: 'AAPL',
    period: 'Q4 25',
    expectedAt: '2026-02-01T16:00:00',
    actualAt:   '2026-02-01T16:02:00',
    filedAt: 'Feb 1, 2026 · 4:02 PM ET',
    detectedAt: '4:02:08 PM ET',
    pushedAt: '4:02:14 PM ET',
    epsActual: 2.14,
    epsEst: 1.98,
    surprisePct: 0.081,
    revenueActual: 124.3,
    revenueEst: 122.4,
    revenueSurprisePct: 0.0155,
    guidance: {
      direction: 'raised',
      detail: 'FY guidance midpoint raised by $0.10',
    },
    segments: [
      { name: 'Services', actual: 24.5, est: 23.8 },
      { name: 'iPhone', actual: 67.1, est: 66.0 },
      { name: 'Wearables', actual: 11.9, est: 12.3 },
    ],
    exhibitUrl: 'https://www.sec.gov/Archives/edgar/data/0000320193/000032019326000010/aapl-20260128.htm',
  };
}
