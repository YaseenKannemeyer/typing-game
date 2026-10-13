import type { VoteMode } from '@race/shared';
import { Car } from '../Car';
import { Button, ErrorText, PageTitle } from '../ui';
import type { VotingOption, VotingViewProps } from './votingViewModel';

// Decorative circuit/symbol drawings; no mode identity or scoring logic.
const SIGNALS: Record<VoteMode, string> = {
  easy: 'M8 32H80M8 14H80',
  medium: 'M8 32H27Q34 32 38 23T51 14H80M8 14H22Q29 14 33 23T46 32H80',
  hard: 'M8 32H25Q38 32 38 20T53 8H67Q80 8 80 22T67 36H54',
  coding: 'M28 10L13 22L28 34M60 10L75 22L60 34M50 6L38 38',
  shakespeare: 'M15 34L27 8L39 34M21 23H33M53 18Q71 11 71 23V34M71 24Q50 21 53 30T71 29',
  random: 'M8 12H24Q33 12 42 23T60 34H80M8 34H24Q33 34 42 23T60 12H80M73 5L80 12L73 19M73 27L80 34L73 41',
};

function ModeSignal({ mode }: { mode: VoteMode }) {
  return (
    <svg className="vote-signal" viewBox="0 0 88 46" aria-hidden="true">
      <path d={SIGNALS[mode]} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="round" />
    </svg>
  );
}

function VoteOption({ option: o, index, closing, onVote }: { option: VotingOption; index: number; closing: boolean; onVote: () => void }) {
  return (
    <button type="button" className={`g-mode ${o.selected ? 'selected' : ''}`} aria-pressed={o.selected} disabled={closing} onClick={onVote}>
      <span className="vote-option-top">
        <span className="vote-option-index">{String(index + 1).padStart(2, '0')}</span>
        <span className="g-vote-count">{o.count} {o.count === 1 ? 'vote' : 'votes'}</span>
      </span>
      <div className="vote-option-title"><h3>{o.mode.name}</h3><ModeSignal mode={o.mode.id} /></div>
      <p>{o.mode.description}</p>
      <div className="g-mode-footer">
        <div className="vote-voters" aria-hidden="true">
          {o.voters.slice(0, 3).map((v) => <span key={v.id} title={v.name}><Car vehicle={v.vehicle} /></span>)}
          {o.voters.length > 3 && <small>+{o.voters.length - 3}</small>}
        </div>
        {o.voters.length > 0 && <span className="g-sr">Voters: {o.voters.map((v) => v.name).join(', ')}. </span>}
        <span className="g-mode-choice">{o.selected ? 'Your vote ✓' : closing ? 'Voting closed' : 'Vote →'}</span>
      </div>
    </button>
  );
}

/** Props only: the container owns the clock, vote tally and server selection. */
export function VotingView({ model, actions }: VotingViewProps) {
  if (model.reveal) {
    const { mode, tie } = model.reveal;
    return (
      <section className="pit-voting g-vote-reveal" role="status" aria-live="polite">
        <p className="g-eyebrow">{tie ? 'TIE RESOLVED · SERVER SELECTION' : 'MODE CONFIRMED · SERVER SELECTION'}</p>
        <div className="vote-reveal-signal"><ModeSignal mode={mode.id} /></div>
        <p className="vote-reveal-label">Next on the grid</p>
        <h1>{mode.name} it is.</h1>
        <p>{mode.id === 'random' ? 'The server will draw a passage mode. Get ready for the lights.' : `${mode.description} Get ready for the lights.`}</p>
        <div className="vote-reveal-line" aria-hidden="true" />
      </section>
    );
  }
  const { rules } = model;
  const selected = model.options.find((o) => o.selected);
  const seconds = Math.max(0, Math.ceil(model.clock.remainingS));

  return (
    <div className="pit-voting voting-screen">
      <div className="vote-command">
        <PageTitle eyebrow="NEXT RACE / MODE VOTE" title="Pick your kind of fast." lead="One racer, one vote. Choose the challenge for the whole grid." />
        <div className={`vote-clock ${model.closing ? 'is-closing' : seconds <= 3 ? 'is-urgent' : ''}`} role="timer" aria-label={`${seconds} seconds remaining`}>
          <span>{model.closing ? 'VOTE CLOSED' : 'VOTING CLOSES IN'}</span>
          <strong>{String(seconds).padStart(2, '0')}<small>SEC</small></strong>
        </div>
      </div>
      <div className="vote-rules">
        <strong>{model.votedCount}<span> / {model.racerCount} voted</span></strong>
        <span>{rules.raceSeconds / 60} min race</span>
        {rules.zeroMistakes && <span>Zero mistakes</span>}
        <span>{rules.destination ?? 'Scenery matches the mode'}</span>
      </div>
      <div className="vote-instructions">
        <p role="status">{model.closing ? 'Voting closed. Confirming the server’s selection…' : selected ? `Your vote: ${selected.mode.name}. You can change it until voting closes.` : 'Choose a mode below. You can change your vote until voting closes.'}</p>
        <span>Ties are resolved by the server.</span>
      </div>
      <div className="vote-options" role="group" aria-label="Choose a passage mode">
        {model.options.map((o, i) => <VoteOption key={o.mode.id} option={o} index={i} closing={model.closing} onVote={() => actions.vote(o.mode.id)} />)}
      </div>
      <div className="vote-controls">
        <ErrorText>{model.error}</ErrorText>
        {model.isHost && <Button variant="secondary" icon="clock" disabled={model.closing} onClick={actions.endVoting}>End voting now</Button>}
        <p>{model.closing ? 'The next screen opens when the server confirms the mode.' : model.isHost ? 'Host control · close the vote when your grid is ready.' : 'The host can end voting early.'}</p>
      </div>
    </div>
  );
}
