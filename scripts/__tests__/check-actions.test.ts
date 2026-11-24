import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = join(__dirname, '..', 'check-actions.mjs');

function run(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'check-actions-'));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  try {
    return { code: 0, out: execFileSync('node', [script, root], { encoding: 'utf8' }) };
  } catch (e) {
    const err = e as { status: number; stderr: string };
    return { code: err.status, out: err.stderr };
  }
}

describe('check-actions (every action calls requirePermission)', () => {
  it('passes actions built with defineAction / defineUserAction', () => {
    expect(
      run({
        'src/features/news/actions.ts':
          "export const publish = defineAction({ input, permission: 'news.publish', handler });\nexport const rename = defineUserAction({ input, handler });",
      }).code,
    ).toBe(0);
  });

  it('fails a raw exported server function', () => {
    const r = run({
      'src/features/news/actions.ts': 'export async function publish(input) { await db.update(); }',
    });
    expect(r.code).toBe(1);
    expect(r.out).toContain('"publish" must be created with defineAction');
  });

  it('exempts the auth feature', () => {
    expect(run({ 'src/features/auth/actions.ts': 'export async function login() {}' }).code).toBe(
      0,
    );
  });

  it('passes on the real source tree', () => {
    expect(
      execFileSync('node', [script, join(__dirname, '..', '..')], { encoding: 'utf8' }),
    ).toContain('every feature action');
  });
});
