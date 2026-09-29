import { motion, useReducedMotion } from 'framer-motion';
import { Aurora } from './Sky';
import { CountUp, EASE, GhostButton, PillButton, Wrap } from './ui';

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
  const draw = { initial: { pathLength: 0 }, animate: { pathLength: 1 }, transition: { duration: 2.4, ease: [0.65, 0, 0.35, 1], delay: 0.6 } };
  return (
    <svg viewBox="0 0 1200 100" className="h-auto w-full overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id="trace" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#2dd4ef" stopOpacity="0.2" />
          <stop offset="0.5" stopColor="#8b7cff" />
          <stop offset="1" stopColor="#2dd4ef" />
        </linearGradient>
        <linearGradient id="scan" x1="0" x2="1">
          <stop offset="0" stopColor="#2dd4ef" stopOpacity="0" />
          <stop offset="1" stopColor="#2dd4ef" stopOpacity="0.35" />
        </linearGradient>
        <filter id="trace-glow" x="-5%" y="-50%" width="110%" height="200%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <motion.path d={d} fill="none" stroke="url(#trace)" strokeWidth="5" filter="url(#trace-glow)" opacity="0.7" {...draw} />
      <motion.path d={d} fill="none" stroke="url(#trace)" strokeWidth="1.6" {...draw} />
      <motion.rect
        y="0"
        width="90"
        height="100"
        fill="url(#scan)"
        initial={{ x: -90 }}
        animate={{ x: 1200 }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'linear', delay: 3 }}
      />
      <motion.g initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 2.3, duration: 0.5, ease: EASE }} style={{ transformOrigin: '780px 20px' }}>
        <circle cx="780" cy={pts[156][1]} r="5" fill="#ff5b6b" />
        <motion.circle
          cx="780"
          cy={pts[156][1]}
          fill="none"
          stroke="#ff5b6b"
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

const STAT_TONE = ['#2dd4ef', '#8b7cff', '#34d399', '#ff5b6b'];

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
    <section className="relative overflow-hidden pb-16 pt-16 sm:pb-24 sm:pt-28">
      <Aurora />
      <Wrap className="relative">
        <div className="max-w-4xl">
          <Rise d={0}>
            <span className="glass inline-flex items-center gap-2.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-medium text-ink-2">
              <span className="relative inline-flex h-1.5 w-1.5">
                <span className="absolute -inset-1 rounded-full bg-weather breathe" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-weather" />
              </span>
              SIH 2026 · SIH26073 · Disaster Management
            </span>
          </Rise>
          <Rise d={80}>
            <h1 className="mt-7 text-[clamp(42px,6.2vw,92px)] font-semibold leading-[1.0] tracking-[-0.05em] [text-wrap:balance]">
              <span className="grad-text">A broken sensor is not a storm.</span> <em>SkyNova knows the difference.</em>
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
          <div className="glass overflow-hidden rounded-2xl px-4 pb-3 pt-4 sm:px-6">
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
                <div className="glass group relative overflow-hidden rounded-2xl p-4 transition-colors duration-500 hover:border-weather/40">
                  <span
                    className="absolute inset-x-0 top-0 h-px"
                    style={{ background: `linear-gradient(90deg, transparent, ${STAT_TONE[i]}, transparent)` }}
                  />
                  <p className="text-[12px] text-ink-3">{s.label}</p>
                  <p className="grad-text mt-1 text-[32px] font-semibold tracking-[-0.035em]">
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
