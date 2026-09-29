import { AnimatePresence, motion } from 'framer-motion';
import { useMemo } from 'react';
import { PARAM_META, maintenanceAt } from '../lib/data';
import { fmtNum, fmtStamp } from '../lib/format';
import { Card, EASE, Reveal, SectionHead, Wrap } from './ui';

const STATUS = {
  'service now': { color: '#ff5b6b', bg: 'rgba(255,91,107,0.14)', rank: 0 },
  'schedule visit': { color: '#fbbf24', bg: 'rgba(251,191,36,0.14)', rank: 1 },
  watch: { color: '#a3abb8', bg: 'rgba(255,255,255,0.08)', rank: 2 },
  ok: { color: '#34d399', bg: 'rgba(52,211,153,0.14)', rank: 3 },
};

function HealthBar({ value, status }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
      <motion.div
        className="h-full rounded-full"
        initial={false}
        animate={{ width: `${Math.max(2, value)}%`, background: STATUS[status].color }}
        transition={{ duration: 0.6, ease: EASE }}
      />
    </div>
  );
}

export default function Maintenance({ data, t }) {
  const snap = maintenanceAt(data, t);

  const rows = useMemo(() => {
    const r = [...snap.rows];
    r.sort((a, b) => STATUS[a.status].rank - STATUS[b.status].rank || a.health - b.health);
    return r.slice(0, 8);
  }, [snap]);

  const worst = useMemo(() => {
    const byStation = {};
    for (const r of snap.rows) byStation[r.station] = Math.min(byStation[r.station] ?? 100, r.health);
    return byStation;
  }, [snap]);

  return (
    <section id="maintenance" className="relative py-16 sm:py-24">
      <div aria-hidden="true" className="divider absolute inset-x-0 top-0" />
      <Wrap>
        <SectionHead
          eyebrow="Predictive maintenance"
          title={
            <>
              Book the technician <em>before the data goes bad.</em>
            </>
          }
          lead="Every sensor's disagreement with its neighbours is tracked as a one-day median. A steady walk away from zero is projected forward to the calibration tolerance, giving a service ETA. It follows the replay above."
        />

        <div className="mt-10 grid gap-6 lg:grid-cols-12">
          <Reveal className="min-w-0 lg:col-span-4" delay={60}>
            <Card className="h-full p-5">
              <p className="font-mono text-[11px] uppercase tracking-wider text-ink-3">Station health</p>
              <p className="mt-1 text-[13px] text-ink-2">{fmtStamp(data.time(snap.at))}</p>
              <ul className="mt-5 flex flex-col gap-3.5">
                {data.stations.map((s) => {
                  const h = worst[s.id] ?? 100;
                  const st = h <= 0 ? 'service now' : h < 50 ? 'watch' : 'ok';
                  return (
                    <li key={s.id} className="grid grid-cols-[44px_1fr_44px] items-center gap-3">
                      <span className="font-mono text-[12px] font-medium text-ink">{s.id}</span>
                      <HealthBar value={h} status={st} />
                      <span className="text-right font-mono text-[12px] text-ink-2 tabular">{Math.round(h)}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-5 text-[12px] leading-relaxed text-ink-3">
                Worst sensor per station. 100 = no measurable bias; 0 = at or past tolerance.
              </p>
            </Card>
          </Reveal>

          <Reveal className="min-w-0 lg:col-span-8" delay={140}>
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b hairline text-[11px] uppercase tracking-wider text-ink-3">
                      <th className="px-5 py-3 font-medium">Sensor</th>
                      <th className="px-3 py-3 font-medium">Bias</th>
                      <th className="px-3 py-3 font-medium">Drift / day</th>
                      <th className="px-3 py-3 font-medium">Health</th>
                      <th className="px-3 py-3 font-medium">Service in</th>
                      <th className="px-5 py-3 text-right font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence initial={false}>
                      {rows.map((r) => {
                        const st = STATUS[r.status];
                        const unit = data.units[r.param];
                        return (
                          <motion.tr
                            key={`${r.station}-${r.param}`}
                            layout
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.4, ease: EASE }}
                            className="border-b hairline last:border-0"
                          >
                            <td className="px-5 py-3">
                              <span className="font-mono font-medium text-ink">{r.station}</span>
                              <span className="ml-2 text-ink-2">{PARAM_META[r.param].label}</span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 font-mono tabular text-ink">
                              {r.bias > 0 ? '+' : ''}
                              {fmtNum(r.bias, 2)} <span className="text-ink-3">{unit}</span>
                            </td>
                            <td className="px-3 py-3 font-mono tabular text-ink-2">
                              {r.drift_per_day > 0 ? '+' : ''}
                              {fmtNum(r.drift_per_day, 2)}
                            </td>
                            <td className="w-[140px] px-3 py-3">
                              <HealthBar value={r.health} status={r.status} />
                            </td>
                            <td className="px-3 py-3 font-mono tabular text-ink-2">
                              {r.eta_hours === null ? '—' : r.eta_hours === 0 ? 'now' : `${Math.round(r.eta_hours)} h`}
                            </td>
                            <td className="px-5 py-3 text-right">
                              <span className="inline-flex rounded-full px-2.5 py-1 text-[11.5px] font-medium" style={{ color: st.color, background: st.bg }}>
                                {r.status}
                              </span>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </Card>
            <p className="mt-3 text-[12px] text-ink-3">
              Eight sensors most in need of attention out of {snap.rows.length}. Tolerances: temperature ±{data.tolerance.temperature} °C, humidity ±
              {data.tolerance.humidity}%, pressure ±{data.tolerance.pressure} hPa.
            </p>
          </Reveal>
        </div>
      </Wrap>
    </section>
  );
}
