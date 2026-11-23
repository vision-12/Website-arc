import { AA_NON_TEXT, AA_TEXT, contrastRatio, WHITE } from '@/lib/colour/contrast';
import { suggestAccessibleColour } from '@/lib/colour/suggest';
import type { Theme } from '@/features/cms/settings/schema';
import { readableInk } from './build-theme-vars';

export interface ContrastIssue {
  token: 'primary' | 'secondary' | 'accent';
  ratio: number;
  required: number;
  against: string;
  suggestion: string | null;
  message: string;
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Brand-colour rules (MP §3.2, WCAG 2.2 AA):
 *  - primary is used for links and buttons on white → needs 4.5:1 against white.
 *  - secondary is used as a background with automatic white/near-black text → needs 4.5:1 with that text.
 *  - accent is decorative (borders, underlines) → needs 3:1 against white.
 * Templates use the generated `--brand-*-text` variant whenever a brand colour is used as text.
 */
export function validateThemeContrast(
  theme: Pick<Theme, 'primary' | 'secondary' | 'accent'>,
): { ok: true } | { ok: false; issues: ContrastIssue[] } {
  const issues: ContrastIssue[] = [];

  const primary = contrastRatio(theme.primary, WHITE);
  if (primary < AA_TEXT) {
    const suggestion = suggestAccessibleColour(theme.primary, WHITE, AA_TEXT);
    issues.push({
      token: 'primary',
      ratio: round(primary),
      required: AA_TEXT,
      against: WHITE,
      suggestion,
      message: `The main colour is too light for links and buttons on a white page, so some visitors would struggle to read them (contrast ${round(primary)}:1, needs ${AA_TEXT}:1).${suggestion ? ` Try ${suggestion} instead — it is the same colour, slightly darker.` : ''}`,
    });
  }

  const ink = readableInk(theme.secondary);
  const secondary = contrastRatio(theme.secondary, ink);
  if (secondary < AA_TEXT) {
    const suggestion = suggestAccessibleColour(theme.secondary, ink, AA_TEXT);
    issues.push({
      token: 'secondary',
      ratio: round(secondary),
      required: AA_TEXT,
      against: ink,
      suggestion,
      message: `Text placed on the second colour would be hard to read (contrast ${round(secondary)}:1, needs ${AA_TEXT}:1).${suggestion ? ` Try ${suggestion} instead.` : ''}`,
    });
  }

  if (theme.accent) {
    const accent = contrastRatio(theme.accent, WHITE);
    if (accent < AA_NON_TEXT) {
      const suggestion = suggestAccessibleColour(theme.accent, WHITE, AA_NON_TEXT);
      issues.push({
        token: 'accent',
        ratio: round(accent),
        required: AA_NON_TEXT,
        against: WHITE,
        suggestion,
        message: `The highlight colour is too faint to see on a white page (contrast ${round(accent)}:1, needs ${AA_NON_TEXT}:1).${suggestion ? ` Try ${suggestion} instead.` : ''}`,
      });
    }
  }

  return issues.length ? { ok: false, issues } : { ok: true };
}
