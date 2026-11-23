#!/usr/bin/env node
/**
 * MP §2.2 security floor: fail on any high/critical advisory, and on ANY advisory (any severity)
 * affecting the React Server Components stack (React2Shell, CVE-2025-55182 and follow-ups).
 */
import { execFileSync } from 'node:child_process';

const CRITICAL_PACKAGES = /^(next|react|react-dom|react-server-dom-.+)$/;

let raw;
try {
  raw = execFileSync('npm', ['audit', '--json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (e) {
  raw = e.stdout; // npm audit exits non-zero when it finds anything
}
const report = JSON.parse(raw);
const vulns = Object.values(report.vulnerabilities ?? {});
const rsc = vulns.filter((v) => CRITICAL_PACKAGES.test(v.name));
const high = vulns.filter((v) => v.severity === 'high' || v.severity === 'critical');

for (const v of [...new Set([...rsc, ...high])])
  console.error(`  ${v.severity.padEnd(8)} ${v.name} ${v.range}`);
if (rsc.length || high.length) {
  console.error(
    `\nnpm audit gate failed: ${rsc.length} React/Next advisories, ${high.length} high/critical.`,
  );
  process.exit(1);
}
console.log(
  `npm audit gate passed (${vulns.length} lower-severity advisories outside the RSC stack).`,
);
