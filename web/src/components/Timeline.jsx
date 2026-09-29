import { Pause, Play } from 'lucide-react';
import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { CLS_META } from '../lib/data';
import { fmtClock, fmtDay } from '../lib/format';
import { SPEEDS } from '../lib/useReplay';

export default function Timeline({ data, replay }) {
  const { t, playing, speed, setSpeed, seek, toggle } = replay;
  const total = data.steps;
  const now = data.time(t);

  const days = useMemo(() => {
    const out = [];
    const perDay = data.stepsPerHour * 24;
    for (let i = 0; i < total; i += perDay) out.push({ i, label: fmtDay(data.time(i)) });
    return out;
  }, [data, total]);

  // Incidents drawn as ticks on the track; the long ones as bars.
  const marks = useMemo(
    () =>
      data.incidents
        .filter((x) => x.cls === 1 || x.cls === 2 || x.cls === 3)
        .map((x) => ({
          ...x,
          left: (x.start / (total - 1)) * 100,
          width: Math.max(0.25, ((x.end - x.start + 1) / (total - 1)) * 100),
        })),
    [data, total]
  );

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          aria-label={playing ? 'Pause replay' : 'Play replay'}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-white shadow-pill transition-transform duration-300 active:scale-95"
        >
          {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
        </button>
        <div className="flex rounded-full border hairline-2 p-0.5">
          {SPEEDS.map((s, i) => (
            <button
              key={s.label}
              onClick={() => setSpeed(i)}
              className="relative h-8 rounded-full px-3 font-mono text-[12px] text-ink-2"
            >
              {speed === i && (
                <motion.span layoutId="speed-pill" className="absolute inset-0 rounded-full bg-paper-2" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />
              )}
              <span className={`relative ${speed === i ? 'text-ink' : ''}`}>{s.label}</span>
            </button>
          ))}
        </div>
        <div className="min-w-[118px] font-mono text-[13px] tabular text-ink sm:hidden">
          {fmtDay(now)} · {fmtClock(now)}
        </div>
      </div>

      <div className="relative flex-1">
        <div className="pointer-events-none absolute inset-x-0 top-[10px] h-2 rounded-full bg-paper-2">
          {marks.map((m) => (
            <span
              key={m.id}
              className="absolute top-0 h-2 rounded-[1px]"
              style={{
                left: `${m.left}%`,
                width: `${m.width}%`,
                background: CLS_META[m.cls].color,
                opacity: m.start <= t ? 0.85 : 0.18,
                transition: 'opacity 300ms',
              }}
            />
          ))}
        </div>
        <input
          type="range"
          className="scrub relative"
          min={0}
          max={total - 1}
          value={t}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="Replay position"
        />
        <div className="relative mt-1 h-4 font-mono text-[10px] text-ink-3">
          {days.map((d, k) =>
            k % 2 === 0 ? (
              <span key={d.i} className={`absolute ${k === 0 ? '' : '-translate-x-1/2'}`} style={{ left: `${(d.i / (total - 1)) * 100}%` }}>
                {d.label}
              </span>
            ) : null
          )}
        </div>
      </div>

      <div className="hidden min-w-[128px] text-right sm:block">
        <div className="font-mono text-[13px] tabular text-ink">{fmtClock(now)}</div>
        <div className="text-[12px] text-ink-3">{fmtDay(now)} 2026</div>
      </div>
    </div>
  );
}
