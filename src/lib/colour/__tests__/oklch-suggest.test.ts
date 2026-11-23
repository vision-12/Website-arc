import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { contrastRatio, NEAR_BLACK, toHex, WHITE } from '../contrast';
import { colourScale, hexToOklch, oklchToHex } from '../oklch';
import { suggestAccessibleColour } from '../suggest';

const hexArb = fc.tuple(fc.nat(255), fc.nat(255), fc.nat(255)).map((rgb) => toHex(rgb));

describe('OKLCH conversion', () => {
  it('round-trips sRGB colours within one 8-bit step', () => {
    fc.assert(
      fc.property(hexArb, (hex) => {
        const back = oklchToHex(hexToOklch(hex));
        const [a, b] = [hex, back].map((h) =>
          [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16)),
        );
        a!.forEach((v, i) => expect(Math.abs(v - b![i]!)).toBeLessThanOrEqual(1));
      }),
    );
  });

  it('produces a monotonically darkening 50–900 scale', () => {
    const scale = Object.values(colourScale('#1a5276'));
    for (let i = 1; i < scale.length; i++)
      expect(hexToOklch(scale[i]!).l).toBeLessThan(hexToOklch(scale[i - 1]!).l);
  });
});

describe('suggestAccessibleColour', () => {
  it('returns the colour unchanged when it already passes', () => {
    expect(suggestAccessibleColour('#1f2937', WHITE)).toBe('#1f2937');
  });

  it('always reaches the target and keeps roughly the same hue', () => {
    fc.assert(
      fc.property(hexArb, fc.constantFrom(WHITE, NEAR_BLACK), (hex, against) => {
        const suggestion = suggestAccessibleColour(hex, against);
        if (suggestion === null) return;
        expect(contrastRatio(suggestion, against)).toBeGreaterThanOrEqual(4.5);
        const before = hexToOklch(hex);
        const after = hexToOklch(suggestion);
        if (before.c > 0.05 && after.c > 0.05) {
          const dh = Math.abs(before.h - after.h) % 360;
          expect(Math.min(dh, 360 - dh)).toBeLessThan(25);
        }
      }),
      { numRuns: 300 },
    );
  });

  it('darkens a pale gold for use on white', () => {
    const s = suggestAccessibleColour('#f4c430', WHITE)!;
    expect(contrastRatio(s, WHITE)).toBeGreaterThanOrEqual(4.5);
    expect(hexToOklch(s).l).toBeLessThan(hexToOklch('#f4c430').l);
  });
});

describe('suggestAccessibleColour edge cases', () => {
  it('lightens a dark colour for use on a dark background', () => {
    const s = suggestAccessibleColour('#1a1a40', '#0b0b0b')!;
    expect(contrastRatio(s, '#0b0b0b')).toBeGreaterThanOrEqual(4.5);
    expect(hexToOklch(s).l).toBeGreaterThan(hexToOklch('#1a1a40').l);
  });

  it('returns null when no shade can reach the target', () => {
    expect(suggestAccessibleColour('#808080', '#777777', 21)).toBeNull();
  });
});
