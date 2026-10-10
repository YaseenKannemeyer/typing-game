import { useCallback, useEffect, useRef, useState } from 'react';
import { TRANSIENT_MS, type VehicleAnimation } from '../art/vehicleArt';

/**
 * React version of the kit's VehicleView.play(): `play()` shows a transient
 * state (retriggerable via the key) and falls back to `base` afterwards.
 */
export function useVehicleAnimation(base: VehicleAnimation) {
  const [transient, setTransient] = useState<{ state: VehicleAnimation; key: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const play = useCallback((state: VehicleAnimation) => {
    clearTimeout(timer.current);
    setTransient((t) => ({ state, key: (t?.key ?? 0) + 1 }));
    const ms = TRANSIENT_MS[state];
    if (ms) timer.current = setTimeout(() => setTransient(null), ms);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return { animation: transient?.state ?? base, animationKey: transient?.key ?? 0, play };
}
