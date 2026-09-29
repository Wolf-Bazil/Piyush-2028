import { AnimatePresence, motion } from 'framer-motion';
import { CLS, CLS_META, PARAM_META } from '../lib/data';
import { fmtClock, fmtDay, fmtDuration } from '../lib/format';
import { EASE } from './ui';

const LIMIT = 12;

export default function AlertFeed({ data, t, onSelect, filter }) {
  const seen = data.incidents.filter((x) => x.start <= t && (filter === 'all' || x.cls === filter));
  const shown = seen.slice(-LIMIT).reverse();

  return (
    <div className="relative">
      <ul className="relative flex h-[420px] flex-col gap-2 overflow-y-auto overscroll-contain pr-1 lg:h-[468px] [scrollbar-width:thin]">
        <AnimatePresence initial={false}>
          {shown.map((x) => {
            const s = data.byId[x.station];
            const live = x.end >= t;
            const meta = CLS_META[x.cls];
            const steps = Math.min(x.end, t) - x.start + 1;
            return (
              <motion.li
                key={x.id}
                layout="position"
                initial={{ opacity: 0, y: -14, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
                transition={{ duration: 0.55, ease: EASE }}
              >
                <button
                  onClick={() => onSelect(x.station)}
                  className="group w-full rounded-xl border hairline bg-white/[0.03] px-3.5 py-3 text-left transition-colors hover:border-ink/20"
                >
                  <div className="flex items-center gap-2">
                    <span className="relative inline-flex h-2 w-2">
                      {live && <span className="absolute -inset-1 rounded-full breathe" style={{ background: meta.color }} />}
                      <span className="relative h-2 w-2 rounded-full" style={{ background: meta.color }} />
                    </span>
                    <span className="text-[13px] font-semibold text-ink">{s.name}</span>
                    <span className="text-[12px] font-medium" style={{ color: meta.color }}>
                      {meta.label}
                      {x.cls === CLS.FAULT && x.param !== '*' ? ` · ${PARAM_META[x.param]?.label.toLowerCase()}` : ''}
                    </span>
                    <span className="ml-auto font-mono text-[11px] text-ink-3 tabular">
                      {fmtDay(data.time(x.start))} {fmtClock(data.time(x.start))}
                    </span>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-snug text-ink-2">{x.reason}</p>
                  <p className="mt-1.5 font-mono text-[10.5px] uppercase tracking-wider text-ink-3">
                    {live ? 'ongoing · ' : ''}
                    {fmtDuration(steps, data.step_minutes)}
                  </p>
                </button>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
      {!shown.length && (
        <p className="absolute inset-x-0 top-0 rounded-xl border border-dashed hairline-2 px-4 py-8 text-center text-[13px] text-ink-3">
          No alerts yet. Press play.
        </p>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#0a0d13] to-transparent" />
      {seen.length > LIMIT && (
        <p className="mt-2 text-center text-[12px] text-ink-3">+{seen.length - LIMIT} earlier</p>
      )}
    </div>
  );
}
