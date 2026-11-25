import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM script without type declarations
import { capsize, fallbackCss, fallbackOverrides } from '../generate-font-fallbacks.mjs';

describe('generate-font-fallbacks', () => {
  it('uses the same formula as next/font (Inter over Arial gives next/font’s own numbers)', () => {
    // next/font's generated face: size-adjust 107.12%, ascent 90.44%, descent 22.52%, gap 0%.
    expect(fallbackOverrides(capsize.inter, capsize.arial)).toEqual({
      sizeAdjust: '107.12%',
      ascentOverride: '90.44%',
      descentOverride: '22.52%',
      lineGapOverride: '0.00%',
    });
  });

  it('matches the committed stylesheet (rerun the script after changing families)', () => {
    const committed = readFileSync(join(process.cwd(), 'src/lib/fonts/fallbacks.css'), 'utf8');
    expect(fallbackCss()).toBe(committed);
  });

  it('covers every allow-listed family on Android and Linux', () => {
    const css = fallbackCss() as string;
    for (const family of [
      'Inter',
      'Source Serif 4',
      'Playfair Display',
      'Lora',
      'Nunito Sans',
      'Merriweather',
      'DM Sans',
      'Libre Baskerville',
    ]) {
      expect(css).toContain(`'${family} Fallback Android'`);
      expect(css).toContain(`'${family} Fallback Linux'`);
    }
  });
});
