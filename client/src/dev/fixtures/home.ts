/*
 * Homepage cases. Home keeps its own form state and is mounted as is (no
 * interface change), so these vary the backend only:
 *  - unreachable: a client pointed at a dead local endpoint. Validation runs for
 *    real; "Create room" shows busy, then the network error.
 *  - none: no client, i.e. the offline state.
 * Deterministic busy / invalid / rejoin snapshots need the contract proposed in
 * docs/design/pit-lane/06-race-extraction-handoff.md.
 */
export interface HomeFixture {
  kind: 'home';
  id: string;
  title: string;
  note: string;
  backend: 'unreachable' | 'none';
}

export const HOME_FIXTURES: HomeFixture[] = [
  {
    kind: 'home',
    id: 'home',
    title: 'Home · interactive (dead backend)',
    note: 'Try: Create with an empty or 1-letter name, Join with a 2-letter code, Create with a valid name (busy, then “Failed to fetch”).',
    backend: 'unreachable',
  },
  { kind: 'home', id: 'home-offline', title: 'Home · offline', note: 'No backend configured.', backend: 'none' },
];
