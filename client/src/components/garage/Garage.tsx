import { useEffect, useState } from 'react';
import { CAR_COLORS } from '@race/shared';
import {
  MODEL_GEOMETRY,
  VEHICLE_EFFECTS,
  VEHICLE_STATES,
  WHEEL_STYLES,
  type VehicleAnimation,
  type VehicleBuild,
} from '../../art/vehicleArt';
import { api, errorMessage } from '../../lib/api';
import { saveBuild } from '../../lib/storage';
import { requireSupabase } from '../../lib/supabase';
import { buildOf, vehicleFor } from '../../game/vehicles';
import { useVehicleAnimation } from '../../game/useVehicleAnimation';
import type { LobbyPlayer } from '../../game/types';
import { Car } from '../Car';

const WHEEL_LABELS: Record<(typeof WHEEL_STYLES)[number], string> = {
  sport: 'Sport · five spoke',
  aero: 'Aero · turbine disc',
  retro: 'Retro · wire spoke',
};
const EFFECT_LABELS: Record<(typeof VEHICLE_EFFECTS)[number], string> = {
  none: 'Clean / no effect',
  smoke: 'Exhaust smoke',
  trails: 'Speed trails',
  neon: 'Neon underglow',
};

interface Props {
  lobbyId: string;
  me: LobbyPlayer;
  meIndex: number;
  players: LobbyPlayer[];
  /** Editing is locked once a race starts. */
  locked: boolean;
}

const inputClass =
  'mt-2 block h-10 w-full rounded-[7px] border border-line-hi bg-well px-2 text-fg disabled:opacity-50';

