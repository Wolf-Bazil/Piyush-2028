import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { CLS } from '../lib/data';
import { fmtNum } from '../lib/format';

const W = 320;
const H = 86;
const PX = 2;
const PY = 8;

// One sensor's last 24 hours up to the replay cursor. Bands mark steps the
// detector flagged; dots mark the exact readings it blamed on this sensor.
export default function Sparkline({ values, verdicts, blamed, label, unit, digits = 1 }) {
  const gid = label.replace(/\W+/g, '-').toLowerCase();
  const { path, area, dots, bands, lo, hi, current } = useMemo(() => {
    const finite = values.filter((v) => v !== null && v !== undefined);
    let lo = Math.min(...finite);
    let hi = Math.max(...finite);
    if (!finite.length) {
      lo = 0;
      hi = 1;
    }
    if (hi - lo < 1e-6) {
      hi += 1;
      lo = lo >= 0 ? Math.max(0, lo - 0.2) : lo - 1;
    }
    const n = values.length;
    const x = (i) => PX + (i / Math.max(1, n - 1)) * (W - PX * 2);
    const y = (v) => PY + (1 - (v - lo) / (hi - lo)) * (H - PY * 2);

    let path = '';
    let area = '';
    let pen = false;
    let segStart = null;
    values.forEach((v, i) => {
      if (v === null || v === undefined) {
        if (pen && segStart !== null) area += `L${x(i - 1)},${H} L${x(segStart)},${H} Z `;
        pen = false;
        segStart = null;
        return;
      }
      path += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
      area += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
      if (!pen) segStart = i;
      pen = true;
    });
    if (pen && segStart !== null) area += `L${x(n - 1)},${H} L${x(segStart)},${H} Z`;

    const bands = [];
    let run = null;
    verdicts.forEach((c, i) => {
      const flagged = c === CLS.FAULT || c === CLS.WEATHER || c === CLS.MISSING;
      if (flagged && run && run.c === c) run.end = i;
      else {
        if (run) bands.push(run);
        run = flagged ? { c, start: i, end: i } : null;
      }
    });
    if (run) bands.push(run);

    const dots = [];
    values.forEach((v, i) => {
      if (blamed[i] && v !== null && v !== undefined) dots.push({ x: x(i), y: y(v), c: verdicts[i] });
    });

    return {
      path,
      area,
      dots,
      bands: bands.map((b) => ({ ...b, x0: x(b.start) - 1, x1: x(b.end) + 1 })),
      lo,
      hi,
      current: values[values.length - 1],
    };
  }, [values, verdicts, blamed]);

  const blamedNow = blamed[blamed.length - 1];
  const nowCls = verdicts[verdicts.length - 1];
  const tone = blamedNow ? (nowCls === CLS.WEATHER ? 'text-weather' : 'text-fault') : 'text-ink';

  return (
    <div className="glass rounded-xl p-3.5">
      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
        <span className="text-[12px] font-medium text-ink-2">{label}</span>
        <span className={`font-mono text-[15px] font-medium tabular ${tone} transition-colors duration-300`}>
          {current === null || current === undefined ? 'no data' : fmtNum(current, digits)}
          <span className="ml-1 text-[11px] font-normal text-ink-3">{current === null || current === undefined ? '' : unit}</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 block h-[86px] w-full" preserveAspectRatio="none">
        {bands.map((b, i) => (
          <rect
            key={i}
            x={b.x0}
            y={0}
            width={Math.max(2, b.x1 - b.x0)}
            height={H}
            fill={b.c === CLS.WEATHER ? 'rgba(45,212,239,0.08)' : b.c === CLS.FAULT ? 'rgba(255,91,107,0.08)' : 'rgba(107,116,130,0.10)'}
          />
        ))}
        <defs>
          <linearGradient id={`area-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2dd4ef" stopOpacity="0.22" />
            <stop offset="1" stopColor="#2dd4ef" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`line-${gid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#8b7cff" stopOpacity="0.5" />
            <stop offset="1" stopColor="#2dd4ef" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#area-${gid})`} />
        <path d={path} fill="none" stroke={`url(#line-${gid})`} strokeWidth="1.4" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r="2.4" fill={d.c === CLS.WEATHER ? '#2dd4ef' : '#ff5b6b'} vectorEffect="non-scaling-stroke" />
        ))}
        <line x1={W - PX} x2={W - PX} y1={0} y2={H} stroke="rgba(255,255,255,0.25)" strokeDasharray="2 3" />
      </svg>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-ink-3 tabular">
        <span>−24 h</span>
        <span>
          {fmtNum(lo, digits)}–{fmtNum(hi, digits)}
        </span>
        <motion.span key={String(blamedNow)} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          now
        </motion.span>
      </div>
    </div>
  );
}
