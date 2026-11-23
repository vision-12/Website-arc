import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from '@/lib/colour/contrast';

const css = readFileSync(join(__dirname, '..', 'admin-tokens.css'), 'utf8');
const CYAN = '#00c2ff';
const declarations = [...css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => ({
  name: m[1]!,
  value: m[2]!.trim(),
}));
const resolve = (value: string): string => {
  const ref = /^var\((--[\w-]+)\)$/.exec(value);
  return ref
    ? resolve(declarations.find((d) => d.name === ref[1])?.value ?? value)
    : value.toLowerCase();
};

describe('Altrastate admin tokens (PRD §22.2, CLAUDE.md gotcha)', () => {
  it('declares the three brand colours', () => {
    expect(css).toMatch(/#0b1f3a/i);
    expect(css).toMatch(/#00c2ff/i);
    expect(css).toMatch(/#f5f7fa/i);
  });

  it('never uses Electric Cyan as a text/foreground colour', () => {
    const textTokens = declarations.filter((d) => /foreground|text|ink/.test(d.name));
    expect(textTokens.length).toBeGreaterThan(0);
    for (const token of textTokens) expect(resolve(token.value)).not.toBe(CYAN);
    expect(css).not.toMatch(/(^|[^-])color\s*:\s*(var\(--altrastate-cyan\)|#00c2ff)/im);
  });

  it('pairs every text token with an AA-compliant background', () => {
    const value = (n: string) => resolve(declarations.find((d) => d.name === n)!.value);
    expect(contrastRatio(value('--foreground'), value('--background'))).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(value('--muted-foreground'), value('--background')),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(value('--admin-sidebar-foreground'), value('--admin-sidebar')),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(value('--admin-sidebar-foreground'), value('--admin-sidebar-active')),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('gives the focus ring a ≥3:1 component on light surfaces and on the sidebar (WCAG 1.4.11)', () => {
    expect(css).toMatch(/box-shadow:\s*0 0 0 2px var\(--altrastate-midnight\)/);
    expect(contrastRatio('#0b1f3a', '#f5f7fa')).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(CYAN, '#0b1f3a')).toBeGreaterThanOrEqual(3);
  });
});