/** The kit's pre-race garage, wired to the lobby. Purely cosmetic. */
export function Garage({ lobbyId, me, meIndex, players, locked }: Props) {
  const current = vehicleFor(me, meIndex);
  const [build, setBuild] = useState<VehicleBuild>(() => buildOf(current));
  const [primary, setPrimary] = useState(current.primary);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('You can change your build while waiting in the lobby.');
  const preview = useVehicleAnimation('idle');

  // Follow server changes (e.g. saved build applied on join) until the player edits.
  useEffect(() => {
    if (dirty) return;
    setBuild(buildOf(current));
    setPrimary(current.primary);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(me.vehicle), me.car_color, dirty]);

  const taken = new Set(players.filter((p) => p.user_id !== me.user_id).map((p) => p.car_color));
  const model = MODEL_GEOMETRY.find((m) => m.id === build.model)!;
  const edit = (patch: Partial<VehicleBuild>) => {
    setBuild((b) => ({ ...b, ...patch }));
    setDirty(true);
    setStatus('Unsaved changes. Confirm your build when ready.');
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
      setStatus(stored ? 'Selection saved. You can keep editing while waiting in the lobby.' : 'Selection confirmed for this lobby. Browser storage is unavailable.');
    } catch (e) {
      setStatus(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">The collection <span className="ml-2 text-sm text-muted">15</span></h3>
          <span className="text-[9px] tracking-widest text-subtle">ALL MODELS UNLOCKED</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {MODEL_GEOMETRY.map((m, i) => {
            const selected = m.id === build.model;
            return (
              <button
                key={m.id}
                disabled={locked}
                aria-pressed={selected}
                onClick={() => edit({ model: m.id })}
                className="garage-card rounded-[13px] border border-line bg-panel p-3 text-left transition hover:border-line-hi hover:bg-panel-hi aria-pressed:border-lime aria-pressed:bg-[#283423] disabled:opacity-60"
              >
                <div className={`flex justify-between font-mono text-[10px] ${selected ? 'text-lime' : 'text-subtle'}`}>
                  <span>{String(i + 1).padStart(2, '0')} / GRID</span>
                  <span>{selected ? 'SELECTED' : '↗'}</span>
                </div>
                <Car vehicle={{ ...build, model: m.id, primary, playerName: me.name }} className="my-2" />
                <div className="text-[13px] font-semibold">{m.name}</div>
                <div className="text-[10px] text-muted">{m.tag}</div>
              </button>
            );
          })}
        </div>
      </section>

      <aside className="self-start lg:sticky lg:top-4">
        <div className="overflow-hidden rounded-t-[15px] bg-paper px-6 pb-4 pt-6 text-paper-ink">
          <div className="flex items-center justify-between">
            <span className="eyebrow !text-[#53694c]">YOUR BUILD</span>
            <span className="text-[9px] text-[#3b6342]">● LIVE PREVIEW</span>
          </div>
          <h3 className="mt-1 text-[27px] font-semibold tracking-tight">{model.name}</h3>
          <p className="text-xs text-paper-muted">{model.tag}</p>
          <Car
            vehicle={{ ...build, primary, playerName: me.name }}
            animation={preview.animation}
            animationKey={preview.animationKey}
            className="pt-6"
          />
          <div className="h-px bg-[#a3b395]" />
          <div className="mt-3 flex justify-between font-mono text-[9px] text-[#586c50]">
            <span>{preview.animation.toUpperCase()}</span>
            <span>100% COSMETIC</span>
          </div>
        </div>

        <section className="space-y-4 rounded-b-[15px] border border-t-0 border-line bg-panel p-6 text-[11px] text-muted">
          <div>
            <span>Body colour</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {CAR_COLORS.map((c) => (
                <button
                  key={c}
                  disabled={locked || taken.has(c)}
                  onClick={() => {
                    setPrimary(c);
                    setDirty(true);
                    setStatus('Unsaved changes. Confirm your build when ready.');
                  }}
                  className={`h-7 w-7 rounded-full border-2 transition disabled:cursor-not-allowed disabled:opacity-20 ${primary === c ? 'scale-110 border-fg' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                  aria-label={`Body colour ${c}${taken.has(c) ? ' (taken)' : ''}`}
                  aria-pressed={primary === c}
                />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label>
              Accent colour
              <input type="color" value={build.accent} disabled={locked} onChange={(e) => edit({ accent: e.target.value })} className={`${inputClass} cursor-pointer p-1`} />
            </label>
            <label>
              Race number
              <input
                type="number" min={0} max={99} value={build.number} disabled={locked}
                onChange={(e) => edit({ number: Math.max(0, Math.min(99, parseInt(e.target.value) || 0)) })}
                className={inputClass}
              />
            </label>
          </div>
          <label className="block">
            Wheel design
            <select value={build.wheels} disabled={locked} onChange={(e) => edit({ wheels: e.target.value as VehicleBuild['wheels'] })} className={inputClass}>
              {WHEEL_STYLES.map((w) => <option key={w} value={w}>{WHEEL_LABELS[w]}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label>
              Cosmetic effect
              <select value={build.effect} disabled={locked} onChange={(e) => edit({ effect: e.target.value as VehicleBuild['effect'] })} className={inputClass}>
                {VEHICLE_EFFECTS.map((f) => <option key={f} value={f}>{EFFECT_LABELS[f]}</option>)}
              </select>
            </label>
            <label className="flex items-end gap-2 pb-2">
              <input type="checkbox" checked={build.stripes} disabled={locked} onChange={(e) => edit({ stripes: e.target.checked })} className="h-5 w-5 accent-lime" />
              Racing stripes
            </label>
          </div>
          <label className="block">
            Test an animation
            <select value="" onChange={(e) => e.target.value && preview.play(e.target.value as VehicleAnimation)} className={inputClass}>
              <option value="">Choose…</option>
              {VEHICLE_STATES.map((s) => <option key={s} value={s}>{s[0]!.toUpperCase() + s.slice(1)}</option>)}
            </select>
          </label>
          <button
            onClick={confirm}
            disabled={locked || busy || !dirty}
            className="flex w-full justify-between rounded-lg bg-lime px-4 py-3 text-sm font-semibold text-lime-ink disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Confirm vehicle'} <span>→</span>
          </button>
          <p role="status" className="text-[10px] leading-relaxed">{locked ? 'Your car is locked in while the race is on.' : status}</p>
        </section>
      </aside>
    </div>
  );
}
