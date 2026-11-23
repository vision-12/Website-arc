#!/usr/bin/env node
/**
 * MP §3.1: nothing school-specific may live in source code. Fails on Ugandan school domains,
 * +256 phone numbers and hard-coded hex colours under src/, except in allow-listed paths.
 * Usage: node scripts/check-school-values.mjs [root]
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export const ALLOW = [
  /^src\/features\/templates\//, // template design tokens (MP §3.1)
  /^src\/app\/admin\/admin-tokens\.css$/, // Altrastate product brand, not a school's
  /^src\/features\/cms\/settings\/fallback\.ts$/, // neutral greyscale fallback theme
  /^src\/lib\/colour\/contrast\.ts$/, // WCAG reference colours (white / near-black)
  /(^|\/)__tests__\//,
  /\.test\.tsx?$/,
];

export const RULES = [
  { name: 'Ugandan school domain', re: /\b[a-z0-9-]+\.(ac|sc)\.ug\b/i },
  { name: 'Ugandan phone number', re: /\+256[\s\d-]{6,}/ },
  { name: 'hex colour', re: /(?<![\w&/])#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})\b(?![\w-])/i },
];

const EXT = /\.(ts|tsx|js|jsx|mjs|css|json|md)$/;

export function scanText(path, text) {
  const findings = [];
  text.split('\n').forEach((line, i) => {
    for (const rule of RULES) {
      if (rule.re.test(line))
        findings.push({ path, line: i + 1, rule: rule.name, text: line.trim().slice(0, 120) });
    }
  });
  return findings;
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (EXT.test(entry)) yield full;
  }
}

export function scan(root = process.cwd()) {
  const findings = [];
  for (const file of walk(join(root, 'src'))) {
    const rel = relative(root, file).split(sep).join('/');
    if (ALLOW.some((re) => re.test(rel))) continue;
    findings.push(...scanText(rel, readFileSync(file, 'utf8')));
  }
  return findings;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const findings = scan(process.argv[2] ?? process.cwd());
  if (findings.length) {
    console.error(
      'School-specific values found in source (MP §3.1). Move them to site_settings or env:\n',
    );
    for (const f of findings) console.error(`  ${f.path}:${f.line}  [${f.rule}]  ${f.text}`);
    process.exit(1);
  }
  console.log('check-school-values: no school-specific values in src/');
}
