import { useState } from 'react';
import { MODE_INFO, type VoteMode } from '@race/shared';
import { api, errorCode, errorMessage, type Championship } from '../../lib/api';
import { Banner, Button, ErrorText, Pill } from '../ui';

/* Kit 25 championship host. The server owns the event: it locks the rules,
   commits each finished race as a round (once), awards points from its one
   policy and derives the standings. This panel only sends host intents. */

const ROUND_CHOICES = [2, 3, 4, 5] as const;

const STATUS_LABEL: Record<Championship['status'], string> = {
  setup: 'Event setup',
  running: 'Event running',
  complete: 'Event complete',
  cancelled: 'Event cancelled',
};

const modeName = (m: string) => MODE_INFO[m as VoteMode]?.label ?? m;

export function ChampionshipHostPanel({
  lobbyId,
  championship: c,
  isHost,
  myId,
  refresh,
}: {
  lobbyId: string;
  championship: Championship | null;
  isHost: boolean;
  myId: string | null;
  refresh: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rounds, setRounds] = useState(3);

  const run = (key: string, fn: () => Promise<unknown>) => async () => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
      // A stale revision just means someone else changed it first: show the latest.
      if (errorCode(e) === 'stale_revision') void refresh();
    } finally {
      setBusy(null);
      void refresh();
    }
  };

  const open = c && (c.status === 'setup' || c.status === 'running');
  const done = c?.committed.length ?? 0;

  return (
    <section className="g-panel x-panel x-host" aria-labelledby="champ-title">
      <div className="x-panel-heading">
        <div>
          <span className="g-eyebrow">CHAMPIONSHIP</span>
          <h2 className="g-heading" id="champ-title">{open ? STATUS_LABEL[c.status] : 'Run a championship'}</h2>
        </div>
        {c && <Pill lime={c.status === 'running'}>{c.status === 'setup' ? 'EDITABLE' : c.status === 'running' ? 'RULES LOCKED' : c.status.toUpperCase()}</Pill>}
      </div>

      {!open ? (
        <>
          <p className="g-muted">
            Link the next races into one event. Every finished race counts as a round; points by official position, highest total wins.
          </p>
          {c?.status === 'complete' && <ChampionBanner championship={c} />}
          {isHost ? (
            <div className="x-host-setup">
              <RoundPicker value={rounds} onChange={setRounds} disabled={!!busy} />
              <Button loading={busy === 'create'} disabled={!!busy} onClick={run('create', () => api.createChampionship(lobbyId, rounds))}>
                Set up event
              </Button>
            </div>
          ) : (
            <p className="g-small g-muted">Only the host can start a championship.</p>
          )}
        </>
      ) : (
        <>
          <ol className="x-rounds">
            {Array.from({ length: c.rounds }, (_, i) => {
              const r = c.committed.find((x) => x.round === i + 1);
              const current = c.status === 'running' && i === done;
              return (
                <li key={i} className={current ? 'is-current' : ''}>
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <strong>Round {i + 1}</strong>
                    <small>{r ? modeName(r.mode) : current ? 'Next race' : 'Scheduled'}</small>
                  </div>
                  <b>{r ? 'Committed' : current ? 'Up next' : '—'}</b>
                </li>
              );
            })}
          </ol>

          {c.status === 'setup' && isHost && (
            <div className="x-host-setup">
              <RoundPicker
                value={c.rounds}
                disabled={!!busy}
                onChange={(n) => void run('rounds', () => api.updateChampionship(lobbyId, 'rounds', c.revision, n))()}
              />
              <Button loading={busy === 'lock'} disabled={!!busy} onClick={run('lock', () => api.updateChampionship(lobbyId, 'lock', c.revision))}>
                Lock rules and start
              </Button>
            </div>
          )}
          {c.status === 'setup' && !isHost && <p className="g-small g-muted">The host is setting up a {c.rounds}-round event.</p>}
          {c.status === 'running' && (
            <p className="g-small g-muted">
              {done} of {c.rounds} rounds committed. The next race the host starts is round {done + 1}. Racers who leave keep their points; a racer not on the grid at the finish scores 0 for that round.
            </p>
          )}
          {isHost && (
            <div>
              <Button
                variant="ghost"
                loading={busy === 'cancel'}
                disabled={!!busy}
                onClick={() => {
                  if (window.confirm('Cancel this championship? Rounds already raced keep their results, but no champion is named.')) {
                    void run('cancel', () => api.updateChampionship(lobbyId, 'cancel', c.revision))();
                  }
                }}
              >
                Cancel event
              </Button>
            </div>
          )}
          {c.standings.length > 0 && <ChampionshipStandings championship={c} myId={myId} compact />}
        </>
      )}

      <PointsPolicy points={c?.points} />
      <ErrorText>{error}</ErrorText>
    </section>
  );
}

