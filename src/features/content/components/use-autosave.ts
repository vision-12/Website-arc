'use client';
import { useEffect, useState } from 'react';
import type { SaveState } from '@/components/shared/save-state-indicator';

/** What a save attempt reports back. `retry`: skipped (throttled); try again shortly. */
export type SaveOutcome = 'saved' | 'retry' | 'failed';
export type SaveFn<T> = (value: T, opts: { force: boolean }) => Promise<SaveOutcome>;

export const IDLE_MS = 2_000;
/** MP §11: drafts autosave at least every 10 s while someone keeps typing. */
export const MAX_WAIT_MS = 10_000;
const RETRY_MS = [3_000, 6_000, 12_000, 30_000, 60_000];

/**
 * The autosave controller (MP §11, spec D4), independent of React so it can be tested with fake
 * timers. Saves 2 s after the last change, or at most 10 s after the first unsaved one. A failed
 * save keeps the value pending and retries with backoff; nothing typed is dropped.
 */
export function createAutosaver<T>(onState: (state: SaveState) => void) {
  let save: SaveFn<T> = () => Promise.resolve('failed');
  let latest: T | null = null;
  let dirty = false;
  let inFlight: Promise<void> | null = null;
  let suspended = false;
  let failures = 0;
  let failed = false;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let maxTimer: ReturnType<typeof setTimeout> | undefined;

  const clearTimers = () => {
    clearTimeout(idleTimer);
    clearTimeout(maxTimer);
    idleTimer = undefined;
    maxTimer = undefined;
  };
  const schedule = (wait = IDLE_MS) => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => void flush(), wait);
    maxTimer ??= setTimeout(() => void flush(), MAX_WAIT_MS);
  };

  async function attempt(value: T, force: boolean) {
    let outcome: SaveOutcome;
    try {
      outcome = await save(value, { force });
    } catch {
      outcome = 'failed';
    }
    if (outcome === 'saved') {
      failures = 0;
      failed = false;
      if (dirty) schedule();
      else onState('saved');
      return;
    }
    dirty = true; // still pending: nothing was lost
    if (outcome === 'failed') {
      failed = true;
      onState('unsaved');
      clearTimers();
      schedule(RETRY_MS[Math.min(failures, RETRY_MS.length - 1)]);
      failures += 1;
    } else schedule();
  }

  async function flush(force = false): Promise<void> {
    if (inFlight) await inFlight;
    if (!dirty || suspended || latest === null) return;
    clearTimers();
    const value = latest;
    dirty = false;
    onState('saving');
    inFlight = attempt(value, force);
    await inFlight;
    inFlight = null;
  }

  return {
    setSave(fn: SaveFn<T>) {
      save = fn;
    },
    /** Call with the full current value on every change. */
    changed(value: T) {
      latest = value;
      dirty = true;
      if (suspended) return;
      if (!failed) onState('saving');
      schedule();
    },
    flush,
    /** Before an explicit save or publish: wait for any save in progress and stop autosaving. */
    async settle() {
      suspended = true;
      clearTimers();
      if (inFlight) await inFlight;
    },
    /** After an explicit save or publish succeeded: what is on screen is saved. */
    markSaved() {
      dirty = false;
      suspended = false;
      failures = 0;
      failed = false;
      clearTimers();
      onState('saved');
    },
    /** After an explicit save failed: carry on autosaving what is on screen. */
    resume() {
      suspended = false;
      if (dirty) void flush();
    },
    isDirty: () => dirty || inFlight !== null,
    dispose: clearTimers,
  };
}

export type Autosaver<T> = ReturnType<typeof createAutosaver<T>>;

/**
 * Autosave for admin forms. Call `changed(value)` from change handlers. Also saves when the tab is
 * hidden or the connection returns, and asks before leaving with unsaved changes.
 */
export function useAutosave<T>(save: SaveFn<T>): Autosaver<T> & { state: SaveState } {
  const [state, setState] = useState<SaveState>('saved');
  const [saver] = useState(() => createAutosaver<T>(setState));

  useEffect(() => saver.setSave(save), [saver, save]);

  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === 'hidden') void saver.flush();
    };
    const onOnline = () => void saver.flush();
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saver.isDirty()) e.preventDefault();
    };
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('online', onOnline);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('beforeunload', onBeforeUnload);
      saver.dispose();
    };
  }, [saver]);

  return { ...saver, state };
}
