// mock until backend exists
export const MOCK_EVENTS = [
  { id: 'e1', ticker: 'AAPL', period: 'Q4 25', dateLabel: 'TODAY',     when: '4:02 PM ET',  epsActual: 2.14, epsEst: 1.98, surprisePct: 0.081,  onWatchlist: true },
  { id: 'e2', ticker: 'NVDA', period: 'Q1 26', dateLabel: 'TODAY',     when: '3:55 PM ET',  epsActual: 0.92, epsEst: 0.84, surprisePct: 0.095,  onWatchlist: true },
  { id: 'e3', ticker: 'GS',   period: 'Q1 26', dateLabel: 'TODAY',     when: '8:30 AM ET',  epsActual: 8.21, epsEst: 7.95, surprisePct: 0.033,  onWatchlist: false },
  { id: 'e4', ticker: 'NFLX', period: 'Q1 26', dateLabel: 'YESTERDAY', when: '4:05 PM ET',  epsActual: 5.42, epsEst: 5.55, surprisePct: -0.023, onWatchlist: false },
  { id: 'e5', ticker: 'META', period: 'Q4 25', dateLabel: 'YESTERDAY', when: '4:00 PM ET',  epsActual: 6.43, epsEst: 6.21, surprisePct: 0.035,  onWatchlist: false },
  { id: 'e6', ticker: 'AMZN', period: 'Q4 25', dateLabel: 'YESTERDAY', when: '3:55 PM ET',  epsActual: 1.14, epsEst: 1.18, surprisePct: -0.034, onWatchlist: false },
  { id: 'e7', ticker: 'JPM',  period: 'Q1 26', dateLabel: 'MAY 19',    when: '7:00 AM ET',  epsActual: 4.40, epsEst: 4.41, surprisePct: -0.002, onWatchlist: false },
  { id: 'e8', ticker: 'MSFT', period: 'Q2 26', dateLabel: 'MAY 19',    when: '4:00 PM ET',  epsActual: 3.40, epsEst: 3.12, surprisePct: 0.090,  onWatchlist: true },
];

export function classify(p) {
  if (p > 0.005) return 'beat';
  if (p < -0.005) return 'miss';
  return 'inline';
}

export function filterEvents(events, scope, outcome, query = '') {
  const q = query.trim().toUpperCase();
  return events.filter((e) => {
    if (scope === 'watchlist' && !e.onWatchlist) return false;
    if (outcome !== 'all' && classify(e.surprisePct) !== outcome) return false;
    if (q && !e.ticker.startsWith(q)) return false;
    return true;
  });
}

export function groupByDate(events) {
  const groups = {};
  for (const e of events) {
    if (!groups[e.dateLabel]) groups[e.dateLabel] = [];
    groups[e.dateLabel].push(e);
  }
  return Object.entries(groups).map(([label, items]) => ({ label, items }));
}
