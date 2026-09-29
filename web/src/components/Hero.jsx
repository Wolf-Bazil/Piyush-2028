import { motion, useReducedMotion } from 'framer-motion';
import { CountUp, EASE, Eyebrow, GhostButton, PillButton, Wrap } from './ui';

function Rise({ children, d = 0, className = '' }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y: 18, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.9, ease: EASE, delay: 0.25 + d / 1000 }}
    >
      {children}
    </motion.div>
  );
}

// A small live trace: one station's pressure, with a fault the engine catches.
function Signal() {
  const pts = [];
  for (let i = 0; i <= 240; i++) {
    const base = 52 + Math.sin(i / 14) * 9 + Math.sin(i / 4.1) * 2;
    const spike = i === 156 ? -34 : 0;
    pts.push([i * 5, base + spike]);
  }
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ');
  return (
    <svg viewBox="0 0 1200 100" className="h-auto w-full" aria-hidden="true">
      <motion.path
        d={d}
        fill="none"
        stroke="#16130f"
        strokeWidth="1.4"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 2.4, ease: [0.65, 0, 0.35, 1], delay: 0.6 }}
      />
      <motion.g initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 2.3, duration: 0.5, ease: EASE }} style={{ transformOrigin: '780px 20px' }}>
        <circle cx="780" cy={pts[156][1]} r="5" fill="#d93a45" />
        <motion.circle
          cx="780"
          cy={pts[156][1]}
          fill="none"
          stroke="#d93a45"
          initial={{ r: 5, opacity: 0.7 }}
          animate={{ r: 22, opacity: 0 }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut', delay: 2.5 }}
        />
        <text x="796" y={pts[156][1] + 5} fontSize="15" className="fill-fault font-medium">
          sensor fault · no neighbour agrees
        </text>
      </motion.g>
    </svg>
  );
}

export default function Hero({ metrics }) {
  const det = metrics?.detection;
  const stats = det
    ? [
        { label: 'Precision', value: det.precision * 100, suffix: '%', decimals: 1 },
        { label: 'Recall', value: det.recall * 100, suffix: '%', decimals: 1 },
        { label: 'Fault vs weather, correct', value: metrics.fault_vs_weather_accuracy * 100, suffix: '%', decimals: 1 },
        { label: 'False alarms', value: det.false_alarm_rate * 100, suffix: '%', decimals: 1 },
      ]
    : [];

  return (
    <section className="relative pb-16 pt-14 sm:pb-24 sm:pt-20">
      <Wrap>
        <div className="max-w-4xl">
          <Rise d={0}>
            <Eyebrow>SIH 2026 · SIH26073 · Disaster Management</Eyebrow>
          </Rise>
          <Rise d={80}>
            <h1 className="mt-6 text-[clamp(40px,5.6vw,84px)] font-semibold leading-[1.02] tracking-[-0.045em] text-ink [text-wrap:balance]">
              A broken sensor is not a storm. <em>SkyNova knows the difference.</em>
            </h1>
          </Rise>
          <Rise d={180}>
            <p className="mt-7 max-w-2xl text-[17px] leading-[1.6] text-ink-2 sm:text-[19px] [text-wrap:pretty]">
              Automatic Weather Stations send a reading every ten minutes, and some of those readings are wrong. SkyNova checks
              each one against the station's own history, its neighbours and the physics of weather, then says whether it is a
              faulty sensor or a real extreme event, before it reaches a forecast.
            </p>
          </Rise>
          <Rise d={280} className="mt-10 flex flex-wrap items-center gap-3">
            <PillButton href="#live">Watch the network</PillButton>
            <GhostButton href="#engine">How it decides</GhostButton>
          </Rise>
          <Rise d={340}>
            <p className="mt-5 text-[13px] text-ink-3">Runs offline on a laptop or edge gateway. No cloud AI, no API keys.</p>
          </Rise>
        </div>

        <Rise d={420} className="mt-14">
          <div className="rounded-2xl border hairline bg-white px-4 pb-2 pt-4 shadow-lift sm:px-6">
            <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-wider text-ink-3">
              <span>RJG · pressure · hPa</span>
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-ok breathe" />
                checking
              </span>
            </div>
            <Signal />
          </div>
        </Rise>

        {stats.length > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((s, i) => (
              <Rise key={s.label} d={500 + i * 70}>
                <div className="rounded-2xl border hairline bg-white p-4">
                  <p className="text-[12px] text-ink-3">{s.label}</p>
                  <p className="mt-1 text-[30px] font-semibold tracking-[-0.035em] text-ink">
                    <CountUp to={s.value} decimals={s.decimals} suffix={s.suffix} />
                  </p>
                </div>
              </Rise>
            ))}
          </div>
        )}
        {stats.length > 0 && (
          <Rise d={800}>
            <p className="mt-3 text-[12px] text-ink-3">
              Measured against labelled ground truth on the ten-day simulated network below, per station reading.
            </p>
          </Rise>
        )}
      </Wrap>
    </section>
  );
}
