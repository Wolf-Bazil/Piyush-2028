import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef } from 'react';

// Twinkling stars on a canvas. Pauses when off screen; still frame for reduced motion.
function Stars({ density = 0.00018 }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    let raf = 0;
    let visible = true;
    let stars = [];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      const n = Math.round(width * height * density);
      stars = Array.from({ length: n }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() < 0.08 ? 1.3 : Math.random() * 0.8 + 0.3,
        a: Math.random() * 0.6 + 0.2,
        s: Math.random() * 1.5 + 0.4,
        p: Math.random() * Math.PI * 2,
        hue: Math.random() < 0.15 ? (Math.random() < 0.5 ? '45,212,239' : '139,124,255') : '255,255,255',
      }));
    };

    const draw = (time) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const t = time / 1000;
      for (const st of stars) {
        const tw = reduced ? 1 : 0.55 + 0.45 * Math.sin(t * st.s + st.p);
        ctx.fillStyle = `rgba(${st.hue},${st.a * tw})`;
        ctx.beginPath();
        // Stars drift slowly upward (nearer = faster) and wrap around.
        const h = canvas.height / dpr;
        const y = (((st.y - (reduced ? 0 : t * 2 * st.r)) % h) + h) % h;
        ctx.arc(st.x, y, st.r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!reduced && visible) raf = requestAnimationFrame(draw);
    };

    resize();
    raf = requestAnimationFrame(draw);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !reduced) {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(draw);
      }
    });
    io.observe(canvas);
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [density, reduced]);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" aria-hidden="true" />;
}

const BLOBS = [
  { c: 'rgba(45,212,239,0.30)', x: '12%', y: '-10%', w: 620, move: [0, 60, -30, 0], dur: 22 },
  { c: 'rgba(139,124,255,0.28)', x: '48%', y: '-18%', w: 700, move: [0, -50, 40, 0], dur: 26 },
  { c: 'rgba(255,91,107,0.16)', x: '72%', y: '10%', w: 520, move: [0, 40, -20, 0], dur: 30 },
];

// Aurora: three soft, drifting colour fields behind the hero, fading into the night.
export function Aurora() {
  const reduced = useReducedMotion();
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ maskImage: 'linear-gradient(180deg, #000 0%, #000 55%, transparent 100%)', WebkitMaskImage: 'linear-gradient(180deg, #000 0%, #000 55%, transparent 100%)' }}
    >
      {BLOBS.map((b, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            left: b.x,
            top: b.y,
            width: b.w,
            height: b.w * 0.62,
            background: `radial-gradient(closest-side, ${b.c}, transparent)`,
            filter: 'blur(40px)',
          }}
          animate={reduced ? undefined : { x: b.move, y: b.move.map((v) => v * -0.6), scale: [1, 1.12, 0.95, 1] }}
          transition={{ duration: b.dur, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
      <Stars />
      {/* horizon grid */}
      <svg className="absolute inset-x-0 bottom-0 h-[45%] w-full opacity-[0.35]" preserveAspectRatio="none" viewBox="0 0 100 40">
        <defs>
          <linearGradient id="grid-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2dd4ef" stopOpacity="0" />
            <stop offset="1" stopColor="#2dd4ef" stopOpacity="0.5" />
          </linearGradient>
        </defs>
        {Array.from({ length: 21 }, (_, i) => (
          <line key={`v${i}`} x1={50} y1={0} x2={-50 + i * 10} y2={40} stroke="url(#grid-fade)" strokeWidth="0.08" />
        ))}
        {[4, 9, 15, 22, 30, 39].map((y) => (
          <line key={`h${y}`} x1={0} y1={y} x2={100} y2={y} stroke="url(#grid-fade)" strokeWidth="0.08" />
        ))}
      </svg>
    </div>
  );
}
