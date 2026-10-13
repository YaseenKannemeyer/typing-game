import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { VISIBLE_CARS } from '@race/shared';
import { Car } from '../components/Car';
import { Track, type TrackCar } from '../components/Track';
import { vehicleFor } from '../game/vehicles';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { ChampionshipHostPanel } from '../components/experience/Championship';
import { AccountView } from '../components/account/AccountView';
import type { AccountActions, AccountViewModel } from '../components/account/accountViewModel';
import { ProfileView } from '../components/profile/ProfileView';
import type { ProfileActions, ProfileViewModel } from '../components/profile/profileViewModel';
import { ChampionshipStandings } from '../components/experience/Championship';
import { RaceDebrief } from '../components/experience/Debrief';
import { ResultsView } from '../components/results/ResultsView';
import type { ResultsAction, ResultsActions } from '../components/results/resultsViewModel';
import { VotingView } from '../components/voting/VotingView';
import type { VotingActions, VotingViewModel } from '../components/voting/votingViewModel';
import { GarageView } from '../components/garage/GarageView';
import type { GarageActions } from '../components/garage/garageViewModel';
import { WaitingRoomView } from '../components/lobby/WaitingRoomView';
import type { WaitingRoomActions } from '../components/lobby/waitingRoomViewModel';
import { RaceView } from '../components/race/RaceView';
import { Page } from '../components/ui';
import { useTyping } from '../game/useTyping';
import { fixtureBackend } from '../lib/fixtureMode';
import { Home } from '../screens/Home';
import { HOME_FIXTURES, type HomeFixture } from './fixtures/home';
import { GARAGE_FIXTURES, ROOM_FIXTURES, type GarageFixture, type RoomFixture } from './fixtures/lobby';
import { RESULTS_FIXTURES, VOTE_FIXTURES, type ResultsFixture, type VoteFixture } from './fixtures/results';
import { ACCOUNT_FIXTURES, PROFILE_FIXTURES, type AccountFixture, type ProfileFixture } from './fixtures/account';
import { ALL_MODELS, RACE_FIXTURES, type RaceFixture } from './fixtures/race';

/*
 * Dev-only fixture gallery at /__fixtures (App.tsx mounts it only when
 * import.meta.env.DEV, so production builds drop this chunk).
 *
 *   /__fixtures                          gallery
 *   /__fixtures?case=race-p1&vp=390      gallery, case and viewport preselected
 *   /__fixtures?case=race-p1&frame=1     the case alone (what the gallery iframes)
 *
 * Isolation (lib/fixtureMode.ts): Supabase points at a dead local endpoint (or
 * none), captcha is off, and the dev server sends a Content-Security-Policy that
 * blocks every other origin (vite.config.ts). The gallery checks the policy is there.
 */

const hasCsp = () => !!document.querySelector('meta[http-equiv="Content-Security-Policy"]');

interface VehiclesFixture {
  kind: 'vehicles';
  id: string;
  title: string;
  note: string;
}
/** Every model on its own lane at the start or finish line (anchor placement review). */
interface TrackFixture {
  kind: 'track';
  id: string;
  title: string;
  note: string;
  progress: 0 | 1;
  compact: boolean;
}
type Fixture = RaceFixture | HomeFixture | VehiclesFixture | TrackFixture | RoomFixture | GarageFixture | VoteFixture | ResultsFixture | AccountFixture | ProfileFixture;

const TRACK_FIXTURES: TrackFixture[] = [
  { kind: 'track', id: 'track-start', title: 'Race lanes · all 15 at the start', note: 'Rear bumpers on the start line (compact race track).', progress: 0, compact: true },
  { kind: 'track', id: 'track-finish', title: 'Race lanes · all 15 at the finish', note: 'Front bumpers on the finish line (compact race track).', progress: 1, compact: true },
  { kind: 'track', id: 'track-finish-full', title: 'Spectator lanes · all 15 at the finish', note: 'Full scenery track (spectator view).', progress: 1, compact: false },
];

