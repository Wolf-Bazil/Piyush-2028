import { motion, useScroll, useTransform } from 'framer-motion';
import { Github } from 'lucide-react';
import { Wrap } from './ui';

const LINKS = [
  { href: '#live', label: 'Live network' },
  { href: '#engine', label: 'Engine' },
  { href: '#maintenance', label: 'Maintenance' },
  { href: '#evaluation', label: 'Evaluation' },
];

export const REPO = 'https://github.com/Wolf-Bazil/Piyush-2028';

export function Logo() {
  return (
    <a href="#top" className="inline-flex items-center gap-2.5">
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill="#16130f" />
        <circle cx="16" cy="16" r="4" fill="#fff" />
        <circle cx="16" cy="16" r="9" fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth="1.5" />
      </svg>
      <span className="text-[16px] font-semibold tracking-[-0.03em] text-ink">SkyNova</span>
    </a>
  );
}

export function Nav() {
  const { scrollY } = useScroll();
  const border = useTransform(scrollY, [0, 40], ['rgba(22,19,15,0)', 'rgba(22,19,15,0.075)']);
  return (
    <motion.header style={{ borderBottomColor: border }} className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-md">
      <Wrap className="flex h-16 items-center justify-between">
        <Logo />
        <nav className="hidden items-center gap-7 md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-[14px] text-ink-2 transition-colors hover:text-ink">
              {l.label}
            </a>
          ))}
        </nav>
        <a
          href={REPO}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 items-center gap-2 rounded-full border hairline-2 px-4 text-[13px] font-medium text-ink transition-colors hover:border-ink/30"
        >
          <Github size={15} strokeWidth={1.8} />
          Source
        </a>
      </Wrap>
    </motion.header>
  );
}

export function Footer() {
  return (
    <footer className="border-t hairline py-12">
      <Wrap className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Logo />
          <p className="mt-4 max-w-md text-[13.5px] leading-relaxed text-ink-2">
            AI/ML-based intelligent anomaly detection for Automatic Weather Stations. Smart India Hackathon 2026, problem statement SIH26073,
            theme Disaster Management.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-10 gap-y-1 text-[13px]">
          <span className="text-ink-3">Team</span>
          <span className="text-ink">SkyNova</span>
          <span className="text-ink-3">Team ID</span>
          <span className="font-mono text-ink">162269</span>
          <span className="text-ink-3">Category</span>
          <span className="text-ink">Software</span>
          <span className="text-ink-3">Code</span>
          <a href={REPO} target="_blank" rel="noreferrer" className="text-ink underline decoration-ink/20 underline-offset-4 hover:decoration-ink">
            GitHub
          </a>
        </div>
      </Wrap>
    </footer>
  );
}
