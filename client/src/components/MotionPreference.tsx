import type { ReactNode } from 'react';
import { MotionConfig } from 'framer-motion';
import { useComfort } from '../lib/comfort';

/** The "Reduce motion" comfort switch; with it off, framer-motion still follows the OS setting. */
export function MotionPreference({ children }: { children: ReactNode }) {
  const [prefs] = useComfort();
  return <MotionConfig reducedMotion={prefs.reduceMotion ? 'always' : 'user'}>{children}</MotionConfig>;
}
