import { AnimatePresence, motion } from 'framer-motion';
import { useMemo } from 'react';
import { CLS, CLS_META, heatwaveAt, stormsAt } from '../lib/data';

const W = 600;
const H = 430;
const PAD = 34;
const LON = [75.5, 78.4];
const LAT = [22.35, 24.3];
const KX = Math.cos((23.3 * Math.PI) / 180);
const CX = W / 2;
const CY = H / 2 - 6;

function project(lon, lat) {
  const spanX = (LON[1] - LON[0]) * KX;
  const spanY = LAT[1] - LAT[0];
  const scale = Math.min((W - PAD * 2) / spanX, (H - PAD * 2) / spanY);
  const offX = (W - spanX * scale) / 2;
  const offY = (H - spanY * scale) / 2;
  return {
    x: offX + (lon - LON[0]) * KX * scale,
    y: H - (offY + (lat - LAT[0]) * scale),
    scale,
  };
}

export default function StationMap({ data, t, selected, onSelect }) {
  const pts = useMemo(
    () => Object.fromEntries(data.stations.map((s) => [s.id, project(s.lon, s.lat)])),
    [data]
  );

  const links = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const [a, nbs] of Object.entries(data.neighbours)) {
      for (const b of nbs) {
        const k = [a, b].sort().join('-');
        if (!seen.has(k)) {
          seen.add(k);
          out.push([a, b]);
        }
      }
    }
    return out;
  }, [data]);

  const storms = stormsAt(data, t);
  const heat = heatwaveAt(data, t);
  const verdict = (id) => data.verdict[id][t];

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Station network map">
        <defs>
          <linearGradient id="sweep-g" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#2dd4ef" stopOpacity="0" />
            <stop offset="1" stopColor="#2dd4ef" stopOpacity="0.1" />
          </linearGradient>
          <filter id="dot-glow" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="3.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* radar: range rings and a slow sweep around the network centre */}
        {[70, 140, 210].map((r) => (
          <circle key={r} cx={CX} cy={CY} r={r} fill="none" stroke="rgba(45,212,239,0.08)" />
        ))}
        <g className="sweep" style={{ transformOrigin: `${CX}px ${CY}px` }}>
          <path d={`M${CX},${CY} L${CX + 230},${CY} A230,230 0 0,0 ${CX + 230 * Math.cos(0.45)},${CY - 230 * Math.sin(0.45)} Z`} fill="url(#sweep-g)" />
          <line x1={CX} y1={CY} x2={CX + 230} y2={CY} stroke="rgba(45,212,239,0.3)" strokeWidth="1" />
        </g>

        {/* graticule */}
        {[76, 76.5, 77, 77.5, 78].map((lon) => {
          const a = project(lon, LAT[0]);
          const b = project(lon, LAT[1]);
          return (
            <g key={`lon${lon}`}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(255,255,255,0.06)" strokeDasharray="2 6" />
              <text x={a.x} y={H - 10} textAnchor="middle" className="map-axis fill-ink-3 font-mono" fontSize="9">
                {lon.toFixed(1)}°E
              </text>
            </g>
          );
        })}
        {[22.5, 23, 23.5, 24].map((lat) => {
          const a = project(LON[0], lat);
          const b = project(LON[1], lat);
          return (
            <g key={`lat${lat}`}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(255,255,255,0.06)" strokeDasharray="2 6" />
              <text x={10} y={a.y + 3} className="map-axis fill-ink-3 font-mono" fontSize="9">
                {lat.toFixed(1)}°N
              </text>
            </g>
          );
        })}

        {/* neighbour links: tinted when both ends see the same weather */}
        {links.map(([a, b]) => {
          const both = verdict(a) === CLS.WEATHER && verdict(b) === CLS.WEATHER;
          return (
            <motion.line
              key={`${a}-${b}`}
              x1={pts[a].x}
              y1={pts[a].y}
              x2={pts[b].x}
              y2={pts[b].y}
              initial={false}
              animate={{
                stroke: both ? 'rgba(45,212,239,0.55)' : 'rgba(255,255,255,0.10)',
                strokeWidth: both ? 1.6 : 1,
              }}
              transition={{ duration: 0.5 }}
            />
          );
        })}

        {/* storm cells */}
        <AnimatePresence>
          {storms.map((s) => {
            const p = project(s.lon, s.lat);
            const r = s.radius * p.scale;
            return (
              <motion.g
                key={s.name}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8 }}
              >
                <circle cx={p.x} cy={p.y} r={r} fill="rgba(45,212,239,0.05)" />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={r}
                  fill="none"
                  stroke="#2dd4ef"
                  strokeOpacity="0.55"
                  strokeDasharray="3 7"
                  className="spin-slow"
                />
                <circle cx={p.x} cy={p.y} r={r * 0.45} fill="none" stroke="#2dd4ef" strokeOpacity="0.25" />
                <text x={p.x} y={p.y - r - 8} textAnchor="middle" fontSize="11" className="fill-weather font-medium">
                  {s.name}
                </text>
              </motion.g>
            );
          })}
        </AnimatePresence>

        {/* stations */}
        {data.stations.map((s) => {
          const p = pts[s.id];
          const v = verdict(s.id);
          const color = v === CLS.NORMAL ? '#eef0f3' : CLS_META[v].color;
          const alert = v === CLS.FAULT || v === CLS.WEATHER;
          const isSel = selected === s.id;
          return (
            <g
              key={s.id}
              onClick={() => onSelect(s.id)}
              className="cursor-pointer"
              role="button"
              aria-label={`${s.name}: ${CLS_META[v].label}`}
            >
              <circle cx={p.x} cy={p.y} r={22} fill="transparent" />
              {alert && (
                <motion.circle
                  cx={p.x}
                  cy={p.y}
                  fill="none"
                  stroke={color}
                  initial={{ r: 7, opacity: 0.7 }}
                  animate={{ r: 22, opacity: 0 }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
                />
              )}
              {isSel && (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={13}
                  fill="none"
                  stroke="#eef0f3"
                  strokeWidth="1.2"
                />
              )}
              <motion.circle
                cx={p.x}
                cy={p.y}
                filter="url(#dot-glow)"
                initial={false}
                animate={{ fill: v === CLS.MISSING ? '#05070b' : color, r: alert ? 7.5 : 6 }}
                stroke={v === CLS.MISSING ? '#4b5260' : '#05070b'}
                strokeWidth={v === CLS.MISSING ? 1.5 : 2}
                strokeDasharray={v === CLS.MISSING ? '2 2' : undefined}
                transition={{ duration: 0.35 }}
              />
              <text x={p.x + 17} y={p.y - 3} fontSize="11.5" className="map-id fill-ink font-mono font-medium">
                {s.id}
              </text>
              <text x={p.x + 17} y={p.y + 11} fontSize="10.5" className="map-name fill-ink-3">
                {s.name}
              </text>
            </g>
          );
        })}
      </svg>

      <AnimatePresence>
        {heat && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full border border-weather/30 bg-[#05070b]/80 px-3 py-1.5 text-[12px] font-medium text-weather backdrop-blur"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-weather breathe" />
            Heatwave across the region
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
