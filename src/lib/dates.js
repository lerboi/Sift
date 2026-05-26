// pure date helpers for the event-timeline UI. no React, no platform deps.
// mock timestamps use unmarked iso ("2026-05-22T16:00:00") so they parse as
// local-time and display the same hours regardless of device tz.

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS   = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function startOfLocalDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dayKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysFromTo(from, to) {
  return Math.round((startOfLocalDay(to) - startOfLocalDay(from)) / 86400000);
}

// returns { relative, absolute, weekday, diff }
//   relative: "TODAY" | "YESTERDAY" | "TOMORROW" | weekday ("WED")
//   absolute: "MAY 26"
//   weekday:  "WED"
//   diff:     whole-day offset from `now` (negative = past)
export function formatDayHeader(iso, { now = new Date() } = {}) {
  const d = new Date(iso);
  const diff = daysFromTo(now, d);
  const weekday = WEEKDAYS[d.getDay()];
  const absolute = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  let relative;
  if (diff === 0) relative = 'TODAY';
  else if (diff === -1) relative = 'YESTERDAY';
  else if (diff === 1) relative = 'TOMORROW';
  else relative = weekday;
  return { relative, absolute, weekday, diff };
}

// "4:02 PM ET" — ET label is product convention (us equities only)
export function formatEventTime(iso) {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm} ET`;
}

// "just now" | "Nm ago" | "Nh ago" | "Nd ago" | absolute (e.g. "MAY 22")
// used for the "filed Nm ago" ribbon on live cards and similar past-recent metadata.
export function formatRelativePast(iso, { now = new Date() } = {}) {
  const ms = now.getTime() - new Date(iso).getTime();
  if (ms < 0) return formatEventTime(iso);
  const s = Math.floor(ms / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return formatDayHeader(iso, { now }).absolute;
}

// returns "Pre-market" | "After close" | null
export function formatMarketAnchor(iso) {
  const d = new Date(iso);
  const mins = d.getHours() * 60 + d.getMinutes();
  if (mins < 9 * 60 + 30) return 'Pre-market';
  if (mins >= 16 * 60) return 'After close';
  return null;
}

// groups events by local day, sorts items within a day by time ascending,
// orders groups: future ascending → past descending (today pivots).
// returns [{ dateISO, dayInfo, items }]
export function groupByDay(events, { now = new Date() } = {}) {
  const buckets = new Map();
  for (const e of events) {
    const iso = e.actualAt || e.expectedAt;
    if (!iso) continue;
    const d = new Date(iso);
    const key = dayKey(d);
    if (!buckets.has(key)) {
      buckets.set(key, { dateISO: key, _date: startOfLocalDay(d), items: [] });
    }
    buckets.get(key).items.push(e);
  }

  const groups = Array.from(buckets.values());
  for (const g of groups) {
    g.items.sort((a, b) => {
      const ai = new Date(a.actualAt || a.expectedAt).getTime();
      const bi = new Date(b.actualAt || b.expectedAt).getTime();
      return ai - bi;
    });
    g.dayInfo = formatDayHeader(g._date.toISOString(), { now });
    g.diff = g.dayInfo.diff;
    delete g._date;
  }

  groups.sort((a, b) => {
    const af = a.diff >= 0, bf = b.diff >= 0;
    if (af && !bf) return -1;
    if (!af && bf) return 1;
    if (af) return a.diff - b.diff;
    return b.diff - a.diff;
  });

  return groups;
}
