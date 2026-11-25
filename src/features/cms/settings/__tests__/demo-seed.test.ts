import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSection } from '@/features/templates/shared/section-settings';
import { SiteSettings } from '../schema';

/** The local demo school must always be valid, or the site silently falls back to neutral settings. */
function seededSettings(): unknown {
  const sql = readFileSync(join(process.cwd(), 'supabase/seed/demo-content.sql'), 'utf8');
  const match = /update public\.site_settings set data = '([\s\S]*)'::jsonb where id = 1;/.exec(
    sql,
  );
  if (!match?.[1]) throw new Error('demo settings update not found');
  return JSON.parse(match[1].replaceAll("''", "'"));
}

describe('local demo seed', () => {
  it('parses with the site settings schema', () => {
    const result = SiteSettings.safeParse(seededSettings());
    expect(
      result.success ? [] : result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    ).toEqual([]);
  });

  it('has a valid settings object for every homepage section', () => {
    const settings = SiteSettings.parse(seededSettings());
    const invalid = settings.homepage
      .filter((section) => parseSection(section) === null)
      .map((s) => s.id);
    expect(invalid).toEqual([]);
    expect(settings.homepage.length).toBeGreaterThanOrEqual(10);
  });
});
