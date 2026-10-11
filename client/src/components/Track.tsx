import { useEffect, useMemo, useRef } from 'react';
import { motion, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import { MOTION } from '../art/motion';
import { laneLeft } from '../art/vehicleAnchors';
import type { VehicleProps } from '../art/vehicleArt';
import {
  circuitFlagSvg,
  decorative,
  destinationSceneSvg,
  finishStripeSvg,
  kerbSvg,
  roadSurfaceSvg,
  startGridSvg,
  type DestinationId,
} from '../art/worldArt';
import { useVehicleAnimation } from '../game/useVehicleAnimation';
import { Car } from './Car';
import { TrustedSvg } from './TrustedSvg';

export interface TrackCar {
  id: string;
  name: string;
  vehicle: VehicleProps;
  rank: number;
  /** 0..1, where the car sits on the road. */
  progress: number;
  /** Percentage shown on the lane (defaults to the road position). */
  percent?: number;
  wpm: number;
  errors: number;
  finished: boolean;
  isMe: boolean;
}

interface Props {
  /** Already windowed by getVisibleCars (≤ 4), leader-most first. */
  cars: TrackCar[];
  total: number;
  started: boolean;
  destination: DestinationId;
  /** Five ruler labels, start to finish. */
  ruler?: readonly string[];
  /** Lanes to draw on desktop; lanes without a racer stay as empty road (hidden on smaller screens). */
  lanes?: number;
}

/** Cars glide to each new position instead of stepping (positions update a few times a second). */
const CAR_SPRING = { stiffness: 42, damping: 16, mass: 1 };

const RULER = ['START', '25%', '50%', '75%', 'FINISH'] as const;
const BARRIER = ['GRID MOTOR CLUB', 'TYPE / RACE / REPEAT', 'PRECISION WINS'];

// Static circuit artwork, built once (decorative: the lanes carry the meaning).
const ART = {
  // Stretched to the full track width (the kit's kerb is a repeating strip).
  kerb: decorative(kerbSvg()).replace('<svg ', '<svg preserveAspectRatio="none" '),
  grid: decorative(startGridSvg()),
  stripe: decorative(finishStripeSvg()),
  flag: decorative(circuitFlagSvg()),
  // 17-circuit asphalt (grain, edge lines, tyre marks), stretched to each lane.
  road: laneRoad(false),
  roadWet: laneRoad(true),
};

/** The kit's road minus its dashed bottom line: the lane's own dashed separator already draws it. */
function laneRoad(wet: boolean) {
  return decorative(roadSurfaceSvg({ wet }))
    .replace('<svg ', '<svg preserveAspectRatio="none" ')
    .replace('<path d="M0 149H1200" stroke="#d2d9ba" stroke-width="2" stroke-dasharray="20 18"/>', '');
}

/**
 * 17-circuit: destination scenery, barrier, distance ruler and up to four
 * keyed lanes. Cars are placed by our front-bumper anchors (vehicleAnchors),
 * so at progress 1 every model's bumper meets the finish stripe.
 */
export function Track({ cars, total, started, destination, ruler = RULER, lanes = 0 }: Props) {
  const reducedMotion = useReducedMotion();
  const sky = useMemo(() => decorative(destinationSceneSvg(destination)), [destination]);
  return (
    <section className="w-circuit" aria-label={`Race track, ${total} racers`}>
      <div className="w-circuit-sky">
        <TrustedSvg markup={sky} />
      </div>
      <div className="w-track-barrier" aria-hidden="true">
        {BARRIER.map((t) => <span key={t}>{t}</span>)}
      </div>
      <div className="w-distance" aria-hidden="true">
        {ruler.map((label, i) => <span key={i}>{label}</span>)}
      </div>
      <div className="w-lane-list">
        {cars.map((car) => (
          // Keyed by player id: lanes swap with a FLIP layout animation, cars never remount.
          <motion.div
            key={car.id}
            layout={reducedMotion ? false : 'position'}
            transition={{ layout: { duration: MOTION.ms.laneSwap / 1000, ease: MOTION.easing.standard } }}
            className={`w-lane ${car.isMe ? 'is-you' : ''}`}
          >
            <Lane car={car} started={started} wet={destination === 'rain'} />
          </motion.div>
        ))}
        {Array.from({ length: Math.max(0, lanes - cars.length) }, (_, i) => (
          <div key={`empty-${i}`} className="w-lane w-lane--empty" aria-hidden="true">
            <div className="w-lane-name">
              <strong>Open lane</strong>
            </div>
            <div className={`w-road ${destination === 'rain' ? 'wet' : ''}`}>
              <div className="w-road-surface">
                <TrustedSvg markup={destination === 'rain' ? ART.roadWet : ART.road} />
              </div>
              <div className="w-grid-paint">
                <TrustedSvg markup={ART.grid} />
              </div>
              <div className="w-distance-lines" />
              <div className="w-finish-paint">
                <TrustedSvg markup={ART.stripe} />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="w-kerb">
        <TrustedSvg markup={ART.kerb} />
      </div>
      <div className="w-finish-flag">
        <TrustedSvg markup={ART.flag} />
      </div>
    </section>
  );
}

function Lane({ car, started, wet }: { car: TrackCar; started: boolean; wet: boolean }) {
  const base = car.finished ? (car.rank === 1 ? 'winner' : 'finish') : started ? 'driving' : 'idle';
  const { animation, animationKey, play } = useVehicleAnimation(base);
  const prev = useRef({ errors: car.errors, rank: car.rank, started });

  useEffect(() => {
    const p = prev.current;
    if (started && !p.started) play('start');
    else if (!car.finished && car.errors > p.errors) play('mistake');
    else if (!car.finished && started && car.rank < p.rank) play('overtake');
    prev.current = { errors: car.errors, rank: car.rank, started };
  }, [car.errors, car.rank, car.finished, started, play]);

  const progress = Math.min(1, Math.max(0, car.progress));
  const pct = Math.round(car.percent ?? progress * 100);
  const reducedMotion = useReducedMotion();
  // Cars never roll backwards: a downward correction (e.g. after a rejoin) holds the car until it catches up.
  const furthest = useRef(0);
  if (!started) furthest.current = 0;
  furthest.current = Math.max(furthest.current, progress);
  const shown = furthest.current;
  const at = useSpring(shown, CAR_SPRING);
  useEffect(() => {
    if (reducedMotion) at.jump(shown);
    else at.set(shown);
  }, [at, shown, reducedMotion]);
  const model = car.vehicle.model;
  const left = useTransform(at, (v) => laneLeft(model, v));
  return (
    <>
      <div className="w-lane-name">
        <strong>{car.name}</strong>
        <span>P{car.rank}{car.isMe ? ' · YOU' : ''}</span>
        <small>{Math.round(car.wpm)} WPM</small>
      </div>
      <div className={`w-road ${wet ? 'wet' : ''}`} aria-label={`${car.name}, position ${car.rank}, ${pct} percent`}>
        <div className="w-road-surface">
          <TrustedSvg markup={wet ? ART.roadWet : ART.road} />
        </div>
        <div className="w-grid-paint">
          <TrustedSvg markup={ART.grid} />
        </div>
        <div className="w-distance-lines" />
        <motion.div className="w-track-racer" style={{ left }}>
          <Car vehicle={car.vehicle} animation={animation} animationKey={animationKey} />
        </motion.div>
        <div className="w-finish-paint">
          <TrustedSvg markup={ART.stripe} />
        </div>
        <span className="g-lane-percent">{pct}%</span>
      </div>
    </>
  );
}
