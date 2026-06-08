'use client';

import { useEffect, useState } from 'react';
import {
  upsertRound,
  updateRound,
  upsertHole,
  updateHole,
  upsertShot,
  updateShot,
  deleteShot,
} from './db/index';
import type {
  RoundInsert,
  RoundUpdate,
  HoleInsert,
  HoleUpdate,
  ShotInsert,
  ShotUpdate,
} from './db/types';
import { createId } from './utils/uuid';

const STORAGE_KEY = 'tg_offline_queue';
const MAX_ATTEMPTS = 5;

export type QueueEntry =
  | { id: string; type: 'upsertRound'; payload: RoundInsert; createdAt: string; attempts: number }
  | { id: string; type: 'updateRound'; payload: RoundUpdate; createdAt: string; attempts: number }
  | { id: string; type: 'upsertHole'; payload: HoleInsert; createdAt: string; attempts: number }
  | { id: string; type: 'updateHole'; payload: HoleUpdate; createdAt: string; attempts: number }
  | { id: string; type: 'upsertShot'; payload: ShotInsert; createdAt: string; attempts: number }
  | { id: string; type: 'updateShot'; payload: ShotUpdate; createdAt: string; attempts: number }
  | { id: string; type: 'deleteShot'; payload: { id: string }; createdAt: string; attempts: number };

export type QueueEntryInput =
  | { type: 'upsertRound'; payload: RoundInsert }
  | { type: 'updateRound'; payload: RoundUpdate }
  | { type: 'upsertHole'; payload: HoleInsert }
  | { type: 'updateHole'; payload: HoleUpdate }
  | { type: 'upsertShot'; payload: ShotInsert }
  | { type: 'updateShot'; payload: ShotUpdate }
  | { type: 'deleteShot'; payload: { id: string } };

function readQueue(): QueueEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueueEntry[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueueEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // Storage full or unavailable — drop on the floor; the round is still
    // playable in-memory and the player will be notified via the offline pill.
  }
}

export function getQueue(): QueueEntry[] {
  return readQueue();
}

export function enqueue(input: QueueEntryInput): void {
  const entry: QueueEntry = {
    id: createId(),
    createdAt: new Date().toISOString(),
    attempts: 0,
    ...input,
  } as QueueEntry;
  const queue = readQueue();
  queue.push(entry);
  writeQueue(queue);
}

export function dequeue(id: string): void {
  const queue = readQueue();
  const next = queue.filter((e) => e.id !== id);
  if (next.length !== queue.length) writeQueue(next);
}

async function runEntry(entry: QueueEntry): Promise<void> {
  await runWrite(entry);
}

async function runWrite(input: QueueEntryInput): Promise<void> {
  switch (input.type) {
    case 'upsertRound':
      await upsertRound(input.payload);
      return;
    case 'updateRound':
      await updateRound(input.payload);
      return;
    case 'upsertHole':
      await upsertHole(input.payload);
      return;
    case 'updateHole':
      await updateHole(input.payload);
      return;
    case 'upsertShot':
      await upsertShot(input.payload);
      return;
    case 'updateShot':
      await updateShot(input.payload);
      return;
    case 'deleteShot':
      await deleteShot(input.payload.id);
      return;
  }
}

export type PersistResult =
  | { status: 'saved' }
  | { status: 'queued-offline' }
  | { status: 'queued-error'; message: string };

export async function persistOrQueue(input: QueueEntryInput): Promise<PersistResult> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueue(input);
    return { status: 'queued-offline' };
  }
  try {
    await runWrite(input);
    return { status: 'saved' };
  } catch (err) {
    console.error('[persistOrQueue]', err);
    enqueue(input);
    const message =
      err instanceof Error
        ? err.message
        : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : String(err);
    return { status: 'queued-error', message };
  }
}

let flushing = false;

export async function flushQueue(): Promise<void> {
  if (flushing) return;
  if (typeof window === 'undefined') return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  flushing = true;
  try {
    // Snapshot ids in insertion order; re-read between entries to pick up
    // attempts changes and avoid clobbering writes from a sibling tab.
    const ids = readQueue().map((e) => e.id);
    for (const id of ids) {
      const current = readQueue().find((e) => e.id === id);
      if (!current) continue;
      try {
        await runEntry(current);
        dequeue(id);
      } catch {
        const next = readQueue().map((e) =>
          e.id === id ? { ...e, attempts: e.attempts + 1 } : e,
        );
        const bumped = next.find((e) => e.id === id);
        if (bumped && bumped.attempts >= MAX_ATTEMPTS) {
          console.warn('[offline-queue] dead-letter', bumped);
          writeQueue(next.filter((e) => e.id !== id));
        } else {
          writeQueue(next);
        }
      }
    }
  } finally {
    flushing = false;
  }
}

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  useEffect(() => {
    function on() {
      setOnline(true);
    }
    function off() {
      setOnline(false);
    }
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export function QueueFlusher(): null {
  useEffect(() => {
    void flushQueue();
    function onOnline() {
      void flushQueue();
    }
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);
  return null;
}
