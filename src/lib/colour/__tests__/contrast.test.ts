import { describe, expect, it } from 'vitest';
import { contrastRatio, isHex, parseHex, relativeLuminance, toHex } from '../contrast';

describe('WCAG contrast', () => {
  it.each([
    ['#000000', '#ffffff', 21],
    ['#777777', '#ffffff', 4.48],
    ['#767676', '#ffffff', 4.54],
    ['#0b1f3a', '#f5f7fa', 15.39],
    ['#00c2ff', '#ffffff', 2.07],
  ])('%s on %s ≈ %s:1', (a, b, expected) => {
    expect(contrastRatio(a, b)).toBeCloseTo(expected, 1);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#123456', '#fedcba')).toBe(contrastRatio('#fedcba', '#123456'));
  });

  it('parses short and long hex and round-trips', () => {
    expect(parseHex('#fff')).toEqual([255, 255, 255]);
    expect(toHex(parseHex('#1a3c6e'))).toBe('#1a3c6e');
    expect(isHex('#12345')).toBe(false);
    expect(() => parseHex('red')).toThrow();
  });

  it('computes luminance at the extremes', () => {
    expect(relativeLuminance('#000')).toBe(0);
    expect(relativeLuminance('#fff')).toBeCloseTo(1);
  });
});
