interface Props {
  /** Already ranked by the race controller; presentation never reorders racers. */
  racers: readonly { id: string; name: string; wpm: number }[];
  localId: string | null;
}

export function LiveStandings({ racers, localId }: Props) {
  return (
    <section className="race-standings" aria-label="Live standings">
      <h2>Live standings <span>{racers.length}</span></h2>
      <div className="race-standings-scroll" tabIndex={0} role="region" aria-label="All racers, scroll for more positions">
        <table>
          <thead><tr><th scope="col">#</th><th scope="col">Driver</th><th scope="col">WPM</th></tr></thead>
          <tbody>
            {racers.map((racer, index) => (
              <tr key={racer.id} className={racer.id === localId ? 'is-you' : undefined} aria-current={racer.id === localId ? 'true' : undefined}>
                <td>{String(index + 1).padStart(2, '0')}</td>
                <th scope="row"><span title={racer.name}>{racer.name}</span>{racer.id === localId && <small>YOU</small>}</th>
                <td>{Math.round(racer.wpm)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
