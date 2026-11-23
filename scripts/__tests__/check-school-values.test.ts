import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain ESM script without type declarations
import { ALLOW, scan, scanText } from '../check-school-values.mjs';

type Finding = { rule: string };

describe('check-school-values', () => {
  it('flags school domains, +256 numbers and hex colours', () => {
    const findings = scanText(
      'x.ts',
      "const a = 'www.kings.ac.ug';\nconst b = '+256 772 000000';\nconst c = '#1a3c6e';",
    ) as Finding[];
    expect(findings.map((f) => f.rule)).toEqual([
      'Ugandan school domain',
      'Ugandan phone number',
      'hex colour',
    ]);
  });

  it('ignores anchors, entities and URL fragments', () => {
    expect(scanText('x.tsx', 'href="#main-content" &#123; /page#section')).toEqual([]);
  });

  it('allow-lists template tokens, admin brand tokens and tests', () => {
    const allowed = (p: string) => (ALLOW as RegExp[]).some((re) => re.test(p));
    expect(allowed('src/features/templates/modern-academic/tokens.css')).toBe(true);
    expect(allowed('src/app/admin/admin-tokens.css')).toBe(true);
    expect(allowed('src/app/(public)/page.tsx')).toBe(false);
  });

  it('passes on the current source tree', () => {
    expect(scan()).toEqual([]);
  });
});
