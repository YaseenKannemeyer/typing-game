import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { HEARTBEAT_MS, type VoteMode } from '@race/shared';
import { api, errorCode, errorMessage } from '../lib/api';
import { measureClockOffset } from '../lib/clock';
import { loadBuild } from '../lib/storage';
import { ensureSession, requireSupabase } from '../lib/supabase';
import type { LiveProgress, Lobby, LobbyPlayer, Race, RacePlayer, Vote } from './types';

/** Maps to a 12-system state, or 'generic' for anything else. */
export type LobbyErrorKind = 'not-found' | 'full' | 'name-taken' | 'inactive' | 'generic';

export interface LobbyState {
  phase: 'joining' | 'ready' | 'error';
  error: string | null;
  errorKind: LobbyErrorKind | null;
  /** False while the realtime channel is down (we never claim a reconnect early). */
  connected: boolean;
  userId: string | null;
  lobby: Lobby | null;
  players: LobbyPlayer[];
  votes: Vote[];
  race: Race | null;
  /** The race's continuous text. */
  passage: string | null;
  racePlayers: RacePlayer[];
  live: Record<string, LiveProgress>;
  online: Set<string>;
  /** Server time minus local time, in ms. */
  clockOffset: number;
  voteResult: VoteMode | null;
}

const initial: LobbyState = {
  phase: 'joining',
  error: null,
  errorKind: null,
  connected: true,
  userId: null,
  lobby: null,
  players: [],
  votes: [],
  race: null,
  passage: null,
  racePlayers: [],
  live: {},
  online: new Set(),
  clockOffset: 0,
  voteResult: null,
};

const RACE_PLAYER_COLUMNS =
  'user_id, name, words_done, locked_chars, correct_chars, keystrokes, errors, deletions, section_keystrokes, section_errors, finished_at, rank, net_wpm, gross_wpm, accuracy, flagged, samples, awards';

/**
 * Joins a lobby and keeps its state in sync. The database is the source of
 * truth: server events on the private channel trigger a re-fetch, while
 * `progress` broadcasts from other players only animate cars.
 */
