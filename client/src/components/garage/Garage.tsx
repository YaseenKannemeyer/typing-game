import { useEffect, useState } from 'react';
import { CAR_COLORS } from '@race/shared';
import type { VehicleBuild } from '../../art/vehicleArt';
import { api, errorMessage } from '../../lib/api';
import { saveBuild } from '../../lib/storage';
import { requireSupabase } from '../../lib/supabase';
import { buildOf, vehicleFor } from '../../game/vehicles';
import type { LobbyPlayer } from '../../game/types';
import { GarageView } from './GarageView';
import type { GarageFeedback, GarageViewModel } from './garageViewModel';

interface Props {
  lobbyId: string;
  me: LobbyPlayer;
  meIndex: number;
  players: LobbyPlayer[];
  /** Editing is locked once a race starts. */
  locked: boolean;
}

/**
 * The garage's state and network: the draft build follows the server until the
 * player edits, and confirming saves colour, then build, then the local and
 * profile copies. GarageView renders it.
 */
export function Garage({ lobbyId, me, meIndex, players, locked }: Props) {
  const current = vehicleFor(me, meIndex);
  const [build, setBuild] = useState<VehicleBuild>(() => buildOf(current));
  const [primary, setPrimary] = useState(current.primary);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<GarageFeedback>({ kind: 'idle' });

  // Follow server changes (e.g. saved build applied on join) until the player edits.
  useEffect(() => {
    if (dirty) return;
    setBuild(buildOf(current));
    setPrimary(current.primary);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(me.vehicle), me.car_color, dirty]);

  const taken = new Set(players.filter((p) => p.user_id !== me.user_id).map((p) => p.car_color));
  const markDirty = () => {
    setDirty(true);
    setFeedback({ kind: 'draft' });
  };
  const edit = (patch: Partial<VehicleBuild>) => {
    setBuild((b) => ({ ...b, ...patch }));
    markDirty();
  };
  const paint = (color: string) => {
    setPrimary(color);
    markDirty();
  };

  const confirm = async () => {
    setBusy(true);
    try {
      if (primary !== me.car_color) await api.setCarColor(lobbyId, primary);
      const saved = await api.setVehicle(lobbyId, build);
      const stored = saveBuild({ build: saved, primary });
      // Accounts also keep the build on their profile (cosmetic; best effort).
      const { data } = await requireSupabase().auth.getSession();
      if (data.session?.user.is_anonymous === false) void api.setProfileGarage(saved, primary).catch(() => {});
      setDirty(false);
      setFeedback({ kind: 'saved', stored });
    } catch (e) {
      setFeedback({ kind: 'error', message: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const model: GarageViewModel = {
    driverName: me.name,
    draft: build,
    primary,
    colors: CAR_COLORS.map((value) => ({ value, taken: taken.has(value) })),
    locked,
    busy,
    dirty,
    feedback,
  };
  return <GarageView model={model} actions={{ edit, paint, confirm: () => void confirm() }} />;
}