const GROUPS: { label: string; cases: Fixture[] }[] = [
  { label: 'Race', cases: RACE_FIXTURES },
  { label: 'Home', cases: HOME_FIXTURES },
  { label: 'Waiting room', cases: ROOM_FIXTURES },
  { label: 'Garage', cases: GARAGE_FIXTURES },
  { label: 'Mode vote', cases: VOTE_FIXTURES },
  { label: 'Results', cases: RESULTS_FIXTURES },
  { label: 'Account', cases: ACCOUNT_FIXTURES },
  { label: 'Profile', cases: PROFILE_FIXTURES },
  { label: 'Vehicles', cases: [{ kind: 'vehicles', id: 'vehicles', title: 'All 15 models', note: 'Numbers 0–999.' }, ...TRACK_FIXTURES] },
];
const ALL = GROUPS.flatMap((g) => g.cases);
const byId = (id: string | null) => ALL.find((f) => f.id === id) ?? ALL[0]!;

const VIEWPORTS = [
  { id: '1440', w: 1440, h: 900 },
  { id: '1280', w: 1280, h: 720 },
  { id: '390', w: 390, h: 844 },
] as const;

export default function Fixtures() {
  // Isolation is decided at page load. Reached by in-app navigation from a normal page,
  // the real backend is already set up and there is no CSP: reload as a fixture page.
  if (fixtureBackend === null) {
    window.location.reload();
    return null;
  }
  if (!hasCsp()) return <p style={S.alert}>Fixture isolation is missing (no Content-Security-Policy). Use the Vite dev server.</p>;
  const params = new URLSearchParams(window.location.search);
  const fixture = byId(params.get('case'));
  if (params.has('frame')) return <Frame fixture={fixture} />;
  return <Gallery initial={fixture} initialVp={params.get('vp')} />;
}

function frameUrl(f: Fixture) {
  const q = new URLSearchParams({ case: f.id, frame: '1' });
  if (f.kind === 'home' && f.backend === 'none') q.set('backend', 'none');
  return `/__fixtures?${q}`;
}

// ---------------------------------------------------------------------------

