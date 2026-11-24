#!/usr/bin/env node
/** MP §7.2: Supabase Security and Performance Advisors must report zero findings (warn or error). */
import { execFileSync } from 'node:child_process';

// Ask for JSON explicitly. The CLI's default format depends on where it runs: it prints JSON when
// it detects an AI agent and text everywhere else, so relying on the default broke CI.
let raw = '';
let stderr = '';
try {
  raw = execFileSync('npx', ['supabase', 'db', 'advisors', '--output-format', 'json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (e) {
  raw = e.stdout ?? '';
  stderr = e.stderr ?? '';
}

const start = raw.indexOf('{');
let report;
try {
  report = JSON.parse(raw.slice(start));
} catch {
  report = undefined;
}
if (start === -1 || !report || !Array.isArray(report.results)) {
  console.error('Could not read the advisors report: expected JSON from `supabase db advisors`.');
  console.error(raw.trim() || '(no output)');
  if (stderr.trim()) console.error(stderr.trim());
  process.exit(1);
}

for (const r of report.results) console.error(`${r.level} ${r.name}: ${r.detail}`);
if (report.results.length) {
  console.error(`\nSupabase advisors reported ${report.results.length} finding(s).`);
  process.exit(1);
}
console.log('Supabase advisors: no findings.');
