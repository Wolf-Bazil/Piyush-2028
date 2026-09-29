import { useInView } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Footer, Nav } from './components/Chrome';
import Engine from './components/Engine';
import Evaluation from './components/Evaluation';
import Hero from './components/Hero';
import LiveNetwork from './components/LiveNetwork';
import Maintenance from './components/Maintenance';
import { loadNetwork } from './lib/data';
import { useReplay } from './lib/useReplay';

// Start just before the first injected fault, so pressing play shows action fast.
const START_DAY = 2.4;

function Loaded({ data }) {
  const replay = useReplay(data.steps, Math.round(START_DAY * 24 * data.stepsPerHour));
  const liveRef = useRef(null);
  const inView = useInView(liveRef, { once: true, amount: 0.25 });
  const { setPlaying, setSpeed } = replay;

  // Autoplay the first time the network scrolls into view.
  useEffect(() => {
    if (inView && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setSpeed(1);
      setPlaying(true);
    }
  }, [inView, setPlaying, setSpeed]);

  return (
    <>
      <Hero metrics={data.metrics} />
      <div ref={liveRef}>
        <LiveNetwork data={data} replay={replay} />
      </div>
      <Engine />
      <Maintenance data={data} t={replay.t} />
      <Evaluation data={data} />
    </>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadNetwork().then(setData).catch((e) => setError(e.message));
  }, []);

  return (
    <div id="top" className="min-h-screen bg-white">
      <Nav />
      <main>
        {data ? (
          <Loaded data={data} />
        ) : (
          <div className="flex min-h-[70vh] items-center justify-center">
            <p className="inline-flex items-center gap-3 text-[14px] text-ink-2">
              <span className="h-2 w-2 rounded-full bg-ink breathe" />
              {error ? `Could not load network data: ${error}` : 'Loading the station network'}
            </p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
