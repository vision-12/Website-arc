/** Allow-listed font families (MP §3.3). Admins choose from these only. Client-safe: no next/font import. */
export const FONT_KEYS = [
  'inter',
  'source-serif-4',
  'playfair-display',
  'lora',
  'nunito-sans',
  'merriweather',
  'dm-sans',
  'libre-baskerville',
] as const;
export type FontKey = (typeof FONT_KEYS)[number];

export const FONT_LABELS: Record<FontKey, string> = {
  inter: 'Inter',
  'source-serif-4': 'Source Serif 4',
  'playfair-display': 'Playfair Display',
  lora: 'Lora',
  'nunito-sans': 'Nunito Sans',
  merriweather: 'Merriweather',
  'dm-sans': 'DM Sans',
  'libre-baskerville': 'Libre Baskerville',
};

/** CSS custom property each family is exposed as (set by next/font `variable`). */
export const fontVar = (key: FontKey) => `--font-${key}`;

const GENERIC: Record<FontKey, 'sans-serif' | 'serif'> = {
  inter: 'sans-serif',
  'source-serif-4': 'serif',
  'playfair-display': 'serif',
  lora: 'serif',
  'nunito-sans': 'sans-serif',
  merriweather: 'serif',
  'dm-sans': 'sans-serif',
  'libre-baskerville': 'serif',
};

/**
 * The full stack for a family: the web font and next/font's Arial/Times-matched fallback (the
 * variable), then the faces from src/lib/fonts/fallbacks.css matched to Android's and Linux's own
 * fonts, so text keeps its size and line breaks while the web font arrives.
 */
export const fontStack = (key: FontKey) =>
  `var(${fontVar(key)}), '${FONT_LABELS[key]} Fallback Android', '${FONT_LABELS[key]} Fallback Linux', ${GENERIC[key]}`;
