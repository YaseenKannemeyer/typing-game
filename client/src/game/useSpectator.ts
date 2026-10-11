import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { LobbyStatus, PassageMode, VoteMode } from '@race/shared';
import type { DestinationId } from '../art/worldArt';
import { api, errorCode, errorMessage } from '../lib/api';
import { measureClockOffset } from '../lib/clock';
import { ensureSession, requireSupabase } from '../lib/supabase';
import { parseProgress } from './useLobby';
import type { LiveProgress, LobbyPlayer } from './types';

/** Public room state from watch_lobby(): no passage text, keystrokes or account data. */
export interface WatchSnapshot {
  /** Server time of the snapshot; older snapshots are dropped. */
  at: string;
  lobby: {
    code: string;
    status: LobbyStatus;
    mode: VoteMode | null;
    destination: DestinationId | null;
    race_seconds: number;
    zero_mistakes: boolean;
  };
  players: Pick<LobbyPlayer, 'user_id' | 'name' | 'car_color' | 'vehicle'>[];
  race: {
    id: string;
    mode: PassageMode;
    status: 'racing' | 'finished';
    start_at: string;
    end_at: string | null;
    duration_s: number | null;
    zero_mistakes: boolean;
    ended_at: string | null;
  } | null;
  racers: WatchRacer[];
}

export interface WatchRacer {
  user_id: string;
  name: string;
  correct_chars: number;
  errors: number;
  /** Set by the server for racers present at the end; null = DNF. */
  finished_at: string | null;
  /** Official rank, once the race is finalised. */
  rank: number | null;
  net_wpm: number | null;
  accuracy: number | null;
  flagged: boolean;
}

export type FeedStatus = 'live' | 'delayed' | 'reconnecting';

export interface SpectatorState {
  phase: 'joining' | 'ready' | 'error';
  error: string | null;
  notFound: boolean;
  snapshot: WatchSnapshot | null;
  /** Server-relayed positions since the last snapshot (display only). */
  live: Record<string, LiveProgress>;
  /** Server time minus local time, in ms. */
  clockOffset: number;
  channelUp: boolean;
  /** Local time of the last accepted snapshot. */
  receivedAt: number;
}

/** Snapshot poll: the spectator heartbeat, and a catch-up if events were missed. */
const POLL_MS = 5000;
/** No accepted snapshot for this long and the feed is marked delayed. */
export const DELAYED_AFTER_MS = 15_000;

const initial: SpectatorState = {
  phase: 'joining',
  error: null,
  notFound: false,
  snapshot: null,
  live: {},
  clockOffset: 0,
  channelUp: false,
  receivedAt: 0,
};

/**
 * Watches a room without joining it. Snapshots come from watch_lobby(), which
 * also keeps the spectator registered; server events on `lobby:<CODE>:server`
 * trigger a re-fetch and `progress` events move the cars between snapshots.
 * The last snapshot is kept through reconnects.
 */
export function useSpectator(code: string) {
  const [state, setState] = useState<SpectatorState>(initial);
  const lastAt = useRef(0);
  const refreshing = useRef<Promise<void> | null>(null);
  const refreshAgain = useRef(false);
  const alive = useRef(true);

  const load = useCallback(async () => {
    try {
      const snap = await api.watchLobby(code);
      const at = Date.parse(snap.at);
      // Out of order (an older request answered late): keep what we have.
      if (!alive.current || at < lastAt.current) return;
      lastAt.current = at;
      setState((s) => ({
        ...s,
        phase: 'ready',
        error: null,
        snapshot: snap,
        receivedAt: Date.now(),
        // New race: drop the previous race's live positions.
        live: s.snapshot?.race?.id === snap.race?.id ? s.live : {},
      }));
    } catch (e) {
      if (!alive.current) return;
      const c = errorCode(e);
      if (c === 'lobby_not_found') setState((s) => ({ ...s, phase: 'error', notFound: true, error: errorMessage(e) }));
      else if (c === 'spectators_full' || c === 'not_authenticated') setState((s) => ({ ...s, phase: 'error', error: errorMessage(e) }));
      // Network trouble: keep the last snapshot; the feed shows as delayed.
    }
  }, [code]);

  /** Coalesces bursts of server events into at most one extra fetch. */
  const refresh = useCallback(async () => {
    if (refreshing.current) {
      refreshAgain.current = true;
      return refreshing.current;
    }
    refreshing.current = (async () => {
      do {
        refreshAgain.current = false;
        await load();
      } while (refreshAgain.current);
      refreshing.current = null;
    })();
    return refreshing.current;
  }, [load]);

  const channel = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    alive.current = true;
    let poll: ReturnType<typeof setInterval> | undefined;

    (async () => {
      try {
        await ensureSession();
        const clockOffset = await measureClockOffset();
        if (!alive.current) return;
        setState((s) => ({ ...s, clockOffset }));
        // Registers us as a spectator, which the realtime policy checks.
        await refresh();
        if (!alive.current) return;
        poll = setInterval(() => void refresh(), POLL_MS);

        const sb = requireSupabase();
        await sb.realtime.setAuth();
        if (!alive.current) return;
        const server = sb.channel(`lobby:${code}:server`, { config: { private: true } });
        for (const event of ['lobby:update', 'vote:start', 'vote:update', 'vote:result', 'race:start', 'player:finished', 'race:end', 'race:awards']) {
          server.on('broadcast', { event }, () => void refresh());
        }
        server.on('broadcast', { event: 'progress' }, ({ payload }) => {
          const p = parseProgress(payload);
          if (p) setState((s) => ({ ...s, live: { ...s.live, [p.id]: { chars: p.chars, wpm: p.wpm, errors: p.errors } } }));
        });
        server.subscribe((status) => {
          if (!alive.current) return;
          if (status === 'SUBSCRIBED') {
            setState((s) => ({ ...s, channelUp: true }));
            void refresh(); // catch anything missed while (re)connecting
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            setState((s) => ({ ...s, channelUp: false }));
          }
        });
        channel.current = server;
      } catch (e) {
        if (alive.current) setState((s) => ({ ...s, phase: 'error', error: errorMessage(e) }));
      }
    })();

    return () => {
      alive.current = false;
      clearInterval(poll);
      if (channel.current) void requireSupabase().removeChannel(channel.current);
      channel.current = null;
    };
  }, [code, refresh]);

  const retry = useCallback(() => {
    void refresh();
    channel.current?.subscribe();
  }, [refresh]);

  return { state, retry };
}
