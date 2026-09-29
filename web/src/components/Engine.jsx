import { motion } from 'framer-motion';
import { Activity, Gauge, Network, RadioTower, ShieldCheck, Wrench } from 'lucide-react';
import { EASE, Reveal, SectionHead, Wrap } from './ui';

const STAGES = [
  {
    icon: RadioTower,
    title: 'Acquire',
    body: 'Temperature, humidity, pressure, wind and rain every 10 minutes. The edge agent buffers to disk when the link drops and replays on reconnect.',
  },
  {
    icon: ShieldCheck,
    title: 'Quality control',
    body: 'WMO-style gross-error checks: physical range, impossible jumps, a sensor frozen for two hours, rain under a dry sky.',
  },
  {
    icon: Activity,
    title: 'Features',
    body: 'Fifteen robust z-scores per reading: against the station’s last hour, its four nearest neighbours, and its normal for that time of day.',
  },
  {
    icon: Gauge,
    title: 'Isolation Forest',
    body: '300 trees trained on two clean days score how unusual the whole picture is, catching combinations no single rule names.',
  },
  {
    icon: Network,
    title: 'Dual detection',
    body: 'Fault or weather? Coherence across sensors and across neighbours decides, and every verdict carries a sentence saying why.',
  },
  {
    icon: Wrench,
    title: 'Maintenance',
    body: 'Each sensor’s bias against its neighbours is tracked and projected forward, so a drifting barometer is booked for service before it fails.',
  },
];

const RULES = [
  {
    tone: 'fault',
    title: 'Sensor fault',
    points: [
      'One sensor moves, the others at the station do not',
      'Neighbours within ~100 km stay calm',
      'Physically impossible, frozen or erratic output',
      'Slow bias that grows day after day',
    ],
  },
  {
    tone: 'weather',
    title: 'Extreme weather',
    points: [
      'Pressure falls, wind gusts, rain starts, temperature drops, together',
      'Neighbours show the same move within two hours',
      'A heatwave lifts every station alike, so no station stands out',
      'The storm cell is seen travelling across the network',
    ],
  },
];

export default function Engine() {
  return (
    <section id="engine" className="border-y hairline bg-paper-2/50 py-16 sm:py-24">
      <Wrap>
        <SectionHead
          eyebrow="How it decides"
          title={
            <>
              Six steps from sensor to verdict. <em>All of it explainable.</em>
            </>
          }
          lead="Classical, transparent machine learning, on purpose: it fits on a Raspberry Pi-class gateway, needs no internet, and a meteorologist can read every reason it gives."
        />

        <div className="relative mt-12">
          <motion.div
            aria-hidden="true"
            className="absolute left-0 right-0 top-[27px] hidden h-px origin-left bg-ink/15 lg:block"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.6, ease: EASE }}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            {STAGES.map((s, i) => (
              <Reveal key={s.title} delay={i * 90}>
                <div className="relative">
                  <div className="relative z-10 inline-flex h-14 w-14 items-center justify-center rounded-2xl border hairline-2 bg-white shadow-lift">
                    <s.icon size={20} strokeWidth={1.6} className="text-ink" />
                  </div>
                  <p className="mt-4 font-mono text-[11px] text-ink-3">0{i + 1}</p>
                  <h3 className="mt-1 text-[16px] font-semibold tracking-[-0.02em] text-ink">{s.title}</h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        <div className="mt-16 grid gap-4 md:grid-cols-2">
          {RULES.map((r, i) => (
            <Reveal key={r.title} delay={i * 120}>
              <div className="h-full rounded-2xl border hairline bg-white p-6 shadow-lift">
                <div className="flex items-center gap-2.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${r.tone === 'fault' ? 'bg-fault' : 'bg-weather'}`} />
                  <h3 className="text-[20px] font-semibold tracking-[-0.03em] text-ink">{r.title}</h3>
                </div>
                <p className="mt-1 text-[13px] text-ink-3">{r.tone === 'fault' ? 'misbehaves alone' : 'moves together'}</p>
                <ul className="mt-5 flex flex-col gap-3">
                  {r.points.map((p, k) => (
                    <motion.li
                      key={p}
                      className="flex gap-3 text-[14.5px] leading-snug text-ink-2"
                      initial={{ opacity: 0, x: -8 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.2 + k * 0.08, duration: 0.5, ease: EASE }}
                    >
                      <span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${r.tone === 'fault' ? 'bg-fault' : 'bg-weather'}`} />
                      {p}
                    </motion.li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </Wrap>
    </section>
  );
}
