import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { environmentSvg, finishFlagSvg, type SceneId } from '../art/gridArt';
import { MOTION } from '../art/motion';
import { laneLeft } from '../art/vehicleAnchors';
import type { VehicleProps } from '../art/vehicleArt';
import { useVehicleAnimation } from '../game/useVehicleAnimation';
import { Car } from './Car';
import { TrustedSvg } from './TrustedSvg';

export interface TrackCar {
  id: string;
  name: string;
  vehicle: VehicleProps;
  rank: number;
  /** 0..1 */
  progress: number;
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
  scene: SceneId;
  /** Five ruler labels, start to finish. */
  ruler?: readonly string[];
}

const RULER = ['START', '25%', '50%', '75%', 'FINISH'] as const;

/** 06-track: scenery, ruler, four keyed lanes and the animated finish flag. */
export function Track({ cars, total, started, scene, ruler = RULER }: Props) {
  return (
    <div className="g-track" aria-label={`Race track, ${total} racers`}>
      <div className="g-track-scenery">
        <TrustedSvg markup={environmentSvg(scene)} />
      </div>
      <div className="g-track-ruler" aria-hidden="true">
        {ruler.map((label, i) => (
          <span key={i}>{label}</span>
        ))}
      </div>
      <div className="g-track-lanes">
        {cars.map((car) => (
          // Keyed by player id: lanes swap with a FLIP layout animation, cars never remount.
          <motion.div
            key={car.id}
            layout="position"
            transition={{ layout: { duration: MOTION.ms.laneSwap / 1000, ease: MOTION.easing.standard } }}
            className={`g-lane ${car.isMe ? 'is-you' : ''}`}
          >
            <Lane car={car} started={started} />
          </motion.div>
        ))}
      </div>
      <div className="g-track-flag">
        <TrustedSvg markup={finishFlagSvg()} />
      </div>
    </div>
  );
}

function Lane({ car, started }: { car: TrackCar; started: boolean }) {
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
  const pct = Math.round(progress * 100);
  return (
    <>
      <div className="g-lane-label">
        <strong>
          {car.name} {car.isMe && <span>YOU</span>}
        </strong>
        <small>P{car.rank} · {Math.round(car.wpm)} WPM</small>
      </div>
      <div className="g-lane-road" aria-label={`${car.name}, position ${car.rank}, ${pct} percent`}>
        <div className="g-grid-marks" aria-hidden="true" />
        <div className="g-racer" style={{ left: laneLeft(car.vehicle.model, progress) }}>
          <Car vehicle={car.vehicle} animation={animation} animationKey={animationKey} />
        </div>
        <span className="g-lane-percent">{pct}%</span>
      </div>
    </>
  );
}
