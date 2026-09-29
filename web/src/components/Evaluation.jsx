import { motion } from 'framer-motion';
import { CLS_META } from '../lib/data';
import { Card, EASE, Reveal, SectionHead, Wrap } from './ui';

const ORDER = ['normal', 'sensor_fault', 'weather_event', 'missing'];
const LABEL = { normal: 'Normal', sensor_fault: 'Fault', weather_event: 'Weather', missing: 'No data' };
const COLOR = { normal: '#16130f', sensor_fault: '#d93a45', weather_event: '#0891b2', missing: '#857e75' };

function Confusion({ confusion }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] border-separate border-spacing-1 text-[12.5px]">
        <thead>
          <tr>
            <th className="w-24 px-2 py-1 text-left text-[11px] font-medium text-ink-3">truth ↓ · engine →</th>
            {ORDER.map((c) => (
              <th key={c} className="px-2 py-1 text-center text-[11px] font-medium text-ink-2">
                {LABEL[c]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ORDER.map((r, i) => {
            const rowTotal = ORDER.reduce((s, c) => s + confusion[r][c], 0) || 1;
            return (
              <tr key={r}>
                <td className="px-2 py-1 text-[12px] font-medium text-ink">{LABEL[r]}</td>
                {ORDER.map((c, j) => {
                  const n = confusion[r][c];
                  const share = n / rowTotal;
                  const diag = r === c;
                  return (
                    <td key={c} className="p-0">
                      <motion.div
                        className="flex h-14 flex-col items-center justify-center rounded-lg"
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.05 * (i * 4 + j), duration: 0.5, ease: EASE }}
                        style={{
                          background: diag
                            ? `rgba(47,125,79,${0.08 + share * 0.3})`
                            : n
                              ? `rgba(217,58,69,${0.05 + Math.min(0.35, share * 2)})`
                              : '#f7f5f0',
                        }}
                      >
                        <span className="font-mono text-[14px] font-medium text-ink tabular">{n.toLocaleString('en-IN')}</span>
                        <span className="font-mono text-[10px] text-ink-3 tabular">{(share * 100).toFixed(1)}%</span>
                      </motion.div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function Evaluation({ data }) {
  const m = data.metrics;
  if (!m) return null;
  const incidents = data.injected || [];

  return (
    <section id="evaluation" className="border-t hairline bg-paper-2/50 py-16 sm:py-24">
      <Wrap>
        <SectionHead
          eyebrow="Evaluation"
          title={
            <>
              Scored against ground truth, <em>not against itself.</em>
            </>
          }
          lead="Real AWS archives do not say which readings came from a broken sensor, so a detector cannot be scored on them. The simulator labels every reading it corrupts; these numbers compare the engine's verdicts with those labels."
        />

        <div className="mt-10 grid gap-6 lg:grid-cols-12">
          <Reveal className="lg:col-span-6" delay={60}>
            <Card className="h-full p-5">
              <p className="font-mono text-[11px] uppercase tracking-wider text-ink-3">Confusion matrix · {m.rows.toLocaleString('en-IN')} station readings</p>
              <div className="mt-4">
                <Confusion confusion={m.confusion} />
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3 border-t hairline pt-4 text-[12px]">
                <div>
                  <p className="text-ink-3">True positives</p>
                  <p className="font-mono text-[15px] text-ink tabular">{m.detection.tp.toLocaleString('en-IN')}</p>
                </div>
                <div>
                  <p className="text-ink-3">False alarms</p>
                  <p className="font-mono text-[15px] text-ink tabular">{m.detection.fp.toLocaleString('en-IN')}</p>
                </div>
                <div>
                  <p className="text-ink-3">Missed</p>
                  <p className="font-mono text-[15px] text-ink tabular">{m.detection.fn.toLocaleString('en-IN')}</p>
                </div>
              </div>
            </Card>
          </Reveal>

          <Reveal className="lg:col-span-6" delay={140}>
            <Card className="h-full p-5">
              <p className="font-mono text-[11px] uppercase tracking-wider text-ink-3">Every injected incident</p>
              <ul className="mt-4 flex flex-col gap-3">
                {incidents.map((x, i) => {
                  const color = x.expected === 'weather_event' ? CLS_META[2].color : x.expected === 'missing' ? CLS_META[3].color : CLS_META[1].color;
                  return (
                    <li key={x.incident} className="grid grid-cols-[1fr_96px_62px] items-center gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-ink">{x.note}</p>
                        <p className="font-mono text-[10.5px] text-ink-3">
                          {x.type === 'weather' ? x.station.split(',').length + ' stations' : x.station} · {x.truth_steps} steps
                        </p>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-paper-3">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: color }}
                          initial={{ width: 0 }}
                          whileInView={{ width: `${x.recall * 100}%` }}
                          viewport={{ once: true }}
                          transition={{ delay: 0.1 + i * 0.06, duration: 0.9, ease: EASE }}
                        />
                      </div>
                      <span className="text-right font-mono text-[12px] text-ink tabular">{Math.round(x.recall * 100)}%</span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-5 border-t hairline pt-4 text-[12px] leading-relaxed text-ink-3">
                Bar = share of the incident's readings given the right class.{' '}
                {incidents.filter((x) => x.detected).length} of {incidents.length} incidents detected;{' '}
                {incidents.filter((x) => x.delay_minutes === 0).length} at their very first labelled reading
                {incidents.some((x) => x.delay_minutes > 0) &&
                  `, the rest within ${Math.max(...incidents.map((x) => x.delay_minutes || 0))} minutes`}
                .
              </p>
            </Card>
          </Reveal>
        </div>
      </Wrap>
    </section>
  );
}
