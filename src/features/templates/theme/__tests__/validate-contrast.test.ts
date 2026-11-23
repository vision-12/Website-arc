import { describe, expect, it } from 'vitest';
import { contrastRatio } from '@/lib/colour/contrast';
import { validateThemeContrast } from '../validate-contrast';

describe('validateThemeContrast', () => {
  it('accepts a dark primary and any readable secondary', () => {
    expect(validateThemeContrast({ primary: '#7b1e3a', secondary: '#f4c430' })).toEqual({
      ok: true,
    });
  });

  it('rejects a primary too light for links on white, with a darker suggestion', () => {
    const result = validateThemeContrast({ primary: '#00c2ff', secondary: '#0b1f3a' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const issue = result.issues.find((i) => i.token === 'primary')!;
    expect(issue.ratio).toBeLessThan(4.5);
    expect(issue.suggestion).not.toBeNull();
    expect(contrastRatio(issue.suggestion!, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(issue.message).toMatch(/too light/);
    expect(issue.message).toContain(issue.suggestion!);
  });

  it('checks the accent against the 3:1 non-text threshold', () => {
    const result = validateThemeContrast({
      primary: '#1f2937',
      secondary: '#1f2937',
      accent: '#e5e7eb',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.map((i) => i.token)).toEqual(['accent']);
    expect(
      validateThemeContrast({ primary: '#1f2937', secondary: '#1f2937', accent: '#767676' }),
    ).toEqual({ ok: true });
  });

  it('uses plain language, not jargon', () => {
    const result = validateThemeContrast({ primary: '#ffeb3b', secondary: '#ffffff' });
    if (result.ok) throw new Error('expected issues');
    for (const issue of result.issues) expect(issue.message).not.toMatch(/WCAG|luminance|AA/);
  });
});
