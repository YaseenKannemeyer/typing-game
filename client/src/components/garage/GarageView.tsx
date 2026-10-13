import { useId, useState, type KeyboardEvent } from 'react';
import {
  MODEL_GEOMETRY,
  MAX_RACE_NUMBER,
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
  type DecalId,
  type TeamId,
  type WorkshopStation,
} from '../../art/worldArt';
import { useVehicleAnimation } from '../../game/useVehicleAnimation';
import { Car } from '../Car';
import { TrustedSvg } from '../TrustedSvg';
import type { GarageFeedback, GarageViewProps } from './garageViewModel';

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

const inputClass =
  'g-input garage-input';

const FEEDBACK: Record<Exclude<GarageFeedback['kind'], 'error' | 'saved'>, string> = {
  idle: 'You can change your build while waiting in the lobby.',
  draft: 'Unsaved changes. Confirm your build when ready.',
};
function feedbackText(f: GarageFeedback): string {
  if (f.kind === 'error') return f.message;
  if (f.kind === 'saved') return f.stored ? 'Selection saved. You can keep editing while waiting in the lobby.' : 'Selection confirmed for this lobby. Browser storage is unavailable.';
  return FEEDBACK[f.kind];
}

/**
 * A service bay around the existing editable car and livery renderer.
 * Controls remain native form fields. All choices are purely cosmetic.
 * Presentation only: Garage.tsx owns the draft, server sync and confirmation.
 */
export function GarageView({ model: m, actions, initialStation = 'overview' }: GarageViewProps) {
  const { draft: build, primary, locked, busy, dirty } = m;
  const [station, setStation] = useState<WorkshopStation>(initialStation);
  const preview = useVehicleAnimation('idle');
  const tabsId = useId();

  const model = MODEL_GEOMETRY.find((g) => g.id === build.model)!;
  const look = { ...build, primary, playerName: m.driverName };
  const edit = actions.edit;

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
    <div className="garage-view pit-garage">
      <header className="garage-heading"><h2>Vehicle setup</h2><p>Every model is equally fast. Make this one yours.</p></header>
      <div className="garage-workbench">
        <section className="garage-preview" aria-label="Selected vehicle preview">
          <div className="garage-stage">
            <div className="garage-stage-heading"><span>Selected vehicle</span><strong>{locked ? 'Locked for the race' : dirty ? 'Unconfirmed changes' : 'Current build'}</strong></div>
            <span className="garage-stage-number" aria-hidden="true">{build.number}</span>
            <Car vehicle={look} animation={preview.animation} animationKey={preview.animationKey} className="garage-stage-car" />
          </div>
          <div className="garage-vehicle-caption"><div><h3>{model.name}</h3><p>{model.tag}</p></div><span>No. <strong>{build.number}</strong></span></div>
        </section>
        <aside className="garage-editor">
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

          <section
            id={`${tabsId}-panel`}
            role="tabpanel"
            aria-labelledby={`${tabsId}-${station}`}
            className="garage-station-panel"
          >
            {station === 'overview' && (
              <>
                <p>Choose a model below. Use the stations to change its finish, then confirm your vehicle.</p>
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
                    {m.colors.map(({ value: c, taken }) => (
                      <button
                        key={c}
                        disabled={locked || taken}
                        onClick={() => actions.paint(c)}
                        className="garage-paint-swatch"
                        style={{ backgroundColor: c }}
                        aria-label={`Body colour ${c}${taken ? ' (taken)' : ''}`}
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
                    <h2 className="truncate">{build.driver || m.driverName}</h2>
                    <p>Team colours are just for show. Teams don't score points.</p>
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
                      placeholder={m.driverName.toUpperCase().slice(0, DRIVER_LABEL_MAX)}
                      onChange={(e) => edit({ driver: sanitizeDriver(e.target.value) })}
                      className={`${inputClass} font-mono uppercase`}
                    />
                  </label>
                  <label>
                    Race number
                    <input
                      type="number" min={0} max={MAX_RACE_NUMBER} inputMode="numeric" value={build.number} disabled={locked}
                      onChange={(e) => edit({ number: Math.max(0, Math.min(MAX_RACE_NUMBER, parseInt(e.target.value) || 0)) })}
                      className={inputClass}
                    />
                  </label>
                </div>
                <p className="text-[10px]">Letters A–Z, numbers, spaces and . _ - (up to {DRIVER_LABEL_MAX}). Pick a team to add a decal and lettering.</p>
              </>
            )}

            <button
              onClick={actions.confirm}
              disabled={locked || busy || !dirty}
              className="g-btn g-btn--primary garage-confirm"
            >
              {busy ? 'Saving…' : 'Confirm vehicle'} <span>→</span>
            </button>
            <p role="status" aria-live="polite" className={`garage-feedback is-${m.feedback.kind}`}>{locked ? 'Your car is locked in while the race is on.' : feedbackText(m.feedback)}</p>
          </section>
        </aside>
      </div>
      <section className="garage-collection" aria-label="Vehicle collection">
        <div className="garage-collection-heading"><h3>The collection <span>{MODEL_GEOMETRY.length} models</span></h3><p>All models unlocked</p></div>
        <div className="garage-models">
          {MODEL_GEOMETRY.map((g) => (
            <button key={g.id} type="button" disabled={locked} aria-pressed={g.id === build.model}
              onClick={() => edit({ model: g.id })} className="garage-card">
              <span className="garage-card-status">{g.id === build.model ? 'Selected' : g.tag}</span>
              <Car vehicle={{ ...look, model: g.id }} />
              <strong>{g.name}</strong>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