function Gallery({ initial, initialVp }: { initial: Fixture; initialVp: string | null }) {
  const [fixture, setFixture] = useState(initial);
  const [vp, setVp] = useState(VIEWPORTS.find((v) => v.id === initialVp) ?? VIEWPORTS[0]);
  const stage = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    window.history.replaceState(null, '', `/__fixtures?case=${fixture.id}&vp=${vp.id}`);
  }, [fixture, vp]);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, (el.clientWidth - 32) / vp.w, (el.clientHeight - 32) / vp.h));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [vp]);

  return (
    <div style={S.shell}>
      <nav style={S.side} aria-label="Fixtures">
        <strong style={{ fontSize: 13, letterSpacing: '0.08em' }}>FIXTURES · DEV ONLY</strong>
        <p style={S.muted}>Isolated: dead local backend, no captcha, other origins blocked by CSP.</p>
        {GROUPS.map((g) => (
          <div key={g.label}>
            <div style={S.groupLabel}>{g.label}</div>
            {g.cases.map((f) => (
              <button key={f.id} type="button" onClick={() => setFixture(f)} aria-current={f.id === fixture.id} style={{ ...S.item, ...(f.id === fixture.id ? S.itemOn : null) }}>
                {f.title}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <section style={S.main}>
        <header style={S.bar}>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {VIEWPORTS.map((v) => (
              <button key={v.id} type="button" onClick={() => setVp(v)} aria-pressed={v.id === vp.id} style={{ ...S.vp, ...(v.id === vp.id ? S.itemOn : null) }}>
                {v.w}×{v.h}
              </button>
            ))}
          </div>
          <span style={S.note} title={fixture.note}>
            {scale < 1 && `${Math.round(scale * 100)}% · `}
            {fixture.note ?? ''}
          </span>
          <a href={frameUrl(fixture)} target="_blank" rel="noreferrer" style={{ color: '#ffd23f', fontSize: 12, whiteSpace: 'nowrap' }}>open frame ↗</a>
        </header>
        <div ref={stage} style={S.stage}>
          <div style={{ width: vp.w * scale, height: vp.h * scale }}>
            <iframe
              key={`${fixture.id}:${vp.id}`}
              title={fixture.title}
              src={frameUrl(fixture)}
              width={vp.w}
              height={vp.h}
              style={{ border: 0, background: '#111', transform: `scale(${scale})`, transformOrigin: '0 0' }}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Frame({ fixture }: { fixture: Fixture }) {
  if (fixture.kind === 'home') return <Home />;
  if (fixture.kind === 'vehicles') return <Vehicles />;
  if (fixture.kind === 'track') return <TrackLanes fixture={fixture} />;
  if (fixture.kind === 'room') return <RoomFrame fixture={fixture} />;
  if (fixture.kind === 'garage') return <Page><GarageMock fixture={fixture} /></Page>;
  if (fixture.kind === 'vote') return <VoteFrame fixture={fixture} />;
  if (fixture.kind === 'results') return <ResultsFrame fixture={fixture} />;
  if (fixture.kind === 'account') return <AccountFrame fixture={fixture} />;
  if (fixture.kind === 'profile') return <ProfileFrame fixture={fixture} />;
  return <RaceFrame fixture={fixture} />;
}

/** Runs `fn` after a short, fake network delay; cleared on unmount. */
function useLater() {
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  return (fn: () => void, ms = 800) => void timers.current.push(setTimeout(fn, ms));
}

/** The waiting room with mock actions: they change local state only (no API). */
function RoomFrame({ fixture }: { fixture: RoomFixture }) {
  const [model, setModel] = useState(fixture.model);
  const tabsRef = useRef<HTMLElement>(null);
  const later = useLater();
  const actions: WaitingRoomActions = {
    startVote: () => {
      setModel((m) => ({ ...m, starting: true, error: null }));
      later(() => setModel((m) => ({ ...m, starting: false, error: fixture.fail?.start ?? null })));
    },
    changeSettings: (seconds, zeroMistakes, destination = model.settings.destination) => {
      const before = model.settings;
      setModel((m) => ({ ...m, error: null, settings: { ...m.settings, seconds, zeroMistakes, destination, saving: true } }));
      later(() =>
        setModel((m) => (fixture.fail?.settings ? { ...m, error: fixture.fail.settings, settings: { ...before, saving: false } } : { ...m, settings: { ...m.settings, saving: false } })),
      );
    },
    openGarage: () => {
      setModel((m) => ({ ...m, tab: 'garage' }));
      requestAnimationFrame(() => {
        tabsRef.current?.scrollIntoView({ block: 'start' });
        tabsRef.current?.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')?.focus({ preventScroll: true });
      });
    },
    selectTab: (tab) => setModel((m) => ({ ...m, tab })),
  };
  return (
    <Page actions={<span className="g-pill g-pill--lime hidden font-mono sm:inline-flex">ROOM {model.room.code}</span>}>
      {model.connection === 'reconnecting' && <ConnectionBanner onRetry={() => {}} />}
      <WaitingRoomView
        model={model}
        actions={actions}
        slots={{
          garage: fixture.garage && <GarageMock fixture={fixture.garage} />,
          // The real panel: its buttons can only reach the dead fixture endpoint.
          championship: <ChampionshipHostPanel lobbyId="fixture" championship={fixture.championship} isHost={model.isHost} myId="fx-0" refresh={() => {}} />,
        }}
        tabsRef={tabsRef}
      />
    </Page>
  );
}

/** The mode vote with mock actions: votes move locally; "End voting now" reveals the local leader (no API). */
function VoteFrame({ fixture }: { fixture: VoteFixture }) {
  const [model, setModel] = useState<VotingViewModel>(fixture.model);
  const later = useLater();
  const me = fixture.me;
  const actions: VotingActions = {
    vote: (mode) => {
      if (fixture.fail?.vote) return setModel((m) => ({ ...m, error: fixture.fail!.vote! }));
      setModel((m) => {
        const voted = m.options.some((o) => o.selected);
        const options = m.options.map((o) => {
          const voters = o.voters.filter((v) => v.id !== me.id);
          if (o.mode.id === mode) voters.push(me);
          return { ...o, voters, count: voters.length, selected: o.mode.id === mode };
        });
        return { ...m, error: null, options, votedCount: m.votedCount + (voted ? 0 : 1) };
      });
    },
    endVoting: () => {
      if (fixture.fail?.end) return setModel((m) => ({ ...m, error: fixture.fail!.end! }));
      later(() =>
        setModel((m) => {
          const top = Math.max(0, ...m.options.map((o) => o.count));
          const leaders = m.options.filter((o) => o.count === top && top > 0);
          const random = m.options.find((o) => o.mode.id === 'random')!;
          return { ...m, reveal: { mode: (leaders[0] ?? random).mode, tie: leaders.length > 1 } };
        }),
      );
    },
  };
  return (
    <Page actions={<span className="g-pill g-pill--lime hidden font-mono sm:inline-flex">ROOM FX7Q2K</span>}>
      <VotingView model={model} actions={actions} />
    </Page>
  );
}

/** Official results with mock host actions (busy, then fail or settle; no API). The debrief is the real component. */
function ResultsFrame({ fixture }: { fixture: ResultsFixture }) {
  const [model, setModel] = useState(fixture.model);
  const later = useLater();
  const act = (key: ResultsAction) => () => {
    setModel((m) => ({ ...m, busy: key, error: null }));
    later(() => setModel((m) => ({ ...m, busy: null, error: fixture.fail?.[key] ?? null })));
  };
  const actions: ResultsActions = { rematch: act('rematch'), newVote: act('vote'), backToLobby: act('lobby') };
  const d = fixture.debrief;
  return (
    <Page actions={<span className="g-pill g-pill--lime hidden font-mono sm:inline-flex">ROOM FX7Q2K</span>}>
      <ResultsView
        model={model}
        actions={actions}
        slots={{
          championship: fixture.championship ? <ChampionshipStandings championship={fixture.championship} myId="fx-0" /> : null,
          // Real component: its previous-best lookup can only reach the dead fixture endpoint ("Unavailable").
          debrief: d ? <RaceDebrief race={d.race} me={d.me} passage={d.passage} /> : null,
        }}
      />
    </Page>
  );
}

/** The account page with mock actions: no auth, email or backend; actions only move between states. */
function AccountFrame({ fixture }: { fixture: AccountFixture }) {
  const [model, setModel] = useState<AccountViewModel>(fixture.model);
  const later = useLater();
  const fail = fixture.fail ?? {};
  /** Busy for 0.8 s, then fail with `error` or move to `next`. */
  const step = (error: string | undefined, next: AccountViewModel['state']) => {
    setModel((m) => ({ ...m, busy: true, error: null }));
    later(() => setModel((m) => (error ? { ...m, busy: false, error } : { state: next, busy: false, error: null })));
  };
  const guest = model.state.kind === 'form' || model.state.kind === 'review' ? model.state.guest : null;
  const receipt = { name: guest?.name ?? 'Nova', races: guest?.races ?? 4, trophies: guest?.trophies ?? 2 };
  const actions: AccountActions = {
    chooseMode: (mode) => setModel((m) => ({ ...m, error: null, state: { kind: 'form', mode, defaultName: 'Nova', guest: m.state.kind === 'form' ? m.state.guest : null } })),
    submitAuth: (values) => {
      if (model.state.kind !== 'form') return;
      const mode = model.state.mode;
      step(
        fail.submit,
        mode === 'reset' ? { kind: 'recovery' }
          : mode === 'signin' ? (guest ? { kind: 'review', guest, account: { name: 'Nova', races: 12, trophies: 5 } } : { kind: 'saved', receipt: { name: 'Nova', races: 12, trophies: 5 } })
          : { kind: 'verify', email: values.email || 'nova@example.com', receipt: guest ? receipt : null, confirmedElsewhere: false },
      );
    },
    continueAsGuest: () => {},
    confirmVerified: () => step(fail.verify, { kind: 'password', purpose: 'new' }),
    useDifferentEmail: () => setModel({ state: { kind: 'form', mode: 'save', defaultName: 'Nova', guest: null }, busy: false, error: null }),
    submitPassword: () => step(fail.password, { kind: 'saved', receipt }),
    confirmMerge: () => {
      setModel({ state: { kind: 'saving' }, busy: false, error: null });
      later(() => setModel(fail.merge ? { state: { kind: 'retry' }, busy: false, error: fail.merge } : { state: { kind: 'saved', receipt: { name: 'Nova', races: 16, trophies: 6 } }, busy: false, error: null }));
    },
    cancelMerge: () => step(undefined, { kind: 'form', mode: 'save', defaultName: 'Nova', guest: null }),
    viewProfile: () => {},
    backToSignIn: () => setModel({ state: { kind: 'form', mode: 'signin', defaultName: '', guest: null }, busy: false, error: null }),
  };
  return <AccountView model={model} actions={actions} />;
}

/** The profile page with mock actions: no backend; period, avatar and name changes are local. */
function ProfileFrame({ fixture }: { fixture: ProfileFixture }) {
  const [model, setModel] = useState<ProfileViewModel>(fixture.model);
  const later = useLater();
  const save = (patch: { name?: string; avatar?: 'car' | 'initials' }) => {
    setModel((m) => ({ ...m, busy: true, edit: { ...m.edit, error: null } }));
    later(() =>
      setModel((m) => {
        if (fixture.fail?.save && patch.name) return { ...m, busy: false, edit: { open: true, error: fixture.fail.save } };
        const state = m.state.kind === 'ready' ? { kind: 'ready' as const, data: { ...m.state.data, ...patch } } : m.state;
        return { ...m, state, busy: false, edit: patch.name ? { open: false, error: null } : m.edit };
      }),
    );
  };
  const actions: ProfileActions = {
    selectPeriod: (days) => setModel((m) => ({ ...m, period: { ...m.period, days } })),
    toggleAvatar: () => {
      if (model.state.kind === 'ready') save({ avatar: model.state.data.avatar === 'car' ? 'initials' : 'car' });
    },
    openEditName: () => setModel((m) => ({ ...m, edit: { open: true, error: null } })),
    saveName: (name) => save({ name }),
    cancelEditName: () => setModel((m) => ({ ...m, edit: { open: false, error: null } })),
    signOut: () => {},
    goToAccount: () => {},
    finishSetup: () => {},
  };
  return <ProfileView model={model} actions={actions} />;
}

/** The garage with mock actions: edits and confirmation change local state only (no API, no storage). */
function GarageMock({ fixture }: { fixture: GarageFixture }) {
  const [model, setModel] = useState(fixture.model);
  const later = useLater();
  const actions: GarageActions = {
    edit: (patch) => setModel((m) => ({ ...m, draft: { ...m.draft, ...patch }, dirty: true, feedback: { kind: 'draft' } })),
    paint: (primary) => setModel((m) => ({ ...m, primary, dirty: true, feedback: { kind: 'draft' } })),
    confirm: () => {
      setModel((m) => ({ ...m, busy: true }));
      const outcome = fixture.confirm;
      later(() => setModel((m) => (outcome.kind === 'error' ? { ...m, busy: false, feedback: outcome } : { ...m, busy: false, dirty: false, feedback: outcome })));
    },
  };
  return <GarageView model={model} actions={actions} initialStation={fixture.initialStation} />;
}

/** A race case inside the real page chrome, with a live typing input driven by the real engine. */
function RaceFrame({ fixture }: { fixture: RaceFixture }) {
  const t = fixture.typing;
  const typing = useTyping(t?.text ?? '', !!t?.enabled, { strict: t?.strict, initial: t ? () => t.state : undefined });
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (t?.enabled) inputRef.current?.focus();
  }, [t]);
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => typing.onKeyDown(e);
  const phase = fixture.model.clock.phase;
  // Scripted delivery transitions (e.g. retrying → recovered), driven here, never by RaceView.
  const steps = fixture.deliverySequence;
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!steps) return;
    const t = setTimeout(() => setStep((i) => (i + 1) % steps.length), steps[step]!.ms);
    return () => clearTimeout(t);
  }, [steps, step]);
  const model = steps ? { ...fixture.model, delivery: steps[step]!.delivery } : fixture.model;

  return (
    <Page actions={<span className="g-pill g-pill--lime hidden font-mono sm:inline-flex">ROOM FIXTUR</span>}>
      {model.connection === 'reconnecting' && <ConnectionBanner onRetry={() => {}} />}
      <RaceView
        model={model}
        typing={
          t
            ? { state: typing.state, inputRef, onKeyDown, waiting: phase === 'countdown', doneLabel: phase === 'time-up' ? "TIME'S UP" : undefined }
            : null
        }
      />
    </Page>
  );
}

function TrackLanes({ fixture }: { fixture: TrackFixture }) {
  const cars: TrackCar[] = ALL_MODELS.map((m, i) => ({
    id: m.model,
    name: m.name,
    vehicle: vehicleFor({ name: m.name, car_color: m.color, vehicle: { model: m.model, number: m.number, team: i % 3 === 0 ? 'night' : null, decal: 'checkered', driver: 'BOB3' } }, i),
    rank: i + 1,
    progress: fixture.progress,
    percent: fixture.progress * 100,
    wpm: 60,
    errors: 0,
    finished: false,
    isMe: i === 0,
  }));
  return (
    <Page>
      <div className={fixture.compact ? 'race-screen pit-race' : 'race-screen'}>
        <section className="race-track">
          <Track cars={cars} total={cars.length} started={fixture.progress > 0} destination="city" lanes={VISIBLE_CARS} compact={fixture.compact} />
        </section>
      </div>
    </Page>
  );
}

function Vehicles() {
  return (
    <Page>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
        {ALL_MODELS.map((m) => (
          <figure key={m.model} style={{ margin: 0 }}>
            <Car vehicle={{ model: m.model, primary: m.color, number: m.number, playerName: m.name }} />
            <figcaption className="g-small g-muted">
              {m.model} · #{m.number}
            </figcaption>
          </figure>
        ))}
      </div>
    </Page>
  );
}

// Inline styles keep the gallery chrome out of the app's style layers.
const S: Record<string, CSSProperties> = {
  shell: { display: 'grid', gridTemplateColumns: '260px 1fr', height: '100vh', background: '#0c0d0e', color: '#eceae4', font: '13px/1.4 system-ui, sans-serif' },
  side: { overflowY: 'auto', padding: 16, borderRight: '1px solid #2a2c2e', display: 'flex', flexDirection: 'column', gap: 12 },
  groupLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#8b8d90', margin: '4px 0' },
  item: { display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px', border: 0, borderRadius: 4, background: 'transparent', color: 'inherit', cursor: 'pointer', font: 'inherit' },
  itemOn: { background: '#ffd23f', color: '#111' },
  main: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  bar: { display: 'flex', alignItems: 'center', gap: 16, padding: '10px 16px', borderBottom: '1px solid #2a2c2e', minWidth: 0 },
  // One line however long the note is (full text in the tooltip), so the toolbar keeps its height.
  note: { flex: 1, minWidth: 0, color: '#8b8d90', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  alert: { margin: 24, padding: 16, background: '#5c1a1a', color: '#fff', font: '14px system-ui, sans-serif' },
  vp: { padding: '4px 10px', border: '1px solid #2a2c2e', borderRadius: 4, background: 'transparent', color: 'inherit', cursor: 'pointer', font: 'inherit' },
  stage: { flex: 1, minHeight: 0, overflow: 'auto', padding: 16 },
  muted: { color: '#8b8d90', fontSize: 12, flex: 1 },
};
