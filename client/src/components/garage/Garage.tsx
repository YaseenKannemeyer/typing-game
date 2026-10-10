import { useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react';
import { CAR_COLORS } from '@race/shared';
import {
  MODEL_GEOMETRY,
  VEHICLE_EFFECTS,
  VEHICLE_STATES,
  WHEEL_STYLES,
  type VehicleAnimation,
  type VehicleBuild,
} from '../../art/vehicleArt';
import {
  DECAL_IDS,
  decorative,
  DRIVER_LABEL_MAX,
  helmetSvg,
  numberPlateSvg,
  sanitizeDriver,
  TEAMS,
  teamBadgeSvg,
  WORKSHOP_STATIONS,
  workshopBackgroundSvg,
  type DecalId,
  type TeamId,
  type WorkshopStation,
} from '../../art/worldArt';
import { api, errorMessage } from '../../lib/api';
import { saveBuild } from '../../lib/storage';
import { requireSupabase } from '../../lib/supabase';
import { buildOf, vehicleFor } from '../../game/vehicles';
import { useVehicleAnimation } from '../../game/useVehicleAnimation';
import type { LobbyPlayer } from '../../game/types';
import { Car } from '../Car';
import { TrustedSvg } from '../TrustedSvg';

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
const DECAL_LABELS: Record<DecalId, string> = { none: 'No decal', chevron: 'Chevron', checkered: 'Chequered', pinstripe: 'Pinstripe' };
const STATION_LABELS: Record<WorkshopStation, string> = { overview: 'Overview', paint: 'Paint', wheels: 'Wheels', livery: 'Livery' };

/** Floor shadow under the car, as in the kit's composite workshop. */
const SHADOW = '<ellipse cx="550" cy="429" rx="219" ry="13" fill="#101b15" opacity=".45"/>';

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

/**
 * 16-workshop + 21-driver-livery: the garage as a physical service bay. The
 * controls are ordinary form fields outside the artwork. Purely cosmetic.
 */
export function Garage({ lobbyId, me, meIndex, players, locked }: Props) {
  const current = vehicleFor(me, meIndex);
  const [build, setBuild] = useState<VehicleBuild>(() => buildOf(current));
  const [primary, setPrimary] = useState(current.primary);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [station, setStation] = useState<WorkshopStation>('overview');
  const [status, setStatus] = useState('You can change your build while waiting in the lobby.');
  const preview = useVehicleAnimation('idle');
  const tabsId = useId();

  // Follow server changes (e.g. saved build applied on join) until the player edits.
  useEffect(() => {
    if (dirty) return;
    setBuild(buildOf(current));
    setPrimary(current.primary);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(me.vehicle), me.car_color, dirty]);

  const taken = new Set(players.filter((p) => p.user_id !== me.user_id).map((p) => p.car_color));
  const model = MODEL_GEOMETRY.find((m) => m.id === build.model)!;
  const look = { ...build, primary, playerName: me.name };
  const workshop = useMemo(() => decorative(workshopBackgroundSvg(station)).replace(/<\/svg>$/, SHADOW + '</svg>'), [station]);
  const markDirty = () => {
    setDirty(true);
    setStatus('Unsaved changes. Confirm your build when ready.');
  };
  const edit = (patch: Partial<VehicleBuild>) => {
    setBuild((b) => ({ ...b, ...patch }));
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
      setStatus(stored ? 'Selection saved. You can keep editing while waiting in the lobby.' : 'Selection confirmed for this lobby. Browser storage is unavailable.');
    } catch (e) {
      setStatus(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  // Arrow keys move between station tabs (WAI-ARIA tabs pattern).
  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = WORKSHOP_STATIONS.indexOf(station);
    const next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const s = WORKSHOP_STATIONS[(next + WORKSHOP_STATIONS.length) % WORKSHOP_STATIONS.length]!;
    setStation(s);
    document.getElementById(`${tabsId}-${s}`)?.focus();
  };

  return (
    <div className="g-stack">
      <div className="w-scene w-workshop">
        <TrustedSvg markup={workshop} />
        <div className="w-workshop-car">
          <Car vehicle={look} animation={preview.animation} animationKey={preview.animationKey} />
        </div>
      </div>
      <div className="w-workshop-footer">
        <span>
          {model.name.toUpperCase()} · {model.tag.toUpperCase()}
        </span>
        <span>100% COSMETIC · EVERY CAR HAS THE SAME SPEED</span>
      </div>

      <div className="w-station-tabs" role="tablist" aria-label="Workshop stations">
        {WORKSHOP_STATIONS.map((s) => (
          <button
            key={s}
            id={`${tabsId}-${s}`}
            role="tab"
            type="button"
            className="g-filter"
            aria-selected={station === s}
            aria-pressed={station === s}
            aria-controls={`${tabsId}-panel`}
            tabIndex={station === s ? 0 : -1}
            onKeyDown={onTabKey}
            onClick={() => setStation(s)}
          >
            {STATION_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">The collection <span className="ml-2 text-sm text-muted">15</span></h3>
            <span className="text-[10px] tracking-widest text-subtle">ALL MODELS UNLOCKED</span>
          </div>
          <div className="garage-models grid grid-cols-2 gap-3 sm:grid-cols-3">
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
                  <Car vehicle={{ ...look, model: m.id }} className="my-2" />
                  <div className="text-[13px] font-semibold">{m.name}</div>
                  <div className="text-[10px] text-muted">{m.tag}</div>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="self-start lg:sticky lg:top-4">
          <section
            id={`${tabsId}-panel`}
            role="tabpanel"
            aria-labelledby={`${tabsId}-${station}`}
            className="space-y-4 rounded-[15px] border border-line bg-panel p-6 text-[11px] text-muted"
          >
            {station === 'overview' && (
              <>
                <p>Pick a body from the collection, then visit each station. Confirm when your ride is ready.</p>
                <label className="block">
                  Cosmetic effect
                  <select value={build.effect} disabled={locked} onChange={(e) => edit({ effect: e.target.value as VehicleBuild['effect'] })} className={inputClass}>
                    {VEHICLE_EFFECTS.map((f) => <option key={f} value={f}>{EFFECT_LABELS[f]}</option>)}
                  </select>
                </label>
                <label className="block">
                  Test an animation
                  <select value="" onChange={(e) => e.target.value && preview.play(e.target.value as VehicleAnimation)} className={inputClass}>
                    <option value="">Choose…</option>
                    {VEHICLE_STATES.map((s) => <option key={s} value={s}>{s[0]!.toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </label>
              </>
            )}

            {station === 'paint' && (
              <>
                <div>
                  <span>Body colour</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {CAR_COLORS.map((c) => (
                      <button
                        key={c}
                        disabled={locked || taken.has(c)}
                        onClick={() => {
                          setPrimary(c);
                          markDirty();
                        }}
                        className={`h-7 w-7 rounded-full border-2 transition disabled:cursor-not-allowed disabled:opacity-20 ${primary === c ? 'scale-110 border-fg' : 'border-transparent'}`}
                        style={{ backgroundColor: c }}
                        aria-label={`Body colour ${c}${taken.has(c) ? ' (taken)' : ''}`}
                        aria-pressed={primary === c}
                      />
                    ))}
                  </div>
                </div>
                <label className="block">
                  Accent colour
                  <input type="color" value={build.accent} disabled={locked} onChange={(e) => edit({ accent: e.target.value })} className={`${inputClass} cursor-pointer p-1`} />
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={build.stripes} disabled={locked} onChange={(e) => edit({ stripes: e.target.checked })} className="h-5 w-5 accent-lime" />
                  Racing stripes
                </label>
              </>
            )}

            {station === 'wheels' && (
              <fieldset className="space-y-2">
                <legend>Wheel design</legend>
                {WHEEL_STYLES.map((w) => (
                  <label key={w} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 has-checked:border-lime">
                    <input type="radio" name="wheels" value={w} checked={build.wheels === w} disabled={locked} onChange={() => edit({ wheels: w })} className="accent-lime" />
                    {WHEEL_LABELS[w]}
                  </label>
                ))}
              </fieldset>
            )}

            {station === 'livery' && (
              <>
                <div className="w-driver-card">
                  <span className="w-helmet">
                    <TrustedSvg markup={decorative(helmetSvg(build.team ?? 'apex'))} />
                  </span>
                  <div className="min-w-0">
                    <span className="g-eyebrow">{build.team ? TEAMS.find((t) => t.id === build.team)!.name.toUpperCase() : 'NO TEAM'}</span>
                    <h2 className="truncate">{build.driver || me.name}</h2>
                    <p>Teams are just style: there is no team scoring.</p>
                  </div>
                  <span className="w-driver-number">
                    <TrustedSvg markup={numberPlateSvg(build.number, build.team ?? 'apex')} />
                  </span>
                </div>
                <fieldset>
                  <legend>Team livery</legend>
                  <div className="w-team-options mt-2">
                    <button type="button" className="w-team-button" aria-pressed={!build.team} disabled={locked} onClick={() => edit({ team: null })}>
                      <span>None</span>
                    </button>
                    {TEAMS.map((t) => (
                      <button key={t.id} type="button" className="w-team-button" aria-pressed={build.team === t.id} disabled={locked} onClick={() => edit({ team: t.id as TeamId })}>
                        <TrustedSvg markup={decorative(teamBadgeSvg(t.id))} />
                        <span>{t.name}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
                <label className="block">
                  Decal
                  <select value={build.decal ?? 'none'} disabled={locked || !build.team} onChange={(e) => edit({ decal: e.target.value as DecalId })} className={inputClass}>
                    {DECAL_IDS.map((d) => <option key={d} value={d}>{DECAL_LABELS[d]}</option>)}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <label>
                    Driver lettering
                    <input
                      value={build.driver ?? ''}
                      maxLength={DRIVER_LABEL_MAX}
                      disabled={locked || !build.team}
                      placeholder={me.name.toUpperCase().slice(0, DRIVER_LABEL_MAX)}
                      onChange={(e) => edit({ driver: sanitizeDriver(e.target.value) })}
                      className={`${inputClass} font-mono uppercase`}
                    />
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
                <p className="text-[10px]">Letters A–Z, numbers, spaces and . _ - (up to {DRIVER_LABEL_MAX}). Pick a team to add a decal and lettering.</p>
              </>
            )}

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
    </div>
  );
}
