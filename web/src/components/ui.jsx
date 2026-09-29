import { animate, motion, useInView, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

export const EASE = [0.16, 1, 0.3, 1];

export function Wrap({ className = '', narrow = false, children }) {
  return (
    <div className={`mx-auto w-full ${narrow ? 'max-w-[880px]' : 'max-w-[1240px]'} px-4 sm:px-8 ${className}`}>
      {children}
    </div>
  );
}

// Rises into place once, with a soft blur, the first time it scrolls into view.
export function Reveal({ children, delay = 0, y = 22, className = '', as = 'div' }) {
  const reduced = useReducedMotion();
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      initial={reduced ? false : { opacity: 0, y, filter: 'blur(6px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '0px 0px -8% 0px' }}
      transition={{ duration: 0.9, ease: EASE, delay: delay / 1000 }}
    >
      {children}
    </Tag>
  );
}

export function Eyebrow({ children, className = '' }) {
  return (
    <p className={`inline-flex items-center gap-2.5 text-[13px] font-medium text-ink-2 ${className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-ink" />
      {children}
    </p>
  );
}

export function SectionHead({ eyebrow, title, lead, className = '' }) {
  return (
    <Reveal className={`max-w-3xl ${className}`}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className="mt-5 text-[clamp(30px,3.6vw,48px)] font-semibold leading-[1.06] tracking-[-0.035em] text-ink [text-wrap:balance]">
        {title}
      </h2>
      {lead && <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-ink-2">{lead}</p>}
    </Reveal>
  );
}

// The ink pill with its small light.
export function PillButton({ children, className = '', ...rest }) {
  const Tag = rest.href ? 'a' : 'button';
  return (
    <Tag
      {...rest}
      className={`group relative inline-flex h-12 items-center gap-3 rounded-full bg-ink pl-6 pr-5 text-[15px] font-medium text-white shadow-pill transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-x-[1.03] active:scale-[0.98] ${className}`}
    >
      {children}
      <span className="relative h-1.5 w-1.5">
        <span className="absolute -inset-2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.9)_0%,rgba(255,255,255,0.25)_40%,transparent_70%)] opacity-60 transition-all duration-500 group-hover:scale-125 group-hover:opacity-100" />
        <span className="absolute inset-0 rounded-full bg-white" />
      </span>
    </Tag>
  );
}

export function GhostButton({ children, className = '', ...rest }) {
  const Tag = rest.href ? 'a' : 'button';
  return (
    <Tag
      {...rest}
      className={`group inline-flex h-12 items-center gap-2 rounded-full border hairline-2 bg-white px-6 text-[15px] font-medium text-ink transition-all duration-300 hover:border-ink/30 active:scale-[0.98] ${className}`}
    >
      {children}
      <span aria-hidden="true" className="transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1">
        →
      </span>
    </Tag>
  );
}

// Counts up to its value once, when scrolled into view.
export function CountUp({ to, decimals = 0, suffix = '', prefix = '', duration = 1.4, className = '' }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -10% 0px' });
  const reduced = useReducedMotion();
  const [v, setV] = useState(to);

  useEffect(() => {
    if (!inView || reduced) return;
    const ctl = animate(0, to, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: setV,
    });
    return () => ctl.stop();
  }, [inView, reduced, to, duration]);

  return (
    <span ref={ref} className={`tabular ${className}`}>
      {prefix}
      {decimals ? v.toFixed(decimals) : Math.round(v).toLocaleString('en-IN')}
      {suffix}
    </span>
  );
}

export function Card({ children, className = '' }) {
  return <div className={`rounded-2xl border hairline bg-white shadow-lift ${className}`}>{children}</div>;
}

export function Dot({ color, pulse = false, size = 8 }) {
  return (
    <span className="relative inline-flex" style={{ width: size, height: size }}>
      {pulse && <span className="absolute -inset-1 rounded-full breathe" style={{ background: color }} />}
      <span className="relative inline-flex rounded-full" style={{ width: size, height: size, background: color }} />
    </span>
  );
}
