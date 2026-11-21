import type { PlayLogEntry } from './prefs';

export interface Achievement {
  id: string;
  title: string;
  text: string;
  done: boolean;
  /** 0..1 progress toward the goal */
  progress: number;
}

const DAY = 86400000;

function longestStreak(days: number[]): number {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let prev = -10;
  for (const d of sorted) {
    run = d === prev + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

/** Badges computed from the play log, so they work offline and cost nothing. */
export function computeAchievements(log: PlayLogEntry[]): Achievement[] {
  const sessions = log.length;
  const total = log.reduce((n, e) => n + e.m, 0);
  const longest = log.reduce((n, e) => Math.max(n, e.m), 0);
  const profiles = new Set(log.map((e) => e.id)).size;
  const night = log.some((e) => {
    const h = new Date(e.t).getHours();
    return h >= 0 && h < 5;
  });
  const streak = longestStreak(log.map((e) => Math.floor((e.t - new Date(e.t).getTimezoneOffset() * 60000) / DAY)));
  const mk = (id: string, title: string, text: string, value: number, goal: number): Achievement => ({
    id,
    title,
    text,
    done: value >= goal,
    progress: Math.max(0, Math.min(1, value / goal)),
  });
  return [
    mk('first', 'First flame', 'Start the game once from Phoenix.', sessions, 1),
    mk('regular', 'Regular', 'Play 10 sessions.', sessions, 10),
    mk('veteran', 'Veteran', 'Play 50 sessions.', sessions, 50),
    mk('hour', 'One hour in', 'Play for 1 hour in total.', total, 60),
    mk('ten', 'Ten hours', 'Play for 10 hours in total.', total, 600),
    mk('fifty', 'Fifty hours', 'Play for 50 hours in total.', total, 3000),
    mk('marathon', 'Marathon', 'One session of 2 hours or more.', longest, 120),
    mk('streak', 'On a roll', 'Play on 3 days in a row.', streak, 3),
    mk('explorer', 'Explorer', 'Play 3 different profiles.', profiles, 3),
    mk('owl', 'Night owl', 'Finish a session between midnight and 5 am.', night ? 1 : 0, 1),
  ];
}
