import { useLayoutEffect, useMemo, useRef } from 'react';
import { normalizeVehicle, vehicleSvg, type VehicleAnimation, type VehicleProps } from '../art/vehicleArt';
import { liveryOverlay, normalizeLivery } from '../art/worldArt';

interface Props {
  vehicle: Partial<VehicleProps>;
  animation?: VehicleAnimation;
  /** Change to replay the same animation (e.g. two mistakes in a row). */
  animationKey?: number;
  className?: string;
}

/**
 * A vehicle-kit car. The SVG is only rebuilt when the appearance changes;
 * animation and effect are applied as data attributes like the kit's
 * VehicleView.update(), so CSS animations are not restarted on every render.
 */
export function Car({ vehicle, animation = 'idle', animationKey = 0, className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const v = normalizeVehicle(vehicle);
  const livery = normalizeLivery(vehicle);
  const markup = useMemo(() => {
    const svg = vehicleSvg({ ...v, animation: 'idle', effect: 'none' });
    // Racing-world livery (kit 21): team decal and driver lettering on the body.
    return livery.team ? svg.replace(/<\/svg>$/, liveryOverlay(v.model, { ...livery, team: livery.team }) + '</svg>') : svg;
    // Appearance fields only, matching the kit's rebuild rule.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.model, v.primary, v.accent, v.wheels, v.stripes, v.number, v.playerName, livery.team, livery.decal, livery.driver]);

  useLayoutEffect(() => {
    const svg = ref.current?.firstElementChild as SVGElement | null;
    if (svg) svg.dataset.effect = v.effect;
  }, [markup, v.effect]);

  useLayoutEffect(() => {
    const svg = ref.current?.firstElementChild as SVGElement | null;
    if (!svg) return;
    // Reset first so a repeated transient (mistake → mistake) replays.
    svg.dataset.state = 'idle';
    void svg.getBoundingClientRect();
    svg.dataset.state = animation;
  }, [markup, animation, animationKey]);

  return <div ref={ref} className={className} dangerouslySetInnerHTML={{ __html: markup }} />;
}
