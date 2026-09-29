import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { CLS, CLS_META, PARAM_META } from '../lib/data';
import AlertFeed from './AlertFeed';
import Sparkline from './Sparkline';
import StationMap from './StationMap';
import Timeline from './Timeline';
import { CountUp, EASE, Reveal, SectionHead, Wrap } from './ui';

const WINDOW_HOURS = 24;
const DIGITS = { temperature: 1, humidity: 0, pressure: 1, wind_speed: 1, rainfall: 1 };
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: CLS.FAULT, label: 'Faults' },
  { key: CLS.WEATHER, label: 'Weather' },
];

export default function LiveNetwork({ data, replay }) {
  const { t } = replay;
  const [selected, setSelected] = useState('RJG');
  const [filter, setFilter] = useState('all');

  const counts = useMemo(() => {
    const c = { 0: 0, 1: 0, 2: 0, 3: 0 };
    for (const s of data.stations) c[data.verdict[s.id][t]] += 1;
    return c;
  }, [data, t]);

  const station = data.byId[selected];
  const win = WINDOW_HOURS * data.stepsPerHour;
  const from = Math.max(0, t - win + 1);
  const verdicts = data.verdict[selected].slice(from, t + 1);
  const vparam = data.vparam[selected].slice(from, t + 1);
  const nowCls = data.verdict[selected][t];
  const current = data.incidents.find((x) => x.station === selected && x.start <= t && x.end >= t);

  return (
    <section id="live" className="relative py-16 sm:py-24">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(139,124,255,0.12),transparent_70%)]" />
      <Wrap>
        <SectionHead
          eyebrow="Live network"
          title={
            <>
              Eight stations, every ten minutes. <em>Watch it decide.</em>
            </>
          }
          lead={
            data.source === 'live'
              ? 'Readings streamed by edge agents into the SkyNova server, judged by the Python engine as they arrive. Scrub back to see any moment.'
              : 'A replay of a simulated AWS network around Bhopal with eight injected sensor faults, two thunderstorms and a heatwave. Every verdict below comes from the Python engine, step by step, looking only backwards.'
          }
        />

        <Reveal delay={120}>
          <div className="rim mt-10">
          <div className="rounded-[calc(1.25rem-1px)] bg-[linear-gradient(180deg,#0c1119,#070a10)] p-4 shadow-lift sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {[CLS.NORMAL, CLS.FAULT, CLS.WEATHER, CLS.MISSING].map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-2 rounded-full border hairline bg-white/[0.03] px-3 py-1.5 text-[12px] text-ink-2"
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: c === CLS.NORMAL ? '#eef0f3' : CLS_META[c].color }} />
                    {CLS_META[c].label}
                    <motion.span key={counts[c]} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="font-mono font-medium text-ink tabular">
                      {counts[c]}
                    </motion.span>
                  </span>
                ))}
              </div>
              <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-ink-3">
                <span className={`h-1.5 w-1.5 rounded-full ${data.source === 'live' ? 'bg-ok' : 'bg-ink-3'} breathe`} />
                {data.source === 'live' ? 'Live from edge agents' : 'Replay · simulated network'}
              </span>
            </div>

            <div className="mt-6">
              <Timeline data={data} replay={replay} />
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-12">
              <div className="min-w-0 self-start overflow-hidden rounded-xl border hairline bg-[radial-gradient(80%_80%_at_50%_45%,rgba(45,212,239,0.07),rgba(5,7,11,0.6))] lg:sticky lg:top-20 lg:col-span-7">
                <StationMap data={data} t={t} selected={selected} onSelect={setSelected} />
              </div>
              <div className="min-w-0 lg:col-span-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-[14px] font-semibold text-ink">Alerts</h3>
                  <div className="flex rounded-full border hairline-2 p-0.5">
                    {FILTERS.map((f) => (
                      <button
                        key={String(f.key)}
                        onClick={() => setFilter(f.key)}
                        className="relative h-7 rounded-full px-3 text-[12px] text-ink-2"
                      >
                        {filter === f.key && (
                          <motion.span layoutId="filter-pill" className="absolute inset-0 rounded-full bg-white/10" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />
                        )}
                        <span className={`relative ${filter === f.key ? 'text-ink' : ''}`}>{f.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <AlertFeed data={data} t={t} onSelect={setSelected} filter={filter} />
              </div>
            </div>

            <div className="mt-8 border-t hairline pt-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
                    {station.id} · {station.lat.toFixed(2)}°N {station.lon.toFixed(2)}°E · {station.elevation} m
                  </p>
                  <h3 className="mt-1 text-[24px] font-semibold tracking-[-0.03em] text-ink">{station.name}</h3>
                </div>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${nowCls}-${current?.id ?? 'none'}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.35, ease: EASE }}
                    className="max-w-xl text-right"
                  >
                    <span
                      className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-medium"
                      style={{
                        color: nowCls === CLS.NORMAL ? '#34d399' : CLS_META[nowCls].color,
                        background: nowCls === CLS.NORMAL ? 'rgba(52,211,153,0.14)' : nowCls === CLS.FAULT ? 'rgba(255,91,107,0.14)' : nowCls === CLS.WEATHER ? 'rgba(45,212,239,0.14)' : 'rgba(255,255,255,0.04)',
                      }}
                    >
                      {nowCls === CLS.NORMAL ? 'All sensors nominal' : CLS_META[nowCls].label}
                    </span>
                    {current && <p className="mt-2 text-[12.5px] text-ink-2">{current.reason}</p>}
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-5">
                {data.params.map((p, k) => (
                  <Sparkline
                    key={p}
                    label={PARAM_META[p].label}
                    unit={data.units[p]}
                    digits={DIGITS[p]}
                    values={data.series[selected][p].slice(from, t + 1)}
                    verdicts={verdicts}
                    blamed={vparam.map((v) => v === k || v === 5)}
                  />
                ))}
              </div>
              <p className="mt-3 text-[12px] text-ink-3">
                Click any station on the map. Shaded spans are flagged steps; dots are the readings the engine blamed on that sensor.
              </p>
            </div>
          </div>
          </div>
        </Reveal>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Readings checked', value: data.steps * data.stations.length * data.params.length, suffix: '' },
            { label: 'Incidents raised', value: data.incidents.length, suffix: '' },
            { label: 'Engine time per station reading', value: data.model.ms_per_station_reading, suffix: ' ms', decimals: 2 },
            { label: 'Cloud API calls', value: 0, suffix: '' },
          ].map((k, i) => (
            <Reveal key={k.label} delay={i * 60}>
              <div className="glass rounded-2xl p-4">
                <p className="text-[12px] text-ink-3">{k.label}</p>
                <p className="mt-1 text-[26px] font-semibold tracking-[-0.03em] text-ink">
                  <CountUp to={k.value} decimals={k.decimals || 0} suffix={k.suffix} />
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </Wrap>
    </section>
  );
}
