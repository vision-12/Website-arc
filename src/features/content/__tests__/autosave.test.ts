import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createAutosaver,
  IDLE_MS,
  MAX_WAIT_MS,
  type SaveOutcome,
} from '../components/use-autosave';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function setup(outcomes: SaveOutcome[] = []) {
  const states: string[] = [];
  const saved: string[] = [];
  const saver = createAutosaver<string>((s) => states.push(s));
  saver.setSave((value) => {
    saved.push(value);
    return Promise.resolve(outcomes.shift() ?? 'saved');
  });
  return { saver, states, saved };
}

describe('autosave controller (MP §11: every 10 s, never lose typing)', () => {
  it('saves 2 s after typing stops, with the latest value', async () => {
    const { saver, states, saved } = setup();
    saver.changed('H');
    saver.changed('He');
    saver.changed('Hello');
    expect(states.at(-1)).toBe('saving');
    await vi.advanceTimersByTimeAsync(IDLE_MS);
    expect(saved).toEqual(['Hello']);
    expect(states.at(-1)).toBe('saved');
  });

  it('saves at least every 10 s while typing continues', async () => {
    const { saver, saved } = setup();
    for (let t = 0; t < MAX_WAIT_MS; t += 1_000) {
      saver.changed(`v${t}`);
      await vi.advanceTimersByTimeAsync(1_000);
    }
    expect(saved.length).toBe(1);
  });

  it('keeps a failed save pending, says so, and retries with backoff', async () => {
    const { saver, states, saved } = setup(['failed', 'failed', 'saved']);
    saver.changed('Fees');
    await vi.advanceTimersByTimeAsync(IDLE_MS);
    expect(states.at(-1)).toBe('unsaved');
    expect(saver.isDirty()).toBe(true);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(states.at(-1)).toBe('unsaved');
    await vi.advanceTimersByTimeAsync(6_000);
    expect(saved).toEqual(['Fees', 'Fees', 'Fees']);
    expect(states.at(-1)).toBe('saved');
  });

  it('retries a throttled save shortly after', async () => {
    const { saver, saved } = setup(['retry', 'saved']);
    saver.changed('x');
    await vi.advanceTimersByTimeAsync(IDLE_MS);
    await vi.advanceTimersByTimeAsync(IDLE_MS);
    expect(saved).toEqual(['x', 'x']);
  });

  it('stops while an explicit save runs, and marks everything saved afterwards', async () => {
    const { saver, states, saved } = setup();
    saver.changed('draft');
    await saver.settle();
    await vi.advanceTimersByTimeAsync(MAX_WAIT_MS * 2);
    expect(saved).toEqual([]); // nothing autosaved while publishing
    saver.markSaved();
    expect(saver.isDirty()).toBe(false);
    expect(states.at(-1)).toBe('saved');
  });

  it('flushes immediately when asked (Preview) and passes force', async () => {
    const calls: boolean[] = [];
    const saver = createAutosaver<string>(() => undefined);
    saver.setSave((_v, { force }) => {
      calls.push(force);
      return Promise.resolve('saved');
    });
    saver.changed('now');
    await saver.flush(true);
    expect(calls).toEqual([true]);
  });
});
