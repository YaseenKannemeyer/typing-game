import { Car } from '../Car';
import { PitBoard } from '../race/RaceControl';
import { AwardCard } from '../trophies/AwardCard';
import { Button, ErrorText, PageTitle } from '../ui';
import { ResultsTable, type ResultRowView } from './Results';
import type { ResultsViewProps } from './resultsViewModel';

function OfficialPodium({ rows }: { rows: ResultRowView[] }) {
  // Keep the supplied official order and places, including server tie-breaks.
  const podium = rows.filter((r) => r.status === 'finished').slice(0, 3);
  return (
    <section className="results-victory" aria-label="Official podium">
      <div className="results-victory-heading"><span>VICTORY LANE</span><span>OFFICIAL FINISH</span></div>
      {podium.length ? (
        <ol className="w-podium-list" role="list" aria-label="Podium">
          {podium.map((p) => (
            <li key={p.id} className={`${p.you ? 'is-you' : ''} ${p.position === 1 ? 'is-first' : ''}`}>
              <div className="results-podium-place"><span>P{p.position}</span><small>{p.you ? 'YOU' : 'OFFICIAL'}</small></div>
              <Car vehicle={p.vehicle} className="results-podium-car" />
              <h2>{p.name}</h2>
              <div className="results-podium-stats">
                <b>{p.wpm === null ? '—' : `${Math.round(p.wpm)} WPM`}</b>
                <span>{p.accuracy === null ? 'Accuracy unavailable' : `${p.accuracy.toFixed(1)}% accuracy`}</span>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="results-no-finish"><strong>No official finishers</strong><p>Nobody recorded an eligible finish. See each racer’s status below.</p></div>
      )}
    </section>
  );
}

/** Official values only; the container owns results, awards, sounds and actions. */
export function ResultsView({ model, actions, slots }: ResultsViewProps) {
  const { rows, awards, busy } = model;
  const mine = awards.mine;
  const myRow = rows.find((r) => r.you);

  return (
    <div className="pit-results results-screen">
      <div className="results-command">
        <PageTitle eyebrow={`${model.modeName} / FINAL RESULTS`} title="Every finish has a story." lead="Highest WPM when the clock stopped wins. These are the server’s official results." />
        <div className="results-confirmed"><span className="results-finish-mark" aria-hidden="true" /><span>CLASSIFICATION<br /><strong>CONFIRMED</strong></span></div>
      </div>
      <div className="results-control-board" aria-live="polite">{model.raceControl && <PitBoard key={model.raceControl.id} event={model.raceControl} />}</div>
      <OfficialPodium rows={rows} />
      <section className="results-next" aria-label="Next race">
        <div className="g-result-actions">
          {model.isHost ? (
            <>
              <Button icon="refresh" loading={busy === 'rematch'} disabled={!!busy} onClick={actions.rematch}>Race again</Button>
              <Button variant="secondary" loading={busy === 'vote'} disabled={!!busy} onClick={actions.newVote}>New mode vote</Button>
              <Button variant="ghost" loading={busy === 'lobby'} disabled={!!busy} onClick={actions.backToLobby}>Back to lobby</Button>
            </>
          ) : <p role="status">Waiting for the host to choose what’s next…</p>}
          <span className="results-next-note">{busy ? 'Waiting for the server…' : 'Same grid. Next challenge.'}</span>
        </div>
        <ErrorText>{model.error}</ErrorText>
      </section>
      <section className="results-standings" aria-labelledby="results-standings-title">
        <div className="results-section-heading"><h2 id="results-standings-title">Official standings</h2><span>{rows.length} {rows.length === 1 ? 'racer' : 'racers'} classified</span></div>
        <ResultsTable rows={rows} />
      </section>
      {slots.championship}
      {mine && (
        <section className="results-awards" aria-labelledby="results-awards-title">
          <div className="results-section-heading"><h2 id="results-awards-title">Your trophy haul</h2>{awards.status === 'ready' && <span>{mine.race.length} race {mine.race.length === 1 ? 'award' : 'awards'}</span>}</div>
          {awards.status === 'pending' ? (
            <div className="results-awards-pending" role="status"><span className="results-pending-mark" aria-hidden="true" /><div><strong>Confirming awards…</strong><p>Your result is official. Trophies appear after the server confirms them.</p></div></div>
          ) : mine.race.length + mine.progression.length === 0 ? (
            <p className="results-awards-empty">{myRow?.status === 'flagged' ? 'This race is under review. No trophies have been confirmed.' : !mine.finished ? 'Trophies are for racers still on the grid when the clock stops. Next race is yours.' : 'No trophies this time. Your official result is above.'}</p>
          ) : (
            <>
              <div className="results-award-grid">{mine.race.map((a) => <AwardCard key={a.trophy} award={a} recipient={mine.name} />)}</div>
              {mine.progression.length > 0 && <><h3 className="results-progression-heading">Progression achievements</h3><div className="results-award-grid">{mine.progression.map((a) => <AwardCard key={a.trophy} award={a} recipient={mine.name} />)}</div></>}
            </>
          )}
        </section>
      )}
      {slots.debrief}
      {awards.status === 'ready' && awards.others.length > 0 && (
        <section className="results-awards results-other-awards" aria-labelledby="results-other-awards-title">
          <div className="results-section-heading"><h2 id="results-other-awards-title">Everyone’s awards</h2><span>Server confirmed</span></div>
          {awards.others.map((o) => <div key={o.id} className="results-recipient"><h3>{o.name}</h3><div className="award-grid--compact">{o.awards.map((a) => <AwardCard key={a.trophy} award={a} recipient={o.name} reveal={false} compact />)}</div></div>)}
        </section>
      )}
    </div>
  );
}