function RoundPicker({ value, onChange, disabled }: { value: number; onChange: (n: number) => void; disabled: boolean }) {
  return (
    <div className="x-segmented" role="group" aria-label="Number of rounds">
      {ROUND_CHOICES.map((n) => (
        <button key={n} type="button" aria-pressed={value === n} disabled={disabled} onClick={() => onChange(n)}>
          {n} rounds
        </button>
      ))}
    </div>
  );
}

function PointsPolicy({ points }: { points?: number[] }) {
  if (!points) return <p className="x-caption">Points follow the official finishing order. DNF and flagged results score 0. Equal totals share a position.</p>;
  return (
    <details className="x-points">
      <summary>Points policy</summary>
      <div className="x-points-grid">
        {points.map((p, i) => (
          <div key={i}>
            <span>P{i + 1}</span>
            <strong>{p}</strong>
          </div>
        ))}
      </div>
      <p className="x-caption">DNF and flagged results score 0. Equal totals share a position; there is no tie-breaker.</p>
    </details>
  );
}

function ChampionBanner({ championship: c }: { championship: Championship }) {
  const top = c.standings.filter((s) => s.position === 1);
  if (top.length === 0) return null;
  return (
    <Banner tone="success">
      {top.length === 1 ? `${top[0]!.name} won the last championship with ${top[0]!.total} points.` : `Shared championship: ${top.map((t) => t.name).join(' and ')} on ${top[0]!.total} points.`}
    </Banner>
  );
}

/** Event standings: positions are shared for equal totals (no alphabetical tie-break). */
export function ChampionshipStandings({ championship: c, myId, compact = false }: { championship: Championship; myId: string | null; compact?: boolean }) {
  const final = c.status === 'complete';
  return (
    <section className={compact ? 'x-champ-standings' : 'g-stack x-champ-standings'} aria-label="Championship standings">
      {!compact && (
        <div className="g-between">
          <div>
            <span className="g-eyebrow">{final ? 'FINAL CLASSIFICATION' : 'CHAMPIONSHIP STANDINGS'}</span>
            <h2 className="g-heading">
              {c.committed.length} of {c.rounds} rounds committed
            </h2>
          </div>
          <Pill lime={final}>{STATUS_LABEL[c.status].toUpperCase()}</Pill>
        </div>
      )}
      {final && !compact && <ChampionBanner championship={c} />}
      <div className="x-table-wrap">
        <table className="x-champ-table">
          <thead>
            <tr>
              <th scope="col">Pos</th>
              <th scope="col">Racer</th>
              {Array.from({ length: c.rounds }, (_, i) => (
                <th scope="col" key={i}>R{i + 1}</th>
              ))}
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {c.standings.map((s, i) => {
              const shared = c.standings.some((o, j) => j !== i && o.position === s.position);
              return (
                <tr key={s.user_id} className={s.user_id === myId ? 'is-you' : ''}>
                  <td>{shared ? `=${s.position}` : s.position}</td>
                  <th scope="row">
                    {s.name}
                    {s.user_id === myId && <span className="g-muted"> (you)</span>}
                  </th>
                  {Array.from({ length: c.rounds }, (_, r) => {
                    const cell = s.rounds[String(r + 1)];
                    return (
                      <td key={r}>
                        {!cell ? '—' : cell.status === 'finished' ? cell.points : cell.status === 'dnf' ? 'DNF' : 'FLAG'}
                      </td>
                    );
                  })}
                  <td>
                    <strong>{s.total}</strong>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
