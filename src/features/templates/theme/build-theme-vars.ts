import { contrastRatio, NEAR_BLACK, WHITE } from '@/lib/colour/contrast';
import { colourScale } from '@/lib/colour/oklch';
import { suggestAccessibleColour } from '@/lib/colour/suggest';
import { fontVar } from '@/lib/fonts/keys';
import type { Theme } from '@/features/cms/settings/schema';

export type ThemeVars = Record<`--brand-${string}`, string>;

const RADIUS: Record<Theme['radius'], string> = {
  none: '0px',
  sm: '0.25rem',
  md: '0.5rem',
  lg: '1rem',
};
const DENSITY: Record<Theme['density'], string> = { comfortable: '1', compact: '0.85' };

/** Text colour (white or near-black) with the higher contrast on the given background. */
export function readableInk(background: string): string {
  return contrastRatio(WHITE, background) >= contrastRatio(NEAR_BLACK, background)
    ? WHITE
    : NEAR_BLACK;
}

function colourVars(name: string, hex: string): ThemeVars {
  const vars: ThemeVars = {
    [`--brand-${name}`]: hex,
    [`--brand-${name}-fg`]: readableInk(hex),
    // A variant guaranteed to be readable as text on white (falls back to near-black).
    [`--brand-${name}-text`]: suggestAccessibleColour(hex, WHITE) ?? NEAR_BLACK,
  };
  for (const [stop, value] of Object.entries(colourScale(hex)))
    vars[`--brand-${name}-${stop}`] = value;
  return vars;
}

/** Pure: `site_settings.theme` → CSS custom properties (spec §6.2). */
export function buildThemeVars(theme: Theme): ThemeVars {
  return {
    ...colourVars('primary', theme.primary),
    ...colourVars('secondary', theme.secondary),
    ...colourVars('accent', theme.accent ?? theme.secondary),
    '--brand-radius': RADIUS[theme.radius],
    '--brand-density': DENSITY[theme.density],
    '--brand-font-heading': `var(${fontVar(theme.fontHeading)})`,
    '--brand-font-body': `var(${fontVar(theme.fontBody)})`,
  };
}

/** Serialises theme variables as a stylesheet body. Values are generated, never user strings. */
export function themeVarsToCss(vars: ThemeVars): string {
  const body = Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');
  return `:root {\n${body}\n}\n`;
}
