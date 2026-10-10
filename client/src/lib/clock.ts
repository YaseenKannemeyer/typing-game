import { useEffect, useState } from 'react';
import { api } from './api';

/**
 * Estimates (server time - local time) from a few round trips, keeping the
 * sample with the lowest latency. Add the result to Date.now().
 */
export async function measureClockOffset(samples = 4): Promise<number> {
  let best = { rtt: Infinity, offset: 0 };
  for (let i = 0; i < samples; i++) {
    const t0 = Date.now();
    const server = Date.parse(await api.serverNow());
    const t1 = Date.now();
    const rtt = t1 - t0;
    if (rtt < best.rtt) best = { rtt, offset: server + rtt / 2 - t1 };
  }
  return best.offset;
}

/** Server-synchronised "now", re-rendering every `intervalMs`. */
export function useServerNow(offset: number, intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    setNow(Date.now() + offset);
    const t = setInterval(() => setNow(Date.now() + offset), intervalMs);
    return () => clearInterval(t);
  }, [offset, intervalMs]);
  return now;
}
