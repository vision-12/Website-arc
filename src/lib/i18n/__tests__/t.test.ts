import { describe, expect, it } from 'vitest';
import { t, type MessageKey } from '../t';

describe('t()', () => {
  it('returns UK-English strings', () => {
    expect(t('status.published')).toBe('On website');
    expect(t('saveState.unsaved')).toBe('Not saved — check your connection');
  });
  it('throws on keys that are not strings', () => {
    expect(() => t('status' as MessageKey)).toThrow(/Missing message/);
  });
});