export function useLobby(code: string, name: string) {
  const [state, setState] = useState<LobbyState>(initial);
  const lobbyId = useRef<string | null>(null);
  const channel = useRef<RealtimeChannel | null>(null);
  /** Race text by race id (fetched once per race; it can be several KB). */
  const textCache = useRef(new Map<string, string>());
  const refreshing = useRef<Promise<void> | null>(null);
  const refreshAgain = useRef(false);

  const fail = useCallback((message: string, errorKind: LobbyErrorKind = 'generic') => {
    setState((s) => ({ ...s, phase: 'error', error: message, errorKind }));
  }, []);

  const load = useCallback(async () => {
    const sb = requireSupabase();
    const id = lobbyId.current;
    if (!id) return;
    const [lobbyRes, playersRes, votesRes] = await Promise.all([
      sb.from('lobbies').select('id, code, host_id, status, current_race_id, vote_ends_at, mode, race_seconds, zero_mistakes').eq('id', id).maybeSingle(),
      sb.from('lobby_players').select('user_id, name, car_color, joined_at, streak, vehicle').eq('lobby_id', id).order('joined_at'),
      sb.from('lobby_votes').select('user_id, mode').eq('lobby_id', id),
    ]);
    const lobby = lobbyRes.data as Lobby | null;
    if (!lobby) {
      fail('This lobby has closed, or you were removed for being inactive.', 'not-found');
      return;
    }

    let race: Race | null = null;
    let racePlayers: RacePlayer[] = [];
    let passage: string | null = null;
    if (lobby.current_race_id) {
      const [raceRes, rpRes] = await Promise.all([
        sb.from('races').select('id, passage_id, start_at, end_at, duration_s, zero_mistakes, ended_at, status, mode, awarded_at').eq('id', lobby.current_race_id).maybeSingle(),
        sb.from('race_players').select(RACE_PLAYER_COLUMNS).eq('race_id', lobby.current_race_id),
      ]);
      race = raceRes.data as Race | null;
      racePlayers = (rpRes.data ?? []) as RacePlayer[];
      if (race) {
        passage = textCache.current.get(race.id) ?? null;
        if (passage === null) {
          const { data } = await sb.from('races').select('text').eq('id', race.id).single();
          passage = (data?.text as string | null | undefined) ?? null;
          if (passage) textCache.current.set(race.id, passage);
        }
      }
    }

    setState((s) => ({
      ...s,
      phase: 'ready',
      lobby,
      players: (playersRes.data ?? []) as LobbyPlayer[],
      votes: (votesRes.data ?? []) as Vote[],
      race,
      racePlayers,
      passage,
      // Fresh race: drop stale live progress from the previous one.
      live: s.race?.id === race?.id ? s.live : {},
      voteResult: lobby.status === 'voting' ? null : s.voteResult,
    }));
  }, [fail]);

  /** Coalesces bursts of server events into at most one extra fetch. */
  const refresh = useCallback(async () => {
    if (refreshing.current) {
      refreshAgain.current = true;
      return refreshing.current;
    }
    refreshing.current = (async () => {
      do {
        refreshAgain.current = false;
        await load().catch(() => {});
      } while (refreshAgain.current);
      refreshing.current = null;
    })();
    return refreshing.current;
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    let heartbeat: ReturnType<typeof setInterval> | undefined;

    (async () => {
      try {
        const userId = await ensureSession();
        const id = await api.joinLobby(code, name);
        if (cancelled) return;
        lobbyId.current = id;
        // Bring the player's last garage build into this lobby (cosmetic; best effort).
        const saved = loadBuild();
        if (saved) {
          await api.setVehicle(id, saved.build).catch(() => {});
          await api.setCarColor(id, saved.primary).catch(() => {});
        }
        const clockOffset = await measureClockOffset();
        if (cancelled) return;
        setState((s) => ({ ...s, userId, clockOffset }));
        await refresh();

        const sb = requireSupabase();
        await sb.realtime.setAuth();
        const ch = sb.channel(`lobby:${code}`, {
          config: { private: true, presence: { key: userId } },
        });
        for (const event of ['lobby:update', 'vote:start', 'vote:update', 'race:start', 'player:finished', 'race:end', 'race:awards']) {
          ch.on('broadcast', { event }, () => void refresh());
        }
        ch.on('broadcast', { event: 'vote:result' }, ({ payload }) =>
          setState((s) => ({ ...s, voteResult: (payload as { mode: VoteMode }).mode })),
        );
        ch.on('broadcast', { event: 'progress' }, ({ payload }) => {
          const p = payload as { id: string } & LiveProgress;
          setState((s) => ({ ...s, live: { ...s.live, [p.id]: { chars: p.chars, wpm: p.wpm, errors: p.errors } } }));
        });
        ch.on('presence', { event: 'sync' }, () =>
          setState((s) => ({ ...s, online: new Set(Object.keys(ch.presenceState())) })),
        );
        ch.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setState((s) => ({ ...s, connected: true }));
            void ch.track({ name });
            void refresh(); // catch anything missed while (re)connecting
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            if (!cancelled) setState((s) => ({ ...s, connected: false }));
          }
        });
        channel.current = ch;

        heartbeat = setInterval(() => {
          api.heartbeat(id).catch((e) => {
            if (errorCode(e) === 'not_member') fail('You were removed from the lobby for being inactive.', 'inactive');
          });
        }, HEARTBEAT_MS);
      } catch (e) {
        const code = errorCode(e);
        const kind: LobbyErrorKind =
          code === 'lobby_not_found' ? 'not-found' : code === 'lobby_full' ? 'full' : code === 'name_taken' ? 'name-taken' : 'generic';
        if (!cancelled) fail(errorMessage(e), kind);
      }
    })();

    return () => {
      cancelled = true;
      clearInterval(heartbeat);
      if (channel.current) void requireSupabase().removeChannel(channel.current);
      channel.current = null;
    };
  }, [code, name, refresh, fail]);

  const sendProgress = useCallback((id: string, progress: LiveProgress) => {
    void channel.current?.send({ type: 'broadcast', event: 'progress', payload: { id, ...progress } });
  }, []);

  /** Manual retry for the reconnecting state: re-fetch and resubscribe. */
  const retry = useCallback(() => {
    void refresh();
    channel.current?.subscribe();
  }, [refresh]);

  return { state, refresh, sendProgress, retry };
}
