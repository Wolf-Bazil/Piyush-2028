import { useCallback, useEffect, useRef, useState } from 'react';

export const SPEEDS = [
  { label: '1×', stepsPerSec: 6 },
  { label: '4×', stepsPerSec: 24 },
  { label: '16×', stepsPerSec: 96 },
];

// Drives the replay clock with requestAnimationFrame. `t` is an integer step.
export function useReplay(total, initial = 0) {
  const [t, setT] = useState(initial);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const acc = useRef(initial);
  const last = useRef(0);

  useEffect(() => {
    acc.current = t;
  }, [t]);

  useEffect(() => {
    if (!playing || !total) return;
    let raf = 0;
    last.current = 0;
    const tick = (now) => {
      if (!last.current) last.current = now;
      const dt = (now - last.current) / 1000;
      last.current = now;
      acc.current = acc.current + dt * SPEEDS[speed].stepsPerSec;
      if (acc.current >= total - 1) {
        acc.current = total - 1;
        setT(total - 1);
        setPlaying(false);
        return;
      }
      setT(Math.floor(acc.current));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, total]);

  const seek = useCallback((v) => {
    acc.current = v;
    setT(v);
  }, []);

  const toggle = useCallback(() => {
    setPlaying((p) => {
      if (!p && acc.current >= total - 1) {
        acc.current = 0;
        setT(0);
      }
      return !p;
    });
  }, [total]);

  return { t, playing, speed, setSpeed, seek, toggle, setPlaying };
}
