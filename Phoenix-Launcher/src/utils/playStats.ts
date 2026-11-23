import type { PlayLogEntry } from './prefs';

export interface PlayStats {
  streak: number; // days in a row (counting back from today, or yesterday if today has no play yet)
  bestStreak: number;
  longestSessionMin: number;
  sessions: number;
  avgPerDayMin: number; // over the last 30 days
  busiestDay: string; // "Saturday"
  favouriteId: string; // instance id played most in the last 30 days
  last14: { label: string; minutes: number }[]; // oldest first
}

const DAY = 24 * 3600 * 1000;
const dayKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

export function computeStats(log: PlayLogEntry[], now = Date.now()): PlayStats {
  const perDay = new Map<string, number>();
  const perWeekday = new Array(7).fill(0) as number[];
  const perInstance = new Map<string, number>();
  let longest = 0;
  let last30 = 0;
  for (const e of log) {
    perDay.set(dayKey(e.t), (perDay.get(dayKey(e.t)) ?? 0) + e.m);
    perWeekday[new Date(e.t).getDay()] += e.m;
    longest = Math.max(longest, e.m);
    if (e.t >= now - 30 * DAY) {
      last30 += e.m;
      perInstance.set(e.id, (perInstance.get(e.id) ?? 0) + e.m);
    }
  }

  let streak = 0;
  let cursor = now;
  if (!perDay.has(dayKey(cursor))) cursor -= DAY; // today may simply not have started yet
  while (perDay.has(dayKey(cursor))) {
    streak++;
    cursor -= DAY;
  }

  let bestStreak = 0;
  let run = 0;
  const days = [...perDay.keys()].length ? log.map((e) => e.t).sort((a, b) => a - b) : [];
  let prev = '';
  for (const t of days) {
    const k = dayKey(t);
    if (k === prev) continue;
    run = prev && dayKey(t - DAY) === prev ? run + 1 : 1;
    prev = k;
    bestStreak = Math.max(bestStreak, run);
  }

  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const top = perWeekday.indexOf(Math.max(...perWeekday));
  let favouriteId = '';
  let favMin = 0;
  for (const [id, m] of perInstance) if (m > favMin) { favMin = m; favouriteId = id; }

  const last14 = [];
  for (let i = 13; i >= 0; i--) {
    const t = now - i * DAY;
    last14.push({ label: String(new Date(t).getDate()), minutes: perDay.get(dayKey(t)) ?? 0 });
  }

  return {
    streak,
    bestStreak,
    longestSessionMin: longest,
    sessions: log.length,
    avgPerDayMin: Math.round(last30 / 30),
    busiestDay: log.length ? names[top] : '-',
    favouriteId,
    last14,
  };
}
