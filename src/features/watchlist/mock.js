// mock until backend exists
function fakeSeries(seed) {
  const out = [];
  let v = 100;
  let s = seed;
  for (let i = 0; i < 30; i++) {
    s = (s * 9301 + 49297) & 0xffff;
    v += ((s % 100) - 50) / 50;
    out.push(v);
  }
  return out;
}

export const MOCK_WATCHLIST = [
  { symbol: 'AAPL', name: 'Apple Inc.',           nextEarnings: { period: 'Q1 26', date: 'May 28', daysAway: 6  }, sparkline: fakeSeries(11), briefingReady: true,  trend: 'up' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation',   nextEarnings: { period: 'Q1 26', date: 'May 27', daysAway: 5  }, sparkline: fakeSeries(13), briefingReady: true,  trend: 'up' },
  { symbol: 'TSLA', name: 'Tesla, Inc.',          nextEarnings: { period: 'Q2 26', date: 'May 29', daysAway: 7  }, sparkline: fakeSeries(17), briefingReady: false, trend: 'flat' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', nextEarnings: { period: 'Q2 26', date: 'Jun 3',  daysAway: 12 }, sparkline: fakeSeries(19), briefingReady: false, trend: 'up' },
  { symbol: 'GOOG', name: 'Alphabet Inc.',        nextEarnings: { period: 'Q1 26', date: 'Jun 10', daysAway: 19 }, sparkline: fakeSeries(23), briefingReady: false, trend: 'down' },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.',     nextEarnings: { period: 'Q1 26', date: 'Jun 14', daysAway: 23 }, sparkline: fakeSeries(29), briefingReady: false, trend: 'up' },
];

export function groupByWeek(items) {
  const groups = [
    { label: 'THIS WEEK', items: [] },
    { label: 'NEXT WEEK', items: [] },
    { label: 'LATER',     items: [] },
  ];
  items.forEach((item) => {
    const d = item.nextEarnings.daysAway;
    if (d < 7) groups[0].items.push(item);
    else if (d < 14) groups[1].items.push(item);
    else groups[2].items.push(item);
  });
  return groups.filter((g) => g.items.length > 0);
}
