import { DEFAULT_BUILD, normalizeVehicle, type VehicleBuild, type VehicleProps } from '../art/vehicleArt';
import type { LobbyPlayer } from './types';

/** Render props for a lobby player's car: their garage build plus lobby colour. */
export function vehicleFor(player: Pick<LobbyPlayer, 'name' | 'car_color' | 'vehicle'>, index = 0): VehicleProps {
  const hasBuild = player.vehicle && Object.keys(player.vehicle).length > 0;
  return normalizeVehicle({
    ...DEFAULT_BUILD,
    number: index + 1,
    ...(hasBuild ? player.vehicle : {}),
    primary: player.car_color,
    playerName: player.name,
  });
}

export function buildOf(v: VehicleProps): VehicleBuild {
  return { model: v.model, accent: v.accent, wheels: v.wheels, stripes: v.stripes, number: v.number, effect: v.effect };
}
