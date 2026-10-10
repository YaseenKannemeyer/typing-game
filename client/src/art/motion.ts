/**
 * Motion spec from design-kits/grid-design-kits/14-motion/motion.json.
 * Timings are presentational only and never control race state.
 */
export const MOTION = {
  easing: {
    standard: [0.2, 0.7, 0.3, 1] as const,
    position: 'linear' as const,
    celebration: [0.18, 0.8, 0.35, 1.2] as const,
  },
  ms: {
    hover: 120,
    screenEnter: 220,
    laneSwap: 260,
    progressInterpolation: 180,
    vehicleMistake: 300,
    overtake: 650,
    awardReveal: 650,
    modeReveal: 420,
    diceReveal: 700,
    confetti: 1700,
    toast: 4000,
  },
} as const;

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
