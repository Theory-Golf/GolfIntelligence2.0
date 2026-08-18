'use client';

import { useCallback, useEffect, useState } from 'react';
import { createBrowserClient } from './db/client';
import { getDrillSessionsByPlayer } from './db/drillSessions';
import { persistOrQueue } from './offlineQueue';
import type { DrillSessionRow, DrillType } from './db/types';

interface Envelope<T> {
  version: number;
  sessions: T[];
}

interface UseDrillHistoryOptions<T> {
  drillType: DrillType;
  lsKey: string;
  version?: number;
  getId: (session: T) => string;
  getPlayedAt: (session: T) => string;
}

export function useDrillHistory<T>({
  drillType,
  lsKey,
  version = 1,
  getId,
  getPlayedAt,
}: UseDrillHistoryOptions<T>) {
  // Start empty and load localStorage in an effect (not a useState
  // initializer) -- these pages are statically prerendered, so reading
  // localStorage synchronously during the first client render would
  // mismatch the server-rendered (empty) HTML.
  const [sessions, setSessions] = useState<T[]>([]);

  useEffect(() => {
    setSessions(loadLocal<T>(lsKey, version));
  }, [lsKey, version]);

  const record = useCallback(
    (session: T) => {
      setSessions((prev) => {
        const next = [session, ...prev];
        saveLocal(lsKey, version, next);
        return next;
      });
      void syncDrillSession({ drillType, session, getId, getPlayedAt });
    },
    [drillType, lsKey, version, getId, getPlayedAt],
  );

  const remove = useCallback(
    (id: string) => {
      setSessions((prev) => {
        const next = prev.filter((s) => getId(s) !== id);
        saveLocal(lsKey, version, next);
        return next;
      });
      void syncDelete({ drillType, clientId: id });
    },
    [drillType, lsKey, version, getId],
  );

  useEffect(() => {
    let active = true;
    const supabase = createBrowserClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!active || !data.user) return;
      try {
        const remote = await getDrillSessionsByPlayer(data.user.id, drillType);
        if (!active) return;
        mergeRemoteIntoLocal<T>(remote, lsKey, version, getId, setSessions);
      } catch (err) {
        console.error('[useDrillHistory] remote fetch failed', err);
      }
    });
    return () => {
      active = false;
    };
  }, [drillType, lsKey, version, getId]);

  return { sessions, record, remove };
}

function loadLocal<T>(lsKey: string, version: number): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(lsKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Some drills (Lag Putt Test, Round Simulation) predate the
    // {version, sessions} envelope and store a bare array; Winners Circle's
    // envelope names the array "runs" instead of "sessions". Read all three;
    // record()/saveLocal always writes the canonical envelope going forward.
    if (Array.isArray(parsed)) return parsed as T[];
    const store = parsed as Envelope<T> & { runs?: T[] };
    if (store.version !== version) return [];
    if (Array.isArray(store.sessions)) return store.sessions;
    if (Array.isArray(store.runs)) return store.runs;
    return [];
  } catch {
    return [];
  }
}

function saveLocal<T>(lsKey: string, version: number, sessions: T[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(lsKey, JSON.stringify({ version, sessions }));
  } catch {
    /* noop -- quota or unavailable */
  }
}

// Exported for drills whose local history doesn't live in its own flat
// {version, sessions} localStorage key (e.g. it's nested inside a larger
// state blob, like Driver Standard's PersistedState.history) -- they manage
// their own local read/write and call this directly to sync one session.
export async function syncDrillSession<T>(args: {
  drillType: DrillType;
  session: T;
  getId: (s: T) => string;
  getPlayedAt: (s: T) => string;
}) {
  const supabase = createBrowserClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await persistOrQueue({
    type: 'upsertDrillSession',
    payload: {
      player_id: data.user.id,
      drill_type: args.drillType,
      client_id: args.getId(args.session),
      played_at: args.getPlayedAt(args.session),
      payload: args.session,
    },
  });
}

async function syncDelete(args: { drillType: DrillType; clientId: string }) {
  const supabase = createBrowserClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await persistOrQueue({
    type: 'deleteDrillSession',
    payload: {
      player_id: data.user.id,
      drill_type: args.drillType,
      client_id: args.clientId,
    },
  });
}

function mergeRemoteIntoLocal<T>(
  remote: DrillSessionRow[],
  lsKey: string,
  version: number,
  getId: (s: T) => string,
  setSessions: (updater: (prev: T[]) => T[]) => void,
) {
  setSessions((prev) => {
    const existingIds = new Set(prev.map(getId));
    const toAdd = remote
      .filter((r) => !existingIds.has(r.client_id))
      .map((r) => r.payload as T);
    if (toAdd.length === 0) return prev;
    const merged = [...prev, ...toAdd];
    saveLocal(lsKey, version, merged);
    return merged;
  });
}
