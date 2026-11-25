import { describe, expect, it } from 'vitest';
import { contrastRatio, NEAR_BLACK, WHITE } from '@/lib/colour/contrast';
import { FALLBACK_SETTINGS } from '@/features/cms/settings/fallback';
import type { Theme } from '@/features/cms/settings/schema';
import { buildThemeVars, readableInk, themeVarsToCss } from '../build-theme-vars';

const theme: Theme = {
  ...FALLBACK_SETTINGS.theme,
  primary: '#7b1e3a',
  secondary: '#f4c430',
  fontHeading: 'playfair-display',
  fontBody: 'nunito-sans',
  radius: 'lg',
  density: 'compact',
};

describe('buildThemeVars', () => {
  const vars = buildThemeVars(theme);

  it('exposes brand colours, readable foregrounds and full scales', () => {
    expect(vars['--brand-primary']).toBe('#7b1e3a');
    expect(vars['--brand-primary-fg']).toBe(WHITE);
    expect(vars['--brand-secondary-fg']).toBe(NEAR_BLACK);
    for (const stop of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900])
      expect(vars[`--brand-primary-${stop}`]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('always provides text variants that pass AA on white', () => {
    for (const name of ['primary', 'secondary', 'accent']) {
      expect(contrastRatio(vars[`--brand-${name}-text`]!, WHITE)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('falls back to the secondary colour for the accent', () => {
    expect(vars['--brand-accent']).toBe(vars['--brand-secondary']);
  });

  it('maps fonts, radius and density', () => {
    expect(vars['--brand-font-heading']).toBe(
      "var(--font-playfair-display), 'Playfair Display Fallback Android', 'Playfair Display Fallback Linux', serif",
    );
    expect(vars['--brand-font-body']).toBe(
      "var(--font-nunito-sans), 'Nunito Sans Fallback Android', 'Nunito Sans Fallback Linux', sans-serif",
    );
    expect(vars['--brand-radius']).toBe('1rem');
    expect(vars['--brand-density']).toBe('0.85');
  });

  it('serialises to a :root block containing only generated values', () => {
    const css = themeVarsToCss(vars);
    expect(css.startsWith(':root {')).toBe(true);
    expect(css).not.toMatch(/[<>{}]\s*[^:\n]*;.*[<>]/);
    expect(css.match(/--brand-/g)?.length).toBe(Object.keys(vars).length);
  });

  it('is stable for the neutral fallback theme', () => {
    expect(buildThemeVars(FALLBACK_SETTINGS.theme)).toMatchSnapshot();
  });
});

describe('readableInk', () => {
  it('picks the higher-contrast text colour', () => {
    expect(readableInk('#000000')).toBe(WHITE);
    expect(readableInk('#ffffff')).toBe(NEAR_BLACK);
    expect(readableInk('#f4c430')).toBe(NEAR_BLACK);
  });
});
