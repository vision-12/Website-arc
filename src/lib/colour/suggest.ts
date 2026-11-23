import { contrastRatio, relativeLuminance, AA_TEXT } from './contrast';
import { hexToOklch, oklchToHex } from './oklch';

/**
 * Returns the colour closest to `hex` (same hue, OKLCH lightness moved away from `against`)
 * that reaches `target` contrast against `against`, or null if none exists.
 * Used to propose "a suggested darker shade" to admins (MP §3.2).
 */
export function suggestAccessibleColour(
  hex: string,
  against: string,
  target = AA_TEXT,
): string | null {
  if (contrastRatio(hex, against) >= target) return hex;
  const base = hexToOklch(hex);
  const darken = relativeLuminance(against) > 0.18;
  const extreme = oklchToHex({ ...base, l: darken ? 0 : 1 });
  if (contrastRatio(extreme, against) < target) return null;

  // Binary-search the lightness between the original and the extreme.
  let ok = darken ? 0 : 1;
  let bad = base.l;
  for (let i = 0; i < 30; i++) {
    const mid = (ok + bad) / 2;
    if (contrastRatio(oklchToHex({ ...base, l: mid }), against) >= target) ok = mid;
    else bad = mid;
  }
  // Rounding to 8-bit can land just under the target; step further until it passes.
  let candidate = oklchToHex({ ...base, l: ok });
  for (let step = 0; contrastRatio(candidate, against) < target && step < 50; step++) {
    ok = darken ? Math.max(0, ok - 0.005) : Math.min(1, ok + 0.005);
    candidate = oklchToHex({ ...base, l: ok });
  }
  return contrastRatio(candidate, against) >= target ? candidate : null;
}
