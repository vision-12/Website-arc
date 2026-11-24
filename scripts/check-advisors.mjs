#!/usr/bin/env node
/** MP §7.2: Supabase Security and Performance Advisors must report zero findings. */
import { execFileSync } from 'node:child_process';

let raw;
try {
  raw = execFileSync('npx', ['supabase', 'db', 'advisors'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (e) {
  raw = e.stdout ?? '';
}
const json = raw.slice(raw.indexOf('{'));
const results = JSON.parse(json).results ?? [];
for (const r of results) console.error(`${r.level} ${r.name}: ${r.detail}`);
if (results.length) {
  console.error(`\nSupabase advisors reported ${results.length} finding(s).`);
  process.exit(1);
}
console.log('Supabase advisors: no findings.');
