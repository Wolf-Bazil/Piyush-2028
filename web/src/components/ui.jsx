import { animate, motion, useInView, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

export const EASE = [0.16, 1, 0.3, 1];

export function Wrap({ className = '', narrow = false, children }) {
  return (
    <div className={`relative mx-auto w-full ${narrow ? 'max-w-[880px]' : 'max-w-[1240px]'} px-4 sm:px-8 ${className}`}>
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
      <span className="h-1.5 w-1.5 rounded-full bg-weather shadow-glow" />
      {children}
    </p>
  );
}

export function SectionHead({ eyebrow, title, lead, className = '' }) {
  return (
    <Reveal className={`max-w-3xl ${className}`}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className="grad-text mt-5 text-[clamp(30px,3.6vw,48px)] font-semibold leading-[1.06] tracking-[-0.035em] [text-wrap:balance]">
        {title}
      </h2>
      {lead && <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-ink-2">{lead}</p>}
    </Reveal>
  );
}

// The primary pill: white, with a cyan glow that grows on hover.
export function PillButton({ children, className = '', ...rest }) {
  const Tag = rest.href ? 'a' : 'button';
  return (
    <Tag
      {...rest}
      className={`group relative inline-flex h-12 items-center gap-3 rounded-full bg-white pl-6 pr-5 text-[15px] font-semibold text-paper shadow-pill transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-x-[1.03] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_14px_60px_-6px_rgba(45,212,239,0.8)] active:scale-[0.98] ${className}`}
    >
      {children}
      <span className="relative h-1.5 w-1.5">
        <span className="absolute -inset-2 rounded-full bg-[radial-gradient(circle,rgba(45,212,239,0.9)_0%,rgba(45,212,239,0.25)_40%,transparent_70%)] opacity-70 transition-all duration-500 group-hover:scale-150 group-hover:opacity-100" />
        <span className="absolute inset-0 rounded-full bg-weather" />
      </span>
    </Tag>
  );
}

export function GhostButton({ children, className = '', ...rest }) {
  const Tag = rest.href ? 'a' : 'button';
  return (
    <Tag
      {...rest}
      className={`group inline-flex h-12 items-center gap-2 rounded-full border hairline-2 bg-white/[0.04] px-6 text-[15px] font-medium text-ink backdrop-blur transition-all duration-300 hover:border-weather/50 hover:bg-white/[0.07] active:scale-[0.98] ${className}`}
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
  return <div className={`glass rounded-2xl ${className}`}>{children}</div>;
}

export function Dot({ color, pulse = false, size = 8 }) {
  return (
    <span className="relative inline-flex" style={{ width: size, height: size }}>
      {pulse && <span className="absolute -inset-1 rounded-full breathe" style={{ background: color }} />}
      <span className="relative inline-flex rounded-full" style={{ width: size, height: size, background: color }} />
    </span>
  );
}
