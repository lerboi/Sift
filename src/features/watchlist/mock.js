// MOCK_WATCHLIST removed in B3 — watchlist now reads from supabase view.
// groupByWeek kept; unused at the moment but mirrors a planned sort/group
// option for the watchlist screen ("group by reporting week").

export function groupByWeek(items) {
  const groups = [
    { label: 'THIS WEEK', items: [] },
    { label: 'NEXT WEEK', items: [] },
    { label: 'LATER',     items: [] },
  ];
  items.forEach((item) => {
    const d = item.nextEarnings?.daysAway ?? 9999;
    if (d < 7) groups[0].items.push(item);
    else if (d < 14) groups[1].items.push(item);
    else groups[2].items.push(item);
  });
  return groups.filter((g) => g.items.length > 0);
}
