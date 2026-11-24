#!/usr/bin/env node
/**
 * DoD (MP §12): "every action calls requirePermission". Every export from a feature's actions.ts
 * must be built with defineAction (requirePermission) or defineUserAction (own-account actions).
 * src/features/auth is exempt: it establishes identity (spec §4.7) and is rate-limited instead.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] ?? process.cwd();
const featuresDir = join(root, 'src/features');
const EXEMPT = new Set(['auth']);
const problems = [];

for (const feature of readdirSync(featuresDir)) {
  const file = join(featuresDir, feature, 'actions.ts');
  if (EXEMPT.has(feature) || !existsSync(file)) continue;
  const source = readFileSync(file, 'utf8');
  for (const m of source.matchAll(
    /^export\s+(async\s+function|function|const)\s+(\w+)([^\n]*)/gm,
  )) {
    const [, kind, name, rest] = m;
    if (kind !== 'const' || !/=\s*define(User)?Action\(/.test(rest)) {
      problems.push(
        `src/features/${feature}/actions.ts: "${name}" must be created with defineAction/defineUserAction`,
      );
    }
  }
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('check-actions: every feature action goes through defineAction/defineUserAction');
