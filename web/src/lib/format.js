const DAY = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });
const CLOCK = new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });

export const fmtDay = (d) => DAY.format(d);
export const fmtClock = (d) => CLOCK.format(d);
export const fmtStamp = (d) => `${DAY.format(d)} · ${CLOCK.format(d)}`;

export function fmtDuration(steps, stepMinutes = 10) {
  const m = steps * stepMinutes;
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

export function fmtNum(v, digits = 1) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return Number(v).toFixed(digits);
}

export const pct = (v, digits = 1) => `${(v * 100).toFixed(digits)}%`;
