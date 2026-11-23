/** sRGB ⇄ OKLCH conversion (Björn Ottosson's OKLab), with gamut mapping by chroma reduction. */
import { parseHex, toHex, type Rgb } from './contrast';

export interface Oklch {
  l: number; // 0..1
  c: number; // 0..~0.4
  h: number; // degrees 0..360
}

const toLinear = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (v: number) =>
  255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

export function hexToOklch(hex: string): Oklch {
  const [r, g, b] = parseHex(hex).map(toLinear) as unknown as Rgb;
  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const c = Math.hypot(A, B);
  const h = c < 1e-6 ? 0 : ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
  return { l: L, c, h };
}

function oklchToLinearRgb({ l, c, h }: Oklch): [number, number, number] {
  const hr = (h * Math.PI) / 180;
  const A = c * Math.cos(hr);
  const B = c * Math.sin(hr);
  const l_ = (l + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m_ = (l - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s_ = (l - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

const inGamut = (rgb: number[]) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);

/** Converts to hex, reducing chroma (keeping lightness and hue) until the colour fits sRGB. */
export function oklchToHex(colour: Oklch): string {
  const l = Math.max(0, Math.min(1, colour.l));
  let lo = 0;
  let hi = colour.c;
  if (inGamut(oklchToLinearRgb({ ...colour, l }))) lo = hi;
  else {
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinearRgb({ l, c: mid, h: colour.h }))) lo = mid;
      else hi = mid;
    }
  }
  const linear = oklchToLinearRgb({ l, c: lo, h: colour.h });
  return toHex(linear.map((v) => fromLinear(Math.max(0, Math.min(1, v)))) as unknown as Rgb);
}

/** Lightness stops for a 50–900 tint/shade scale. */
export const SCALE_STOPS = {
  50: 0.97,
  100: 0.93,
  200: 0.86,
  300: 0.77,
  400: 0.67,
  500: 0.58,
  600: 0.5,
  700: 0.42,
  800: 0.34,
  900: 0.26,
} as const;
export type ScaleStop = keyof typeof SCALE_STOPS;

export function colourScale(hex: string): Record<ScaleStop, string> {
  const base = hexToOklch(hex);
  const entries = Object.entries(SCALE_STOPS).map(([stop, l]) => {
    // Pale tints carry less chroma so they stay usable as backgrounds.
    const c = base.c * (l > 0.85 ? 0.35 : l > 0.7 ? 0.7 : 1);
    return [stop, oklchToHex({ l, c, h: base.h })];
  });
  return Object.fromEntries(entries) as Record<ScaleStop, string>;
}
